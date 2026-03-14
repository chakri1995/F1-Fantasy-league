'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { Weekend } from '@/lib/types'

interface LeaderboardRow {
  user_id: string
  display_name: string
  total_points: number
}

interface BreakdownRow {
  weekend_id: string
  session_type: 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race'
  predicted_position: number
  actual_position: number | null
  points: number
  penalty_reason: string | null
  driver_name: string
}

const SESSION_LABELS: Record<string, string> = {
  qualifying: 'Qualifying',
  sprint_qualifying: 'Sprint Quali',
  sprint: 'Sprint',
  race: 'Race',
}

type RaceStatus = 'completed' | 'live' | 'next' | 'upcoming'

function getRaceStatus(w: Weekend, nextUpcomingId: string | null): RaceStatus {
  const now = Date.now()
  const raceDeadline = new Date(w.race_deadline).getTime()
  const qualiDeadline = new Date(w.qualifying_deadline).getTime()
  if (now >= raceDeadline) return 'completed'
  if (now >= qualiDeadline) return 'live'
  if (w.id === nextUpcomingId) return 'next'
  return 'upcoming'
}

function getRaceStatusLabel(status: RaceStatus): string {
  if (status === 'completed') return '✓ Completed'
  if (status === 'live') return '⬤ Race Week'
  if (status === 'next') return '▶ Next Race'
  return '● Upcoming'
}

