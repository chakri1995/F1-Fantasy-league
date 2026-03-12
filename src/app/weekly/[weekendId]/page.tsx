'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface EventRow {
  session_type: 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race'
  predicted_position: number
  actual_position: number | null
  points: number
  penalty_reason: string | null
  driver_name: string
}

interface SessionSummary {
  session_type: 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race'
  points: number
}

export default function WeeklyBreakdownPage() {
  const { weekendId } = useParams<{ weekendId: string }>()
  const router = useRouter()
  const [rows, setRows] = useState<EventRow[]>([])
  const [status, setStatus] = useState('Loading...')

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

      const { data, error } = await supabase
        .from('weekly_breakdown')
        .select('*')
        .eq('weekend_id', weekendId)
        .eq('user_id', user.id)
        .order('session_type', { ascending: true })
        .order('predicted_position', { ascending: true })

      if (error) {
        setStatus(error.message)
        return
      }

      setRows((data ?? []) as EventRow[])
      setStatus('')
    }

    load()
  }, [router, weekendId])

  const summary = useMemo(() => {
    const base: SessionSummary[] = [
      { session_type: 'qualifying', points: 0 },
      { session_type: 'sprint_qualifying', points: 0 },
      { session_type: 'sprint', points: 0 },
      { session_type: 'race', points: 0 },
    ]

    for (const row of rows) {
      const target = base.find((item) => item.session_type === row.session_type)
      if (target) target.points += row.points
    }

    return base
  }, [rows])

  return (
    <main className="container">
      <div className="nav">
        <h1>Weekly Breakdown</h1>
        <div className="nav-links">
          <Link href="/dashboard" className="small">Dashboard</Link>
        </div>
      </div>

      {status && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="small">{status}</p>
        </div>
      )}

      <div className="grid three" style={{ marginBottom: '1rem' }}>
        {summary.map((item) => (
          <div className="card" key={item.session_type}>
            <p className="small">{item.session_type}</p>
            <h2 style={{ marginTop: '0.35rem' }}>{item.points}</h2>
          </div>
        ))}
      </div>

      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Session</th>
              <th>Driver</th>
              <th>Pred</th>
              <th>Actual</th>
              <th>Penalty</th>
              <th>Points</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={`${row.session_type}-${row.driver_name}-${idx}`}>
                <td>{row.session_type}</td>
                <td>{row.driver_name}</td>
                <td>{row.predicted_position}</td>
                <td>{row.actual_position ?? '-'}</td>
                <td>{row.penalty_reason ?? '-'}</td>
                <td>{row.points}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="small">
                  No scoring rows yet. Ask admin to run session sync and scoring.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
