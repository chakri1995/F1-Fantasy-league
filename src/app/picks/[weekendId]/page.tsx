'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { Driver, Weekend } from '@/lib/types'
import type { SessionType } from '@/lib/scoring'

const SESSION_RULES: Record<SessionType, { size: number; label: string }> = {
  qualifying: { size: 3, label: 'Qualifying Top 3' },
  sprint: { size: 5, label: 'Sprint Top 5' },
  race: { size: 10, label: 'Race Top 10' },
}

function buildDefault(size: number): string[] {
  return Array.from({ length: size }, () => '')
}

export default function PicksPage() {
  const params = useParams<{ weekendId: string }>()
  const router = useRouter()
  const weekendId = params.weekendId

  const [drivers, setDrivers] = useState<Driver[]>([])
  const [weekend, setWeekend] = useState<Weekend | null>(null)
  const [qualifyingPicks, setQualifyingPicks] = useState<string[]>(buildDefault(3))
  const [sprintPicks, setSprintPicks] = useState<string[]>(buildDefault(5))
  const [racePicks, setRacePicks] = useState<string[]>(buildDefault(10))
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

      const [{ data: driversData }, { data: weekendData, error: weekendError }, { data: picksData, error: picksError }] =
        await Promise.all([
          supabase.from('drivers').select('*').order('number', { ascending: true }),
          supabase.from('race_weekends').select('*').eq('id', weekendId).single(),
          supabase
            .from('picks')
            .select('*')
            .eq('weekend_id', weekendId)
            .eq('user_id', user.id)
            .order('predicted_position', { ascending: true }),
        ])

      if (weekendError) {
        setStatus(weekendError.message)
        return
      }

      if (picksError) {
        setStatus(picksError.message)
        return
      }

      setDrivers((driversData ?? []) as Driver[])
      setWeekend(weekendData as Weekend)

      const q = buildDefault(3)
      const s = buildDefault(5)
      const r = buildDefault(10)

      for (const pick of picksData ?? []) {
        const target =
          pick.session_type === 'qualifying' ? q : pick.session_type === 'sprint' ? s : pick.session_type === 'race' ? r : null

        if (!target) continue
        const idx = pick.predicted_position - 1
        if (idx >= 0 && idx < target.length) {
          target[idx] = pick.driver_id
        }
      }

      setQualifyingPicks(q)
      setSprintPicks(s)
      setRacePicks(r)
      setStatus('')
    }

    load()
  }, [router, weekendId])

  const locks = useMemo(() => {
    if (!weekend) {
      return { qualifying: true, sprint: true, race: true }
    }

    const now = Date.now()
    return {
      qualifying: now >= new Date(weekend.qualifying_deadline).getTime(),
      sprint: now >= new Date(weekend.sprint_deadline).getTime(),
      race: now >= new Date(weekend.race_deadline).getTime(),
    }
  }, [weekend])

  function updatePick(session: SessionType, position: number, driverId: string) {
    const index = position - 1
    if (session === 'qualifying') {
      const next = [...qualifyingPicks]
      next[index] = driverId
      setQualifyingPicks(next)
      return
    }

    if (session === 'sprint') {
      const next = [...sprintPicks]
      next[index] = driverId
      setSprintPicks(next)
      return
    }

    const next = [...racePicks]
    next[index] = driverId
    setRacePicks(next)
  }

  function getSessionPicks(session: SessionType): string[] {
    if (session === 'qualifying') return qualifyingPicks
    if (session === 'sprint') return sprintPicks
    return racePicks
  }

  function validateUnique(picks: string[]): boolean {
    const chosen = picks.filter(Boolean)
    return new Set(chosen).size === chosen.length
  }

  async function saveSession(session: SessionType) {
    if (!supabase || !weekend) return

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth')
      return
    }

    const picks = getSessionPicks(session)
    if (picks.some((item) => !item)) {
      setStatus(`Complete all ${SESSION_RULES[session].size} picks for ${session}.`)
      return
    }

    if (!validateUnique(picks)) {
      setStatus(`Each driver can be selected only once for ${session}.`)
      return
    }

    const lock =
      session === 'qualifying'
        ? new Date(weekend.qualifying_deadline).getTime()
        : session === 'sprint'
        ? new Date(weekend.sprint_deadline).getTime()
        : new Date(weekend.race_deadline).getTime()

    if (Date.now() >= lock) {
      setStatus(`${session} picks are locked.`)
      return
    }

    const payload = picks.map((driverId, index) => ({
      weekend_id: weekend.id,
      user_id: user.id,
      session_type: session,
      predicted_position: index + 1,
      driver_id: driverId,
    }))

    const { error } = await supabase.from('picks').upsert(payload, {
      onConflict: 'weekend_id,user_id,session_type,predicted_position',
    })

    setStatus(error ? error.message : `${session} picks saved.`)
  }

  function renderSession(session: SessionType) {
    const config = SESSION_RULES[session]
    const picks = getSessionPicks(session)

    return (
      <div className="card" key={session}>
        <h2>{config.label}</h2>
        <p className="small" style={{ marginTop: '0.35rem' }}>
          Lock: {new Date(
            session === 'qualifying'
              ? weekend?.qualifying_deadline ?? ''
              : session === 'sprint'
              ? weekend?.sprint_deadline ?? ''
              : weekend?.race_deadline ?? '',
          ).toLocaleString()}
        </p>

        <div style={{ marginTop: '0.75rem' }}>
          {Array.from({ length: config.size }, (_, i) => (
            <div className="grid two" key={`${session}-${i + 1}`} style={{ marginBottom: '0.55rem' }}>
              <div className="small" style={{ alignSelf: 'center' }}>Position {i + 1}</div>
              <select
                value={picks[i]}
                onChange={(event) => updatePick(session, i + 1, event.target.value)}
                disabled={locks[session]}
              >
                <option value="">Select driver</option>
                {drivers.map((driver) => (
                  <option value={driver.id} key={`${session}-${driver.id}`}>
                    #{driver.number} {driver.full_name} ({driver.team_name})
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <button disabled={locks[session]} onClick={() => saveSession(session)}>
          {locks[session] ? 'Locked' : `Save ${session}`}
        </button>
      </div>
    )
  }

  return (
    <main className="container">
      <div className="nav">
        <div>
          <h1>Race Picks</h1>
          <p className="small" style={{ marginTop: '0.35rem' }}>
            {weekend ? `${weekend.season} Round ${weekend.round} - ${weekend.grand_prix}` : 'Loading weekend...'}
          </p>
        </div>
        <div className="nav-links">
          <Link href="/dashboard" className="small">Dashboard</Link>
        </div>
      </div>

      {status && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="small">{status}</p>
        </div>
      )}

      <div className="grid">
        {renderSession('qualifying')}
        {renderSession('sprint')}
        {renderSession('race')}
      </div>
    </main>
  )
}