function formatRaceDate(w: Weekend): string {
  return new Date(w.race_deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function groupBreakdownByWeekend(
  rows: BreakdownRow[],
  weekends: Weekend[],
): { weekendId: string; gpName: string; sessions: { session: string; points: number }[] }[] {
  const weekendMap: Record<string, Record<string, number>> = {}
  for (const row of rows) {
    if (!weekendMap[row.weekend_id]) weekendMap[row.weekend_id] = {}
    const current = weekendMap[row.weekend_id][row.session_type] ?? 0
    weekendMap[row.weekend_id][row.session_type] = current + row.points
  }
  return Object.entries(weekendMap).map(([wid, sessionPts]) => {
    const found = weekends.find((w) => w.id === wid)
    const gpName = found ? found.grand_prix : wid.slice(0, 8)
    const sessions = Object.entries(sessionPts).map(([session, points]) => ({ session, points }))
    return { weekendId: wid, gpName, sessions }
  })
}

// Podium trophy icons
function PodiumIcon({ pos }: { pos: number }) {
  if (pos === 1) return <span style={{ fontSize: '1.6rem' }}>🏆</span>
  if (pos === 2) return <span style={{ fontSize: '1.4rem' }}>🥈</span>
  return <span style={{ fontSize: '1.4rem' }}>🥉</span>
}

export default function HomePage() {
  const router = useRouter()
  const [weekends, setWeekends] = useState<Weekend[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [breakdowns, setBreakdowns] = useState<Record<string, BreakdownRow[]>>({})
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [currentUserId, setCurrentUserId] = useState('')
  const [loading, setLoading] = useState(true)
  const configured = isSupabaseConfigured()
  const nextCardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    async function load() {
      if (!supabase) return
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth'); return }
      setCurrentUserId(user.id)

      const [{ data: wData }, { data: lbData }] = await Promise.all([
        supabase.from('race_weekends').select('*').order('season', { ascending: true }).order('round', { ascending: true }),
        supabase.from('leaderboard_totals').select('*').order('total_points', { ascending: false }),
      ])

      setWeekends((wData ?? []) as Weekend[])
      setLeaderboard((lbData ?? []) as LeaderboardRow[])
      setLoading(false)
    }
    load()
  }, [router])

  // Scroll "next" card into view
  useEffect(() => {
    if (nextCardRef.current) {
      nextCardRef.current.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
    }
  }, [weekends])

  const toggleUser = async (userId: string) => {
    if (!supabase) return
    const newSet = new Set(expandedUsers)
    if (newSet.has(userId)) {
      newSet.delete(userId)
    } else {
      newSet.add(userId)
      if (!breakdowns[userId]) {
        const { data } = await supabase
          .from('weekly_breakdown')
          .select('*')
          .eq('user_id', userId)
          .order('weekend_id', { ascending: true })
          .order('session_type', { ascending: true })
          .order('predicted_position', { ascending: true })
        setBreakdowns((prev) => ({ ...prev, [userId]: (data ?? []) as BreakdownRow[] }))
      }
    }
    setExpandedUsers(newSet)
  }

  if (!configured) {
    return (
      <main className="container">
        <div className="card" style={{ marginTop: '2rem' }}>
          <p className="small">Supabase is not configured. Add env vars to get started.</p>
        </div>
      </main>
    )
  }

  if (loading) {
    return (
      <main className="container">
        <p className="small" style={{ marginTop: '2rem' }}>Loading...</p>
      </main>
    )
  }

  const now = Date.now()
  const nextUpcoming = weekends.find((w) => now < new Date(w.race_deadline).getTime())
  const nextUpcomingId = nextUpcoming?.id ?? null

  // Podium = top 3, rest = championship table
  const podium = leaderboard.slice(0, 3)
  const rest   = leaderboard.slice(3)

  // Completed races count for "X of N races" label
  const completedCount = weekends.filter(w => now >= new Date(w.race_deadline).getTime()).length
  const totalRaces = weekends.length

  return (
    <main className="container">

      {/* ── Race Calendar Strip ── */}
      <p className="section-header" style={{ marginBottom: '0.75rem' }}>
        {weekends.length > 0 ? `${weekends[0].season} Season` : 'Race Calendar'}
      </p>

      <div className="race-strip">
        {weekends.length === 0 && <p className="small">No race weekends configured yet.</p>}
        {weekends.map((w) => {
          const status = getRaceStatus(w, nextUpcomingId)
          const isNext = status === 'next'
          const isLive = status === 'live'
          const isCompleted = status === 'completed'

          return (
            <div key={w.id} ref={isNext ? nextCardRef : null} className={`race-card ${status}`}>
              <p className="race-card-round">Round {w.round}</p>
              <p className="race-card-name">{w.grand_prix}</p>
              <p className="race-card-dates">{formatRaceDate(w)}</p>
              <p className={`race-card-status ${status}`}>{getRaceStatusLabel(status)}</p>
              {isCompleted ? (
                <Link href={`/weekly/${w.id}`}>
                  <button className="secondary race-card-btn">View Results</button>
                </Link>
              ) : (
                <Link href={`/picks/${w.id}`}>
                  <button className={`race-card-btn${isLive || isNext ? '' : ' secondary'}`}>
                    {isLive ? 'Pick Now' : 'Make Picks'}
                  </button>
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Pit Wall — Overall Standings ── */}
      {leaderboard.length > 0 && (
        <div className="pitwall-section">
          <div className="pitwall-header">
            <p className="pitwall-title">Championship Standings</p>
            {totalRaces > 0 && (
              <p className="pitwall-subtitle">
                {completedCount} of {totalRaces} races scored
              </p>
            )}
          </div>

          {/* Podium — top 3 */}
          {podium.length > 0 && (
            <div className="pitwall-podium">
              {/* Reorder: P2, P1, P3 for visual podium height */}
              {[podium[1], podium[0], podium[2]].map((row, visualIdx) => {
                if (!row) return null
                const trueIdx = visualIdx === 0 ? 1 : visualIdx === 1 ? 0 : 2
                const isMe = row.user_id === currentUserId
                const isCenter = visualIdx === 1 // P1 is center
                const podiumColors = ['#9ca3af', '#f59e0b', '#cd7c2f'] // silver, gold, bronze
                const color = podiumColors[trueIdx]

                return (
                  <div
                    key={row.user_id}
                    className={`pitwall-podium-card${isCenter ? ' center' : ''}${isMe ? ' is-me' : ''}`}
                    style={{ '--podium-color': color } as React.CSSProperties}
                    onClick={() => toggleUser(row.user_id)}
                  >
                    <div className="pitwall-podium-icon">
                      <PodiumIcon pos={trueIdx + 1} />
                    </div>
                    <div className="pitwall-podium-pos">P{trueIdx + 1}</div>
                    <div className="pitwall-podium-name">
                      {row.display_name || row.user_id.slice(0, 8)}
                      {isMe && <span className="pitwall-you">YOU</span>}
                    </div>
                    <div className="pitwall-podium-pts">{row.total_points}</div>
                    <div className="pitwall-podium-pts-label">pts</div>

                    {/* Breakdown drawer */}
                    {expandedUsers.has(row.user_id) && (
                      <div className="pitwall-podium-breakdown" onClick={e => e.stopPropagation()}>
                        {!breakdowns[row.user_id] && <p style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', textAlign: 'center' }}>Loading...</p>}
                        {breakdowns[row.user_id] && (() => {
                          const grouped = groupBreakdownByWeekend(breakdowns[row.user_id], weekends)
                          if (grouped.length === 0) return <p style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', textAlign: 'center' }}>No scored picks yet.</p>
                          return grouped.map(({ weekendId, gpName, sessions }) => (
                            <div key={weekendId} style={{ marginBottom: '0.5rem' }}>
                              <p style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>{gpName}</p>
                              {sessions.map(({ session, points }) => (
                                <div key={session} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', padding: '0.1rem 0' }}>
                                  <span style={{ color: 'var(--muted)' }}>{SESSION_LABELS[session] ?? session}</span>
                                  <span style={{ fontWeight: 700, color: points > 0 ? 'var(--status-saved)' : points < 0 ? 'var(--brand)' : 'var(--muted)' }}>
                                    {points > 0 ? `+${points}` : points}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ))
                        })()}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Championship table — P4 onwards */}
          {rest.length > 0 && (
            <div className="pitwall-table">
              <div className="pitwall-table-header">
                <span>Pos</span>
                <span>Driver</span>
                <span style={{ textAlign: 'right' }}>Points</span>
                <span style={{ textAlign: 'right' }}>Gap</span>
              </div>
              {rest.map((row, i) => {
                const pos = i + 4
                const isMe = row.user_id === currentUserId
                const isOpen = expandedUsers.has(row.user_id)
                const userBreakdowns = breakdowns[row.user_id]
                const grouped = userBreakdowns ? groupBreakdownByWeekend(userBreakdowns, weekends) : []
                const leader = leaderboard[0]?.total_points ?? 0
                const gap = leader - row.total_points

                return (
                  <div key={row.user_id}>
                    <div
                      className={`pitwall-table-row${isMe ? ' is-me' : ''}`}
                      onClick={() => toggleUser(row.user_id)}
                    >
                      <span className="pitwall-table-pos">{pos}</span>
                      <span className="pitwall-table-name">
                        {row.display_name || row.user_id.slice(0, 8)}
                        {isMe && <span className="pitwall-you">YOU</span>}
                      </span>
                      <span className="pitwall-table-pts">{row.total_points}</span>
                      <span className="pitwall-table-gap">−{gap}</span>
                      <span className={`pitwall-chevron${isOpen ? ' open' : ''}`}>›</span>
                    </div>

                    {isOpen && (
                      <div className="pitwall-breakdown">
                        {!userBreakdowns && <p className="small" style={{ padding: '0.5rem 1rem' }}>Loading...</p>}
                        {userBreakdowns && grouped.length === 0 && <p className="small" style={{ padding: '0.5rem 1rem' }}>No scored picks yet.</p>}
                        {grouped.length > 0 && (
                          <table className="table" style={{ fontSize: 'var(--font-xs)', margin: '0' }}>
                            <thead>
                              <tr>
                                <th>Race</th>
                                <th>Session</th>
                                <th>Pts</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grouped.map(({ weekendId, gpName, sessions }) =>
                                sessions.map(({ session, points }, si) => (
                                  <tr key={`${weekendId}-${session}`}>
                                    <td style={{ color: si === 0 ? 'var(--ink)' : 'transparent', fontWeight: si === 0 ? 600 : 400 }}>
                                      {si === 0 ? gpName : ''}
                                    </td>
                                    <td style={{ color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                      {SESSION_LABELS[session] ?? session}
                                    </td>
                                    <td style={{ fontWeight: 700, color: points > 0 ? 'var(--status-saved)' : points < 0 ? 'var(--brand)' : 'var(--muted)' }}>
                                      {points > 0 ? `+${points}` : points}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {leaderboard.length === 0 && (
        <div className="pitwall-section">
          <p className="pitwall-title">Championship Standings</p>
          <p className="small" style={{ marginTop: '1rem' }}>No scores yet — leaderboard will appear once scoring is run.</p>
        </div>
      )}

    </main>
  )
}
