'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
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

function formatWeekendDates(w: Weekend): string {
  const start = new Date(w.qualifying_deadline)
  const end = new Date(w.race_deadline)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`
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

export default function HomePage() {
  const router = useRouter()
  const [weekends, setWeekends] = useState<Weekend[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [breakdowns, setBreakdowns] = useState<Record<string, BreakdownRow[]>>({})
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const configured = isSupabaseConfigured()

  useEffect(() => {
    async function load() {
      if (!supabase) return
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth')
        return
      }

      const [{ data: wData }, { data: lbData }] = await Promise.all([
        supabase
          .from('race_weekends')
          .select('*')
          .order('season', { ascending: true })
          .order('round', { ascending: true }),
        supabase.from('leaderboard_totals').select('*').order('total_points', { ascending: false }),
      ])

      setWeekends((wData ?? []) as Weekend[])
      setLeaderboard((lbData ?? []) as LeaderboardRow[])
      setLoading(false)
    }

    load()
  }, [router])

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

  return (
    <main className="container">

      {/* ── Race Cards Strip ── */}
      <p className="section-header" style={{ marginBottom: '0.75rem' }}>Race Calendar</p>
      <div className="race-strip">
        {weekends.length === 0 && (
          <p className="small">No race weekends configured yet.</p>
        )}
        {weekends.map((w) => {
          const completed = Date.now() >= new Date(w.race_deadline).getTime()
          return (
            <div key={w.id} className={`race-card ${completed ? 'completed' : 'upcoming'}`}>
              <p className="race-card-round">
                {w.season} · Round {w.round}
              </p>
              <p className="race-card-name">{w.grand_prix}</p>
              <p className="race-card-dates">{formatWeekendDates(w)}</p>
              <p className={`race-card-status ${completed ? 'completed' : 'upcoming'}`}>
                {completed ? '✓ Completed' : '● Upcoming'}
              </p>
              {completed ? (
                <Link href={`/weekly/${w.id}`}>
                  <button className="secondary race-card-btn">View Results</button>
                </Link>
              ) : (
                <Link href={`/picks/${w.id}`}>
                  <button className="race-card-btn">Make Picks</button>
                </Link>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Overall Standings ── */}
      <div className="leaderboard-section">
        <p className="leaderboard-section-title">Overall Standings</p>

        {leaderboard.length === 0 && (
          <p className="small">No scores yet — leaderboard will appear once scoring is run.</p>
        )}

        {leaderboard.map((row, idx) => {
          const isOpen = expandedUsers.has(row.user_id)
          const userBreakdowns = breakdowns[row.user_id]
          const grouped = userBreakdowns ? groupBreakdownByWeekend(userBreakdowns, weekends) : []

          return (
            <div key={row.user_id}>
              <div
                className="leaderboard-row"
                onClick={() => toggleUser(row.user_id)}
              >
                <span className={`leaderboard-rank${idx < 3 ? ' top-3' : ''}`}>
                  {idx + 1}
                </span>
                <span className="leaderboard-name">
                  {row.display_name || row.user_id.slice(0, 8)}
                </span>
                <span className="leaderboard-points">{row.total_points}</span>
                <span className="leaderboard-pts-label">pts</span>
                <span className={`leaderboard-chevron${isOpen ? ' open' : ''}`}>›</span>
              </div>

              {isOpen && (
                <div className="leaderboard-breakdown">
                  <div className="leaderboard-breakdown-inner">
                    {!userBreakdowns && (
                      <p className="small">Loading...</p>
                    )}
                    {userBreakdowns && grouped.length === 0 && (
                      <p className="small">No scored picks yet.</p>
                    )}
                    {grouped.length > 0 && (
                      <table className="table" style={{ fontSize: 'var(--font-xs)' }}>
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
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}
