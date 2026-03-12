'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'
import type { Weekend } from '@/lib/types'

interface LeaderboardRow {
  user_id: string
  display_name: string
  total_points: number
}

interface BreakdownRow {
  weekend_id: string
  session_type: string
  predicted_position: number
  actual_position: number | null
  points: number
  penalty_reason: string | null
  driver_name: string
}

export default function HomePage() {
  const [email, setEmail] = useState<string>('')
  const [weekends, setWeekends] = useState<Weekend[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [breakdowns, setBreakdowns] = useState<Record<string, BreakdownRow[]>>({})
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set())
  const configured = isSupabaseConfigured()

  useEffect(() => {
    async function load() {
      if (!supabase) return
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setEmail(user?.email ?? '')

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
    }

    load()
  }, [])

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

  return (
    <main className="container">
      <nav className="nav" style={{ marginBottom: '1rem' }}>
        <Link href="/rules" className="small" style={{ marginRight: '1rem' }}>
          Rules
        </Link>
        <Link href="/dashboard" className="small">
          Dashboard
        </Link>
      </nav>

      <div style={{ overflowX: 'auto', display: 'flex', gap: '1rem', padding: '1rem 0' }}>
        {weekends.map((w) => {
          const completed = Date.now() >= new Date(w.race_deadline).getTime()
          return (
            <div
              key={w.id}
              className="card"
              style={{ minWidth: '200px', flex: '0 0 auto', padding: '0.8rem' }}
            >
              <p>
                {w.season} Round {w.round}
              </p>
              <p>{w.grand_prix}</p>
              <p className="small">{completed ? 'Completed' : 'Upcoming'}</p>
              {completed ? (
                <Link href={`/weekly/${w.id}`}>
                  <button className="small">View Results</button>
                </Link>
              ) : (
                <Link href={`/picks/${w.id}`}>
                  <button className="small">Make Picks</button>
                </Link>
              )}
            </div>
          )
        })}
      </div>

      <h2>Leaderboard</h2>
      <table className="table" style={{ marginTop: '0.6rem' }}>
        <thead>
          <tr>
            <th>#</th>
            <th>Player</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((row, idx) => (
            <>
              <tr
                key={row.user_id}
                onClick={() => toggleUser(row.user_id)}
                style={{ cursor: 'pointer' }}
              >
                <td>{idx + 1}</td>
                <td>{row.display_name || row.user_id.slice(0, 8)}</td>
                <td>{row.total_points}</td>
              </tr>
              {expandedUsers.has(row.user_id) && (
                <tr>
                  <td colSpan={3} style={{ padding: '0' }}>
                    <table className="table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>Weekend</th>
                          <th>Session</th>
                          <th>Pred</th>
                          <th>Actual</th>
                          <th>Driver</th>
                          <th>Penalty</th>
                          <th>Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(breakdowns[row.user_id] || []).map((b, i) => (
                          <tr key={i}>
                            <td>{b.weekend_id}</td>
                            <td>{b.session_type}</td>
                            <td>{b.predicted_position}</td>
                            <td>{b.actual_position ?? '-'}</td>
                            <td>{b.driver_name}</td>
                            <td>{b.penalty_reason ?? '-'}</td>
                            <td>{b.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )}
            </>
          ))}
          {leaderboard.length === 0 && (
            <tr>
              <td colSpan={3} className="small">
                No scores yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  )
}
