'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Helpers ───────────────────────────────────────────────────────────────────

function ptsColor(n: number) {
  if (n > 0) return 'var(--status-saved)'
  if (n < 0) return 'var(--brand)'
  return 'var(--muted)'
}

function getDiffInfo(pred: number, actual: number | null): {
  label: string
  cls: string
  dir: string
} {
  if (actual === null) return { label: 'DNF', cls: 'miss', dir: '✕' }
  const d = pred - actual
  if (d === 0) return { label: 'Exact', cls: 'exact', dir: '●' }
  if (d > 0)   return { label: `↑${Math.abs(d)}`, cls: Math.abs(d) <= 2 ? 'close' : 'far', dir: '↑' }
  return          { label: `↓${Math.abs(d)}`, cls: Math.abs(d) <= 2 ? 'close' : 'far', dir: '↓' }
}

// ── Main Component ─────────────────────────────────────────────────────────────

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

  const availableSessions = useMemo(() => {
    const inData = new Set(allRows.map(r => r.session_type))
    return SESSION_ORDER.filter(s => inData.has(s))
  }, [allRows])

  // Auto-select last available session when weekend changes
  useEffect(() => {
    if (availableSessions.length > 0 && !availableSessions.includes(activeSession)) {
      setActiveSession(availableSessions[availableSessions.length - 1])
    }
  }, [availableSessions, activeSession])

  // My rows for active session
  const mySessionRows = useMemo(() =>
    allRows.filter(r => r.user_id === currentUserId && r.session_type === activeSession)
      .sort((a, b) => a.predicted_position - b.predicted_position),
    [allRows, currentUserId, activeSession]
  )

  // All users grouped by user for current session
  const sessionByUser = useMemo(() => {
    const map: Record<string, ScoreRow[]> = {}
    for (const row of allRows) {
      if (row.session_type !== activeSession) continue
      if (!map[row.user_id]) map[row.user_id] = []
      map[row.user_id].push(row)
    }
    for (const uid of Object.keys(map)) {
      map[uid].sort((a, b) => a.predicted_position - b.predicted_position)
    }
    return map
  }, [allRows, activeSession])

  // Ranked users for current session
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

  // Weekend total per user
  const weekendTotalByUser = useMemo(() => {
    const map: Record<string, number> = {}
    for (const row of allRows) {
      map[row.user_id] = (map[row.user_id] ?? 0) + row.points
    }
    return map
  }, [allRows])

  // Session totals per session for the current user
  const mySessionTotals = useMemo(() => {
    const map: Record<SessionType, number> = { qualifying: 0, sprint: 0, race: 0 }
    for (const row of allRows.filter(r => r.user_id === currentUserId)) {
      map[row.session_type] = (map[row.session_type] ?? 0) + row.points
    }
    return map
  }, [allRows, currentUserId])

  const myWeekendTotal = weekendTotalByUser[currentUserId] ?? 0
  const mySessionTotal = mySessionRows.reduce((s, r) => s + r.points, 0)

  // Max position count for comparison columns
  const maxPicks = useMemo(() => {
    let max = 0
    for (const rows of Object.values(sessionByUser)) max = Math.max(max, rows.length)
    return max
  }, [sessionByUser])

  const posLabels = Array.from({ length: maxPicks }, (_, i) => `P${i + 1}`)

  if (loading) {
    return <main className="container"><p className="small" style={{ marginTop: '2rem' }}>Loading...</p></main>
  }

  const now = Date.now()

  return (
    <main className="container">

      {/* ── Race Pill Tabs ── */}
      <div className="telemetry-race-bar">
        <div className="telemetry-race-pills">
          {weekends.map(w => {
            const isCompleted = now >= new Date(w.race_deadline).getTime()
            const isLive = now >= new Date(w.qualifying_deadline).getTime() && !isCompleted
            const isSelected = w.id === selectedWeekendId
            return (
              <button
                key={w.id}
                className={`telemetry-race-pill${isSelected ? ' active' : ''}${isLive ? ' live' : ''}${!isCompleted && !isLive ? ' future' : ''}`}
                onClick={() => { setSelectedWeekendId(w.id); setActiveView('mine') }}
                title={w.grand_prix}
              >
                <span className="telemetry-pill-round">R{w.round}</span>
                <span className="telemetry-pill-code">
                  {w.grand_prix.replace(/Grand Prix/i, '').replace(/\(.*?\)/g, '').trim().slice(0, 3).toUpperCase()}
                </span>
                {isLive && <span className="telemetry-pill-live-dot" />}
                {isCompleted && <span className="telemetry-pill-done">✓</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Weekend info bar ── */}
      {selectedWeekend && (
        <div className="telemetry-info-bar">
          <div className="telemetry-info-gp">
            <span className="telemetry-info-round">Round {selectedWeekend.round}</span>
            <span className="telemetry-info-name">{selectedWeekend.grand_prix}</span>
          </div>

          {/* Session sidebar pills with my totals */}
          <div className="telemetry-session-pills">
            {SESSION_ORDER.map(s => {
              const hasData = availableSessions.includes(s)
              const isActive = activeSession === s
              const tot = mySessionTotals[s]
              return (
                <button
                  key={s}
                  disabled={!hasData}
                  className={`telemetry-session-pill${isActive ? ' active' : ''}${!hasData ? ' no-data' : ''}`}
                  onClick={() => { if (hasData) setActiveSession(s) }}
                >
                  <span className="telemetry-sp-label">{SESSION_LABELS[s]}</span>
                  {hasData
                    ? <span className="telemetry-sp-pts" style={{ color: ptsColor(tot) }}>{tot >= 0 ? `+${tot}` : tot}</span>
                    : <span className="telemetry-sp-pts" style={{ color: 'var(--muted)' }}>—</span>
                  }
                </button>
              )
            })}
          </div>

          {/* Weekend total */}
          <div className="telemetry-weekend-total">
            <span className="telemetry-wt-label">Weekend</span>
            <span className="telemetry-wt-pts">{myWeekendTotal >= 0 ? `+${myWeekendTotal}` : myWeekendTotal}</span>
          </div>
        </div>
      )}

      {dataLoading && <p className="small" style={{ margin: '1.5rem 0' }}>Loading scores...</p>}

      {!dataLoading && allRows.length === 0 && (
        <div className="card" style={{ marginTop: '1rem', borderLeft: '3px solid var(--status-locked)' }}>
          <p className="small">No scores yet for this race — admin needs to run Sync &amp; Score after sessions complete.</p>
        </div>
      )}

      {!dataLoading && allRows.length > 0 && (
        <>
          {/* ── View toggle ── */}
          <div className="telemetry-view-toggle">
            <button
              className={`telemetry-view-btn${activeView === 'mine' ? ' active' : ''}`}
              onClick={() => setActiveView('mine')}
            >
              My Results
            </button>
            <button
              className={`telemetry-view-btn${activeView === 'comparison' ? ' active' : ''}`}
              onClick={() => setActiveView('comparison')}
            >
              Comparison
            </button>
          </div>

          {/* ══ MY RESULTS ══ */}
          {activeView === 'mine' && (
            <div className="telemetry-main">

              {/* Session header */}
              <div className="telemetry-session-header">
                <span className="telemetry-session-title">{SESSION_LABELS[activeSession]}</span>
                <span className="telemetry-session-pts" style={{ color: ptsColor(mySessionTotal) }}>
                  {mySessionTotal >= 0 ? `+${mySessionTotal}` : mySessionTotal} pts
                </span>
              </div>

              {mySessionRows.length === 0 ? (
                <div className="card">
                  <p className="small">No picks scored for this session yet.</p>
                </div>
              ) : (
                <div className="telemetry-picks-grid">
                  {mySessionRows.map((row, i) => {
                    const { label, cls, dir } = getDiffInfo(row.predicted_position, row.actual_position)
                    const moved = row.actual_position !== null ? row.predicted_position - row.actual_position : 0

                    return (
                      <div key={i} className={`telemetry-pick-card ${cls}`}>
                        {/* Left: position badge */}
                        <div className={`telemetry-pick-badge ${cls}`}>
                          P{row.predicted_position}
                        </div>

                        {/* Middle: driver + movement */}
                        <div className="telemetry-pick-body">
                          <div className="telemetry-pick-driver">{row.driver_name}</div>
                          <div className="telemetry-pick-movement">
                            <span className="telemetry-pick-pred">P{row.predicted_position}</span>
                            <span className={`telemetry-pick-dir ${cls}`}>{dir}</span>
                            <span className="telemetry-pick-actual">
                              {row.actual_position !== null ? `P${row.actual_position}` : 'DNF'}
                            </span>
                          </div>
                          {row.penalty_reason && (
                            <div className="telemetry-pick-penalty">{row.penalty_reason}</div>
                          )}
                        </div>

                        {/* Right: diff pill + points */}
                        <div className="telemetry-pick-right">
                          <span className={`telemetry-diff-pill ${cls}`}>{label}</span>
                          <span className="telemetry-pick-pts" style={{ color: ptsColor(row.points) }}>
                            {row.points > 0 ? `+${row.points}` : row.points}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Mini leaderboard strip */}
              {rankedUsers.length > 0 && (
                <div style={{ marginTop: '2rem' }}>
                  <div className="results-section-divider">Session Leaderboard</div>
                  <div className="telemetry-lb-strip">
                    {rankedUsers.map((u, i) => {
                      const isMe = u.user_id === currentUserId
                      return (
                        <div key={u.user_id} className={`telemetry-lb-chip${isMe ? ' me' : ''}${i < 3 ? ' top' : ''}`}>
                          <span className="telemetry-lb-chip-rank">{i + 1}</span>
                          <span className="telemetry-lb-chip-name">
                            {u.display_name}
                            {isMe && <span className="pitwall-you" style={{ marginLeft: '0.3rem' }}>YOU</span>}
                          </span>
                          <span className="telemetry-lb-chip-pts" style={{ color: ptsColor(u.sessionTotal) }}>
                            {u.sessionTotal >= 0 ? `+${u.sessionTotal}` : u.sessionTotal}
                          </span>
                          <span className="telemetry-lb-chip-wkd" style={{ color: 'var(--muted)' }}>
                            {weekendTotalByUser[u.user_id] ?? 0} wkd
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ COMPARISON VIEW ══ */}
          {activeView === 'comparison' && (
            <div className="telemetry-main">

              <div className="telemetry-session-header">
                <span className="telemetry-session-title">{SESSION_LABELS[activeSession]} — All Competitors</span>
                <span className="telemetry-session-pts" style={{ color: 'var(--muted)', fontSize: 'var(--font-sm)' }}>
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
                        return (
                          <tr key={u.user_id} className={`results-cmp-row${isMe ? ' me' : ''}`}>
                            <td className={`results-cmp-rank${i < 3 ? ' top' : ''}`}>{i + 1}</td>
                            <td className="results-cmp-player">
                              {u.display_name}
                              {isMe && <span className="results-you-badge">YOU</span>}
                            </td>
                            {posLabels.map((_, pi) => {
                              const row = u.rows[pi]
                              if (!row) return <td key={pi} className="results-cmp-cell empty">—</td>
                              const { cls } = getDiffInfo(row.predicted_position, row.actual_position)
                              return (
                                <td key={pi} className={`results-cmp-cell ${cls}`} title={`${row.driver_name} P${row.predicted_position}→${row.actual_position ?? 'DNF'}`}>
                                  <div className="results-cmp-driver">{row.driver_name}</div>
                                  <div className="results-cmp-pos-line">
                                    <span>P{row.predicted_position}</span>
                                    <span className="results-cmp-arr">→</span>
                                    <span>{row.actual_position !== null ? `P${row.actual_position}` : '—'}</span>
                                  </div>
                                  <div className="results-cmp-pts" style={{ color: ptsColor(row.points) }}>
                                    {row.points > 0 ? `+${row.points}` : row.points}
                                  </div>
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

              {/* Actual results reference */}
              {rankedUsers.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div className="results-section-divider">Actual {SESSION_LABELS[activeSession]} Results</div>
                  <div className="results-actual-grid">
                    {(() => {
                      const anyUserRows = rankedUsers[0]?.rows ?? []
                      return anyUserRows
                        .filter(r => r.actual_position !== null)
                        .sort((a, b) => (a.actual_position ?? 99) - (b.actual_position ?? 99))
                        .map(row => (
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
