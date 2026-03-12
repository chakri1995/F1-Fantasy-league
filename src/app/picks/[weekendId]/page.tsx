'use client'

import Link from 'next/link'
import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { Driver, Weekend } from '@/lib/types'
import type { SessionType } from '@/lib/scoring'

const SESSION_RULES: Record<SessionType, { size: number; label: string }> = {
  qualifying: { size: 3, label: 'Qualifying Top 3' },
  sprint_qualifying: { size: 3, label: 'Sprint Qualifying Top 3' },
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
  const [sprintQualifyingPicks, setSprintQualifyingPicks] = useState<string[]>(buildDefault(3))
  const [sprintPicks, setSprintPicks] = useState<string[]>(buildDefault(5))
  const [racePicks, setRacePicks] = useState<string[]>(buildDefault(10))
  const [status, setStatus] = useState('Loading...')
  const [email, setEmail] = useState<string>('')

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

      setEmail(user?.email ?? '')

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
      const sq = buildDefault(3)
      const s = buildDefault(5)
      const r = buildDefault(10)

      for (const pick of picksData ?? []) {
        let target: string[] | null = null
        if (pick.session_type === 'qualifying') target = q
        else if (pick.session_type === 'sprint_qualifying') target = sq
        else if (pick.session_type === 'sprint') target = s
        else if (pick.session_type === 'race') target = r

        if (!target) continue
        const idx = pick.predicted_position - 1
        if (idx >= 0 && idx < target.length) {
          target[idx] = pick.driver_id
        }
      }

      setQualifyingPicks(q)
      setSprintQualifyingPicks(sq)
      setSprintPicks(s)
      setRacePicks(r)
      setStatus('')
    }

    load()
  }, [router, weekendId])

  const locks = useMemo(() => {
    if (!weekend) {
      return { qualifying: true, sprint_qualifying: true, sprint: true, race: true }
    }

    const now = Date.now()
    return {
      qualifying: now >= new Date(weekend.qualifying_deadline).getTime(),
      sprint_qualifying: now >= new Date(weekend.sprint_qualifying_deadline ?? weekend.sprint_deadline).getTime(),
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

    if (session === 'sprint_qualifying') {
      const next = [...sprintQualifyingPicks]
      next[index] = driverId
      setSprintQualifyingPicks(next)
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
    if (session === 'sprint_qualifying') return sprintQualifyingPicks
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
        : session === 'sprint_qualifying'
        ? new Date(weekend.sprint_qualifying_deadline ?? weekend.sprint_deadline).getTime()
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

  function getAvailableDrivers(session: SessionType) {
    const taken = new Set(getSessionPicks(session).filter(Boolean))
    return drivers.filter((d) => !taken.has(d.id))
  }

  function renderSession(session: SessionType) {
    const config = SESSION_RULES[session]
    const picks = getSessionPicks(session)
    const pool = getAvailableDrivers(session)

    const onDragStart = (event: React.DragEvent, driverId: string, origin?: 'pool' | 'slot', idx?: number) => {
      event.dataTransfer.setData('text/plain', JSON.stringify({ driverId, origin, idx }))
    }
    const onDropSlot = (event: React.DragEvent, slotIdx: number) => {
      event.preventDefault()
      const data = event.dataTransfer.getData('text/plain')
      if (!data) return
      const { driverId, origin, idx } = JSON.parse(data)
      if (origin === 'slot' && idx === slotIdx) return
      if (origin === 'slot' && typeof idx === 'number') {
        const sourcePicks = getSessionPicks(session)
        updatePick(session, slotIdx + 1, sourcePicks[idx])
        updatePick(session, idx + 1, '')
        return
      }
      updatePick(session, slotIdx + 1, driverId)
    }
    const allowDrop = (event: React.DragEvent) => event.preventDefault()

    const getDriverName = (driverId: string) => {
      const d = drivers.find((x) => x.id === driverId)
      return d?.full_name || driverId
    }

    return (
      <div className="card" key={session}>
        <h2>{config.label}</h2>
        <p className="small" style={{ marginTop: '0.35rem' }}>
          Lock:{' '}
          {new Date(
            session === 'qualifying'
              ? weekend?.qualifying_deadline ?? ''
              : session === 'sprint_qualifying'
              ? weekend?.sprint_qualifying_deadline ?? weekend?.sprint_deadline ?? ''
              : session === 'sprint'
              ? weekend?.sprint_deadline ?? ''
              : weekend?.race_deadline ?? '',
          ).toLocaleString()}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem', marginTop: '1rem' }}>
          <div>
            <h3 className="small" style={{ marginBottom: '0.5rem' }}>Available</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {pool.map((d) => (
                <div
                  key={d.id}
                  draggable={!locks[session]}
                  onDragStart={(e) => onDragStart(e, d.id, 'pool')}
                  style={{
                    padding: '0.4rem 0.5rem',
                    background: '#f0f0f0',
                    borderRadius: '4px',
                    cursor: !locks[session] ? 'grab' : 'default',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    minWidth: '40px',
                    textAlign: 'center',
                  }}
                  title={d.full_name}
                >
                  #{d.number}
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="small" style={{ marginBottom: '0.5rem' }}>Positions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.5rem' }}>
              {Array.from({ length: config.size }, (_, i) => (
                <div
                  key={i}
                  onDragOver={allowDrop}
                  onDrop={(e) => onDropSlot(e, i)}
                  draggable={!!picks[i] && !locks[session]}
                  onDragStart={(e) => picks[i] && onDragStart(e, picks[i], 'slot', i)}
                  style={{
                    padding: '0.6rem',
                    border: '2px dashed #ccc',
                    borderRadius: '4px',
                    minHeight: '80px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    textAlign: 'center',
                    cursor: picks[i] ? 'grab' : 'drop',
                    background: picks[i] ? '#e8f5e9' : '#fafafa',
                  }}
                >
                  <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.25rem 0' }}>P{i + 1}</p>
                  {picks[i] ? (
                    <p style={{ fontSize: '0.75rem', margin: 0 }}>{getDriverName(picks[i])}</p>
                  ) : (
                    <p style={{ fontSize: '0.7rem', color: '#999', margin: 0 }}>drag here</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <button disabled={locks[session]} onClick={() => saveSession(session)} style={{ marginTop: '1rem' }}>
          {locks[session] ? 'Locked' : `Save ${session}`}
        </button>
      </div>
    )
  }

  async function logout() {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/auth')
  }

  return (
    <main className="container">
      <div className="nav" style={{ marginBottom: '1rem', gap: '1rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>Make Picks</h2>
          <p className="small" style={{ margin: '0.25rem 0 0 0' }}>{email}</p>
        </div>
        <div className="nav-links">
          <Link href="/" className="small">Home</Link>
          <Link href="/rules" className="small">Rules</Link>
          <button className="secondary" style={{ width: 'auto' }} onClick={logout}>Logout</button>
        </div>
      </div>

      {status && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <p className="small">{status}</p>
        </div>
      )}

      <div className="grid">
        {renderSession('qualifying')}
        {renderSession('sprint_qualifying')}
        {renderSession('sprint')}
        {renderSession('race')}
      </div>
    </main>
  )
}
