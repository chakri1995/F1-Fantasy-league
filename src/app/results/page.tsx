'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────────────────────

type SessionType = 'qualifying' | 'sprint' | 'race'

const SESSION_ORDER: SessionType[] = ['qualifying', 'sprint', 'race']
const SESSION_LABELS: Record<SessionType, string> = {
  qualifying: 'Qualifying',
  sprint: 'Sprint',
  race: 'Race',
}

interface ScoreRow {
  weekend_id: string
  user_id: string
  session_type: SessionType
  predicted_position: number
  actual_position: number | null
  points: number
  penalty_reason: string | null
  driver_name: string
}

interface Weekend {
  id: string
  round: number
  grand_prix: string
  season: number
  race_deadline: string
  qualifying_deadline: string
}

interface UserProfile {
  user_id: string
  display_name: string
  total_points: number
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function pts(n: number) {
  if (n > 0) return <span style={{ color: 'var(--status-saved)', fontWeight: 700 }}>+{n}</span>
  if (n < 0) return <span style={{ color: 'var(--brand)', fontWeight: 700 }}>{n}</span>
  return <span style={{ color: 'var(--muted)', fontWeight: 700 }}>0</span>
}

function diffBadge(pred: number, actual: number | null) {
  if (actual === null) return <span className="diff-badge miss">DNF</span>
  const d = Math.abs(pred - actual)
  if (d === 0) return <span className="diff-badge exact">Exact</span>
  if (d <= 2) return <span className="diff-badge close">±{d}</span>
  return <span className="diff-badge far">±{d}</span>
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ResultsPage() {
  const router = useRouter()
  const [currentUserId, setCurrentUserId] = useState('')
  const [weekends, setWeekends] = useState<Weekend[]>([])
  const [selectedWeekendId, setSelectedWeekendId] = useState<string>('')
  const [activeSession, setActiveSession] = useState<SessionType>('race')
  const [activeView, setActiveView] = useState<'mine' | 'comparison'>('mine')
  const [allRows, setAllRows] = useState<ScoreRow[]>([])
  const [profiles, setProfiles] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)

  // ── Load initial data ──
  useEffect(() => {
    async function load() {
      if (!supabase) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setCurrentUserId(user.id)

      const [{ data: wData }, { data: lbData }] = await Promise.all([
        supabase
          .from('race_weekends')
          .select('id, round, grand_prix, season, race_deadline, qualifying_deadline')
          .order('round', { ascending: true }),
        supabase
          .from('leaderboard_totals')
          .select('user_id, display_name, total_points')
          .order('total_points', { ascending: false }),
      ])

      const ws = (wData ?? []) as Weekend[]
      setWeekends(ws)
      setProfiles((lbData ?? []) as UserProfile[])

      // Default to most recently completed race
      const now = Date.now()
      const completed = ws.filter(w => now >= new Date(w.race_deadline).getTime())
      const defaultId = completed.length > 0
        ? completed[completed.length - 1].id
        : ws[0]?.id ?? ''
      setSelectedWeekendId(defaultId)
      setLoading(false)
    }
    load()
  }, [router])

  // ── Load score data when weekend changes ──
  useEffect(() => {
    if (!selectedWeekendId || !supabase) return
    setDataLoading(true)
    supabase
      .from('weekly_breakdown')
      .select('*')
      .eq('weekend_id', selectedWeekendId)
      .order('user_id')
      .order('session_type')
      .order('predicted_position')
      .then(({ data }) => {
        setAllRows((data ?? []) as ScoreRow[])
        setDataLoading(false)
      })
  }, [selectedWeekendId])

  // ── Derived data ──
  const selectedWeekend = weekends.find(w => w.id === selectedWeekendId)

  // Sessions that have data for this weekend
  const availableSessions = useMemo(() => {
    const inData = new Set(allRows.map(r => r.session_type))
    return SESSION_ORDER.filter(s => inData.has(s))
  }, [allRows])

  // Auto-select first available session when weekend changes
  useEffect(() => {
    if (availableSessions.length > 0 && !availableSessions.includes(activeSession)) {
      setActiveSession(availableSessions[availableSessions.length - 1]) // default to race
    }
  }, [availableSessions, activeSession])

  // My rows for active session
  const mySessionRows = useMemo(() =>
    allRows.filter(r => r.user_id === currentUserId && r.session_type === activeSession)
      .sort((a, b) => a.predicted_position - b.predicted_position),
    [allRows, currentUserId, activeSession]
  )

  // All users' rows for active session, grouped by user
  const sessionByUser = useMemo(() => {
    const map: Record<string, ScoreRow[]> = {}
    for (const row of allRows) {
      if (row.session_type !== activeSession) continue
      if (!map[row.user_id]) map[row.user_id] = []
      map[row.user_id].push(row)
    }
    // Sort each user's picks by predicted_position
    for (const uid of Object.keys(map)) {
      map[uid].sort((a, b) => a.predicted_position - b.predicted_position)
    }
    return map
  }, [allRows, activeSession])

  // Ordered user list by their session total (desc)
  const rankedUsers = useMemo(() => {
    return profiles
      .filter(p => sessionByUser[p.user_id])
      .map(p => ({
        ...p,
        sessionTotal: (sessionByUser[p.user_id] ?? []).reduce((s, r) => s + r.points, 0),
        rows: sessionByUser[p.user_id] ?? [],
      }))
      .sort((a, b) => b.sessionTotal - a.sessionTotal)
  }, [profiles, sessionByUser])

  // Weekend total per user (all sessions)
  const weekendTotalByUser = useMemo(() => {
    const map: Record<string, number> = {}
    for (const row of allRows) {
      map[row.user_id] = (map[row.user_id] ?? 0) + row.points
    }
    return map
  }, [allRows])

  // My weekend total across all sessions
  const myWeekendTotal = weekendTotalByUser[currentUserId] ?? 0
  const mySessionTotal = mySessionRows.reduce((s, r) => s + r.points, 0)

  // Session totals for "mine" summary bar
  const mySessionTotals = useMemo(() => {
    const map: Record<SessionType, number> = { qualifying: 0, sprint: 0, race: 0 }
    for (const row of allRows.filter(r => r.user_id === currentUserId)) {
      map[row.session_type] = (map[row.session_type] ?? 0) + row.points
    }
    return map
  }, [allRows, currentUserId])

  // Max position count across users (for comparison column sizing)
  const maxPicks = useMemo(() => {
    let max = 0
    for (const rows of Object.values(sessionByUser)) max = Math.max(max, rows.length)
    return max
  }, [sessionByUser])

  const posLabels = Array.from({ length: maxPicks }, (_, i) => `P${i + 1}`)

  if (loading) {
    return <main className="container"><p className="small" style={{ marginTop: '2rem' }}>Loading...</p></main>
  }

  return (
    <main className="container">

      {/* ── Page header + race picker ── */}
      <div className="results-header">
        <h1 className="section-header" style={{ margin: 0 }}>Results</h1>
        <div className="results-race-picker">
          <label htmlFor="race-select" style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.3rem', display: 'block' }}>
            Select Race
          </label>
          <select
            id="race-select"
            value={selectedWeekendId}
            onChange={e => { setSelectedWeekendId(e.target.value); setActiveView('mine') }}
            style={{ minWidth: '220px' }}
          >
            {weekends.map(w => {
              const now = Date.now()
              const isCompleted = now >= new Date(w.race_deadline).getTime()
              const isLive = now >= new Date(w.qualifying_deadline).getTime() && !isCompleted
              const tag = isCompleted ? ' ✓' : isLive ? ' ⬤' : ''
              return (
                <option key={w.id} value={w.id}>
                  R{w.round} — {w.grand_prix}{tag}
                </option>
              )
            })}
          </select>
        </div>
      </div>

      {/* ── Weekend summary bar: all sessions totals + overall rank ── */}
      {selectedWeekend && (
        <div className="results-weekend-bar">
          <div className="results-weekend-gp">
            <span className="results-weekend-round">Round {selectedWeekend.round}</span>
            <span className="results-weekend-name">{selectedWeekend.grand_prix}</span>
          </div>
          <div className="results-session-totals">
            {SESSION_ORDER.map(s => {
              const haData = availableSessions.includes(s)
              return (
                <div key={s} className={`results-session-total-pill${haData ? '' : ' no-data'}`}>
                  <span className="results-session-total-label">{SESSION_LABELS[s]}</span>
                  <span className="results-session-total-pts">
                    {haData ? (mySessionTotals[s] >= 0 ? `+${mySessionTotals[s]}` : mySessionTotals[s]) : '—'}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="results-weekend-total">
            <span className="results-weekend-total-label">Weekend Total</span>
            <span className="results-weekend-total-pts">{myWeekendTotal >= 0 ? `+${myWeekendTotal}` : myWeekendTotal}</span>
          </div>
        </div>
      )}

      {dataLoading && <p className="small" style={{ margin: '1rem 0' }}>Loading scores...</p>}

      {!dataLoading && allRows.length === 0 && (
        <div className="card" style={{ marginTop: '1rem', borderLeft: '3px solid var(--status-locked)' }}>
          <p className="small">No scores yet for this race — admin needs to run Sync & Score after the sessions complete.</p>
        </div>
      )}

      {!dataLoading && allRows.length > 0 && (
        <>
          {/* ── View toggle ── */}
          <div className="results-view-toggle">
            <button
              className={`results-view-btn${activeView === 'mine' ? ' active' : ''}`}
              onClick={() => setActiveView('mine')}
            >
              My Results
            </button>
            <button
              className={`results-view-btn${activeView === 'comparison' ? ' active' : ''}`}
              onClick={() => setActiveView('comparison')}
            >
              Comparison
            </button>
          </div>

          {/* ── Session tabs ── */}
          <div className="session-tabs" style={{ marginBottom: '1rem' }}>
            {availableSessions.map(s => (
              <button
                key={s}
                className={`session-tab${activeSession === s ? ' active' : ''}`}
                onClick={() => setActiveSession(s)}
              >
                {SESSION_LABELS[s]}
              </button>
            ))}
          </div>

          {/* ══════════════ MY RESULTS VIEW ══════════════ */}
          {activeView === 'mine' && (
            <div>
              {/* Session total banner */}
              <div className="results-session-banner">
                <span className="results-session-banner-label">{SESSION_LABELS[activeSession]} — Your picks</span>
                <span className="results-session-banner-pts">
                  {mySessionTotal >= 0 ? `+${mySessionTotal}` : mySessionTotal} pts
                </span>
              </div>

              {mySessionRows.length === 0 ? (
                <div className="card">
                  <p className="small">No picks scored for this session yet.</p>
                </div>
              ) : (
                <div className="results-picks-grid">
                  {mySessionRows.map((row, i) => {
                    const isExact = row.actual_position !== null && row.actual_position === row.predicted_position
                    const isMiss  = row.actual_position === null
                    const diff    = row.actual_position !== null ? Math.abs(row.predicted_position - row.actual_position) : null

                    return (
                      <div
                        key={i}
                        className={`results-pick-card${isExact ? ' exact' : isMiss ? ' miss' : diff !== null && diff <= 2 ? ' close' : ' far'}`}
                      >
                        {/* Position badge */}
                        <div className="results-pick-pos">P{row.predicted_position}</div>

                        {/* Driver name */}
                        <div className="results-pick-driver">{row.driver_name}</div>

                        {/* Predicted → Actual */}
                        <div className="results-pick-positions">
                          <span className="results-pick-pred">P{row.predicted_position}</span>
                          <span className="results-pick-arrow">→</span>
                          <span className={`results-pick-actual${row.actual_position === null ? ' miss' : ''}`}>
                            {row.actual_position !== null ? `P${row.actual_position}` : 'DNF'}
                          </span>
                        </div>

                        {/* Diff badge */}
                        <div style={{ marginTop: '0.25rem' }}>
                          {diffBadge(row.predicted_position, row.actual_position)}
                        </div>

                        {/* Points */}
                        <div className="results-pick-pts">
                          {pts(row.points)}
                        </div>

                        {/* Penalty note */}
                        {row.penalty_reason && (
                          <div className="results-pick-penalty">{row.penalty_reason}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Leaderboard for this session */}
              {rankedUsers.length > 0 && (
                <div style={{ marginTop: '2rem' }}>
                  <div className="results-section-divider">Session Leaderboard</div>
                  <div className="results-lb-table">
                    <div className="results-lb-header">
                      <span>#</span>
                      <span>Player</span>
                      <span>Session</span>
                      <span>Weekend Total</span>
                    </div>
                    {rankedUsers.map((u, i) => {
                      const isMe = u.user_id === currentUserId
                      return (
                        <div key={u.user_id} className={`results-lb-row${isMe ? ' me' : ''}`}>
                          <span className={`results-lb-rank${i < 3 ? ' top' : ''}`}>{i + 1}</span>
                          <span className="results-lb-name">
                            {u.display_name}
                            {isMe && <span className="results-you-badge">YOU</span>}
                          </span>
                          <span className="results-lb-session-pts">
                            {u.sessionTotal >= 0 ? `+${u.sessionTotal}` : u.sessionTotal}
                          </span>
                          <span className="results-lb-weekend-pts">
                            {weekendTotalByUser[u.user_id] ?? 0}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ COMPARISON VIEW ══════════════ */}
          {activeView === 'comparison' && (
            <div>
              <div className="results-session-banner">
                <span className="results-session-banner-label">{SESSION_LABELS[activeSession]} — All Competitors</span>
                <span className="results-session-banner-pts" style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', fontWeight: 600 }}>
                  {rankedUsers.length} player{rankedUsers.length !== 1 ? 's' : ''}
                </span>
              </div>

              {rankedUsers.length === 0 ? (
                <div className="card">
                  <p className="small">No comparison data for this session yet.</p>
                </div>
              ) : (
                <div className="results-comparison-wrap">
                  <table className="results-comparison-table">
                    <thead>
                      <tr>
                        <th className="results-cmp-rank-col">#</th>
                        <th className="results-cmp-player-col">Player</th>
                        {posLabels.map(p => (
                          <th key={p} className="results-cmp-pos-col">{p}</th>
                        ))}
                        <th className="results-cmp-total-col">Pts</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankedUsers.map((u, i) => {
                        const isMe = u.user_id === currentUserId
                        const rows = u.rows
                        return (
                          <tr key={u.user_id} className={`results-cmp-row${isMe ? ' me' : ''}`}>
                            <td className={`results-cmp-rank${i < 3 ? ' top' : ''}`}>{i + 1}</td>
                            <td className="results-cmp-player">
                              {u.display_name}
                              {isMe && <span className="results-you-badge">YOU</span>}
                            </td>
                            {posLabels.map((_, pi) => {
                              const row = rows[pi]
                              if (!row) return <td key={pi} className="results-cmp-cell empty">—</td>
                              const isExact = row.actual_position !== null && row.actual_position === row.predicted_position
                              const isMiss  = row.actual_position === null
                              const diff    = row.actual_position !== null ? Math.abs(row.predicted_position - row.actual_position) : null
                              const cellCls = isExact ? 'exact' : isMiss ? 'miss' : diff !== null && diff <= 2 ? 'close' : 'far'
                              return (
                                <td key={pi} className={`results-cmp-cell ${cellCls}`} title={`${row.driver_name} P${row.predicted_position}→${row.actual_position ?? 'DNF'}`}>
                                  <div className="results-cmp-driver">{row.driver_name}</div>
                                  <div className="results-cmp-pos-line">
                                    <span>P{row.predicted_position}</span>
                                    <span className="results-cmp-arr">→</span>
                                    <span>{row.actual_position !== null ? `P${row.actual_position}` : '—'}</span>
                                  </div>
                                  <div className="results-cmp-pts">{pts(row.points)}</div>
                                </td>
                              )
                            })}
                            <td className="results-cmp-total">
                              {u.sessionTotal >= 0 ? `+${u.sessionTotal}` : u.sessionTotal}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Actual results reference (what really happened) */}
              {rankedUsers.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div className="results-section-divider">Actual {SESSION_LABELS[activeSession]} Results</div>
                  <div className="results-actual-grid">
                    {(() => {
                      // Build actual results from any user's score rows
                      const anyUserRows = rankedUsers[0]?.rows ?? []
                      const withActual = anyUserRows
                        .filter(r => r.actual_position !== null)
                        .sort((a, b) => (a.actual_position ?? 99) - (b.actual_position ?? 99))
                      return withActual.map(row => (
                        <div key={row.driver_name} className="results-actual-item">
                          <span className="results-actual-pos">P{row.actual_position}</span>
                          <span className="results-actual-driver">{row.driver_name}</span>
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </main>
  )
}
