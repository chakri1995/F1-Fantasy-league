'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { Weekend } from '@/lib/types'

interface LeaderboardRow {
  user_id: string
  display_name: string
  total_points: number
}

interface PickCount {
  session_type: 'qualifying' | 'sprint' | 'race'
  count: number
}

export default function DashboardPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [weekends, setWeekends] = useState<Weekend[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [pickCounts, setPickCounts] = useState<PickCount[]>([])
  const [userId, setUserId] = useState<string>('')
  const [status, setStatus] = useState('Loading...')

  const nextWeekend = useMemo(() => weekends[0], [weekends])

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

      setUserId(user.id)
      setEmail(user.email ?? '')

      const [{ data: weekendData, error: weekendError }, { data: boardData }, { data: profileData }] =
        await Promise.all([
          supabase
            .from('race_weekends')
            .select('*')
            .gte('race_deadline', new Date().toISOString())
            .order('season', { ascending: true })
            .order('round', { ascending: true })
            .limit(5),
          supabase
            .from('leaderboard_totals')
            .select('*')
            .order('total_points', { ascending: false })
            .limit(10),
          supabase
            .from('profiles')
            .select('display_name')
            .eq('id', user.id)
            .maybeSingle(),
        ])

      if (weekendError) {
        setStatus(weekendError.message)
      } else {
        setStatus('')
      }

      const activeWeekends = weekendData ?? []
      setWeekends(activeWeekends)
      setLeaderboard((boardData ?? []) as LeaderboardRow[])

      if (profileData?.display_name) {
        setEmail(profileData.display_name)
      }

      if (activeWeekends.length > 0) {
        const { data: picksData } = await supabase
          .from('picks')
          .select('session_type, id')
          .eq('weekend_id', activeWeekends[0].id)
          .eq('user_id', user.id)

        const grouped: PickCount[] = [
          { session_type: 'qualifying', count: 0 },
          { session_type: 'sprint', count: 0 },
          { session_type: 'race', count: 0 },
        ]

        for (const pick of picksData ?? []) {
          const target = grouped.find((item) => item.session_type === pick.session_type)
          if (target) {
            target.count += 1
          }
        }

        setPickCounts(grouped)
      }
    }

    load()
  }, [router])

  async function logout() {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <main className="container">
      <div className="nav">
        <div>
          <h1>League Dashboard</h1>
          <p className="small" style={{ marginTop: '0.35rem' }}>
            Signed in as {email || userId}
          </p>
        </div>
        <div className="nav-links">
          <Link href="/admin" className="small">Admin</Link>
          <button className="secondary" style={{ width: 'auto' }} onClick={logout}>Logout</button>
        </div>
      </div>

      {status && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="small">{status}</p>
        </div>
      )}

      <div className="grid two">
        <div className="card">
          <h2>Next Session Window</h2>
          {!nextWeekend && <p className="small" style={{ marginTop: '0.6rem' }}>No weekend configured yet.</p>}
          {nextWeekend && (
            <>
              <p style={{ marginTop: '0.6rem', fontWeight: 600 }}>
                {nextWeekend.season} Round {nextWeekend.round}: {nextWeekend.grand_prix}
              </p>
              <p className="small" style={{ marginTop: '0.4rem' }}>
                Quali lock: {new Date(nextWeekend.qualifying_deadline).toLocaleString()}
              </p>
              <p className="small">Sprint lock: {new Date(nextWeekend.sprint_deadline).toLocaleString()}</p>
              <p className="small">Race lock: {new Date(nextWeekend.race_deadline).toLocaleString()}</p>

              <div className="grid three" style={{ marginTop: '0.8rem' }}>
                {pickCounts.map((item) => (
                  <div key={item.session_type} className="card" style={{ padding: '0.7rem' }}>
                    <p className="small">{item.session_type}</p>
                    <h3 style={{ marginTop: '0.3rem' }}>{item.count}</h3>
                  </div>
                ))}
              </div>

              <div className="grid two" style={{ marginTop: '0.8rem' }}>
                <Link href={`/picks/${nextWeekend.id}`}>
                  <button>Set Picks</button>
                </Link>
                <Link href={`/weekly/${nextWeekend.id}`}>
                  <button className="secondary">Weekly Breakdown</button>
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="card">
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
              {leaderboard.map((row, index) => (
                <tr key={row.user_id}>
                  <td>{index + 1}</td>
                  <td>{row.display_name || row.user_id.slice(0, 8)}</td>
                  <td>{row.total_points}</td>
                </tr>
              ))}
              {leaderboard.length === 0 && (
                <tr>
                  <td colSpan={3} className="small">No scores yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
