'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type SessionType = 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race'

interface EventRow {
  session_type: SessionType
  predicted_position: number
  actual_position: number | null
  points: number
  penalty_reason: string | null
  driver_name: string
  user_id: string
  weekend_id: string
}

interface SessionSummary {
  session_type: SessionType
  points: number
}

interface UserProfile {
  user_id: string
  display_name: string
}

interface WeekendInfo {
  grand_prix: string
  season: number
  round: number
}

const SESSION_LABELS: Record<SessionType, string> = {
  qualifying: 'Qualifying',
  sprint_qualifying: 'Sprint Quali',
  sprint: 'Sprint',
  race: 'Race',
}

function groupBySession(rows: EventRow[]): Record<string, EventRow[]> {
  const result: Record<string, EventRow[]> = {}
  for (const row of rows) {
    if (!result[row.session_type]) result[row.session_type] = []
    result[row.session_type].push(row)
  }
  return result
}

function sumPoints(rows: EventRow[]): number {
  return rows.reduce((sum, r) => sum + r.points, 0)
}

export default function WeeklyBreakdownPage() {
  const { weekendId } = useParams<{ weekendId: string }>()
  const router = useRouter()

  // My data
  const [myRows, setMyRows] = useState<EventRow[]>([])
  const [currentUserId, setCurrentUserId] = useState('')
  const [weekendInfo, setWeekendInfo] = useState<WeekendInfo | null>(null)
  const [status, setStatus] = useState('Loading...')

  // All-contestants data
  const [allRows, setAllRows] = useState<EventRow[]>([])
  const [userProfiles, setUserProfiles] = useState<Record<string, string>>({})
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setStatus('Supabase not configured')
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth')
        return
      }

      setCurrentUserId(user.id)

      const [
        { data: myData, error: myError },
        { data: allData },
        { data: profilesData },
        { data: weekendData },
      ] = await Promise.all([
        supabase
          .from('weekly_breakdown')
          .select('*')
          .eq('weekend_id', weekendId)
          .eq('user_id', user.id)
          .order('session_type', { ascending: true })
          .order('predicted_position', { ascending: true }),
        supabase
          .from('weekly_breakdown')
          .select('*')
          .eq('weekend_id', weekendId)
          .order('user_id', { ascending: true })
          .order('session_type', { ascending: true })
          .order('predicted_position', { ascending: true }),
        supabase.from('leaderboard_totals').select('user_id, display_name'),
        supabase
          .from('race_weekends')
          .select('grand_prix, season, round')
          .eq('id', weekendId)
          .single(),
      ])

      if (myError) {
        setStatus(myError.message)
        return
      }

      setMyRows((myData ?? []) as EventRow[])
      setAllRows((allData ?? []) as EventRow[])
      setWeekendInfo(weekendData as WeekendInfo)

      const profileMap: Record<string, string> = {}
      for (const p of (profilesData ?? []) as UserProfile[]) {
        profileMap[p.user_id] = p.display_name
      }
      setUserProfiles(profileMap)
      setStatus('')
    }

    load()
  }, [router, weekendId])

  const mySummary = useMemo(() => {
    const base: SessionSummary[] = [
      { session_type: 'qualifying', points: 0 },
      { session_type: 'sprint_qualifying', points: 0 },
      { session_type: 'sprint', points: 0 },
      { session_type: 'race', points: 0 },
    ]
    for (const row of myRows) {
      const target = base.find((item) => item.session_type === row.session_type)
      if (target) target.points += row.points
    }
    return base
  }, [myRows])

  const myTotal = useMemo(() => myRows.reduce((s, r) => s + r.points, 0), [myRows])

  // Group all rows by userId, sort by total
  const userTotals = useMemo(() => {
    const byUser: Record<string, EventRow[]> = {}
    for (const row of allRows) {
      if (!byUser[row.user_id]) byUser[row.user_id] = []
      byUser[row.user_id].push(row)
    }
    return Object.entries(byUser)
      .map(([uid, rows]) => ({ userId: uid, rows, total: sumPoints(rows) }))
      .sort((a, b) => b.total - a.total)
  }, [allRows])

  function toggleUser(userId: string) {
    setExpandedUsers((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const pageTitle = weekendInfo
    ? `${weekendInfo.season} R${weekendInfo.round} — ${weekendInfo.grand_prix}`
    : 'Results'

  return (
    <main className="container">
      <h1 className="section-header" style={{ marginBottom: '1.5rem' }}>
        {pageTitle}
      </h1>

      {status && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="small">{status}</p>
        </div>
      )}

      {/* ── Your Results ── */}
      <div className="results-section-divider">Your Results</div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem', gap: '0.6rem' }}>
        {mySummary.map((item) => (
          <div className="card" key={item.session_type} style={{ textAlign: 'center', padding: '0.75rem' }}>
            <p className="small" style={{ marginBottom: '0.3rem', fontSize: 'var(--font-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {SESSION_LABELS[item.session_type]}
            </p>
            <p style={{ fontSize: '1.4rem', fontWeight: 800, color: item.points > 0 ? 'var(--brand)' : 'var(--muted)' }}>
              {item.points}
            </p>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <p style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: 'var(--font-sm)' }}>
            Pick Breakdown
          </p>
          <p style={{ fontWeight: 800, color: 'var(--brand)', fontSize: '1rem' }}>
            {myTotal} pts
          </p>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Driver</th>
              <th>Pred</th>
              <th>Actual</th>
              <th>Penalty</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {myRows.map((row, idx) => (
              <tr key={`${row.session_type}-${row.driver_name}-${idx}`}>
                <td style={{ color: 'var(--muted)', fontSize: 'var(--font-xs)', textTransform: 'uppercase' }}>
                  {SESSION_LABELS[row.session_type]}
                </td>
                <td style={{ fontWeight: 600 }}>{row.driver_name}</td>
                <td>P{row.predicted_position}</td>
                <td>{row.actual_position != null ? `P${row.actual_position}` : '—'}</td>
                <td style={{ color: row.penalty_reason ? 'var(--brand)' : 'var(--muted)' }}>
                  {row.penalty_reason ?? '—'}
                </td>
                <td style={{ fontWeight: 700, color: row.points > 0 ? 'var(--status-saved)' : row.points < 0 ? 'var(--brand)' : 'var(--muted)' }}>
                  {row.points > 0 ? `+${row.points}` : row.points}
                </td>
              </tr>
            ))}
            {myRows.length === 0 && (
              <tr>
                <td colSpan={6} className="small">
                  No scoring rows yet — ask admin to run sync and scoring.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── All Contestants ── */}
      {userTotals.length > 0 && (
        <>
          <div className="results-section-divider">All Contestants</div>

          {userTotals.map(({ userId, rows, total }, idx) => {
            const name = userProfiles[userId] || userId.slice(0, 8)
            const isMe = userId === currentUserId
            const isOpen = expandedUsers.has(userId)
            const sessionGroups = groupBySession(rows)

            return (
              <div key={userId}>
                <div
                  className="leaderboard-row"
                  onClick={() => toggleUser(userId)}
                  style={isMe ? { borderColor: 'var(--brand)', borderLeft: '3px solid var(--brand)' } : {}}
                >
                  <span className={`leaderboard-rank${idx < 3 ? ' top-3' : ''}`}>
                    {idx + 1}
                  </span>
                  <span className="leaderboard-name">
                    {name}
                    {isMe && (
                      <span style={{ marginLeft: '0.5rem', fontSize: 'var(--font-xs)', color: 'var(--brand)', fontWeight: 700 }}>
                        YOU
                      </span>
                    )}
                  </span>
                  <span className="leaderboard-points">{total}</span>
                  <span className="leaderboard-pts-label">pts</span>
                  <span className={`leaderboard-chevron${isOpen ? ' open' : ''}`}>›</span>
                </div>

                {isOpen && (
                  <div className="leaderboard-breakdown">
                    <div className="leaderboard-breakdown-inner">
                      {/* Session summary row */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        {(Object.keys(SESSION_LABELS) as SessionType[]).map((s) => {
                          const sessionRows = sessionGroups[s] ?? []
                          const sessionPts = sumPoints(sessionRows)
                          return (
                            <div key={s} style={{ textAlign: 'center', padding: '0.5rem', background: 'var(--card)', borderRadius: '6px', border: '1px solid var(--line)' }}>
                              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                                {SESSION_LABELS[s]}
                              </p>
                              <p style={{ fontWeight: 800, color: sessionPts > 0 ? 'var(--brand)' : 'var(--muted)' }}>
                                {sessionPts}
                              </p>
                            </div>
                          )
                        })}
                      </div>

                      {/* Pick-by-pick detail */}
                      <table className="table" style={{ fontSize: 'var(--font-xs)' }}>
                        <thead>
                          <tr>
                            <th>Session</th>
                            <th>Driver</th>
                            <th>Pred</th>
                            <th>Actual</th>
                            <th>Pts</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row, i) => (
                            <tr key={i}>
                              <td style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                {SESSION_LABELS[row.session_type]}
                              </td>
                              <td>{row.driver_name}</td>
                              <td>P{row.predicted_position}</td>
                              <td>{row.actual_position != null ? `P${row.actual_position}` : '—'}</td>
                              <td style={{ fontWeight: 700, color: row.points > 0 ? 'var(--status-saved)' : row.points < 0 ? 'var(--brand)' : 'var(--muted)' }}>
                                {row.points > 0 ? `+${row.points}` : row.points}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </>
      )}
    </main>
  )
}
