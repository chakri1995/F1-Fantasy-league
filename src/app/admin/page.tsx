'use client'

import { FormEvent, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function AdminPage() {
  const router = useRouter()
  const [season, setSeason] = useState(new Date().getFullYear())
  const [round, setRound] = useState(1)
  const [weekendId, setWeekendId] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    async function ensureUser() {
      if (!supabase) return
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) router.push('/auth')
    }

    ensureUser()
  }, [router])

  async function callApi(path: string, payload: Record<string, unknown>) {
    if (!supabase) return
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const token = session?.access_token
    if (!token) {
      setStatus('Login required')
      return
    }

    setStatus('Running...')

    const response = await fetch(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as { message?: string; error?: string; synced?: number; scored?: number }

    if (!response.ok) {
      setStatus(data.error ?? 'Action failed')
      return
    }

    setStatus(data.message ?? `Done. synced=${data.synced ?? 0} scored=${data.scored ?? 0}`)
  }

  async function syncResults(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await callApi('/api/admin/sync', { season, round })
  }

  async function scoreWeekend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    await callApi('/api/admin/score', { weekendId })
  }

  return (
    <main className="container">
      <div className="nav">
        <h1>Admin Console</h1>
        <div className="nav-links">
          <Link href="/dashboard" className="small">Dashboard</Link>
        </div>
      </div>

      <div className="grid two">
        <form className="card" onSubmit={syncResults}>
          <h2>Sync Official Results</h2>
          <p className="small" style={{ marginTop: '0.4rem' }}>
            Source: api.jolpi.ca (Ergast-compatible)
          </p>

          <div style={{ marginTop: '0.8rem' }}>
            <label>Season</label>
            <input
              type="number"
              value={season}
              onChange={(e) => setSeason(Number(e.target.value))}
              min={2020}
              max={2100}
              required
            />
          </div>

          <div style={{ marginTop: '0.8rem' }}>
            <label>Round</label>
            <input
              type="number"
              value={round}
              onChange={(e) => setRound(Number(e.target.value))}
              min={1}
              max={30}
              required
            />
          </div>

          <button style={{ marginTop: '0.8rem' }} type="submit">
            Sync Quali + Sprint‑Quali + Sprint + Race
          </button>
        </form>

        <form className="card" onSubmit={scoreWeekend}>
          <h2>Run Scoring</h2>
          <p className="small" style={{ marginTop: '0.4rem' }}>
            Re-run after steward penalties to refresh points.
          </p>

          <div style={{ marginTop: '0.8rem' }}>
            <label>Weekend ID</label>
            <input
              value={weekendId}
              onChange={(e) => setWeekendId(e.target.value)}
              placeholder="UUID from race_weekends"
              required
            />
          </div>

          <button style={{ marginTop: '0.8rem' }} type="submit">
            Compute Scores
          </button>
        </form>
      </div>

      {status && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <p className="small">{status}</p>
        </div>
      )}
    </main>
  )
}
