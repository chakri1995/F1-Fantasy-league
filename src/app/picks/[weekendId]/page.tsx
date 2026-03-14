'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import type { Driver, Weekend } from '@/lib/types'
import type { SessionType } from '@/lib/scoring'

const SESSION_RULES: Record<SessionType, { size: number; label: string }> = {
  qualifying: { size: 3, label: 'Qualifying' },
  sprint_qualifying: { size: 3, label: 'Sprint Quali' },
  sprint: { size: 5, label: 'Sprint' },
  race: { size: 10, label: 'Race' },
}

const SESSION_ORDER: SessionType[] = ['qualifying', 'sprint_qualifying', 'sprint', 'race']

const TEAM_COLORS: Record<string, string> = {
  'Red Bull Racing': '#3671C6',
  Ferrari: '#E8002D',
  McLaren: '#FF8000',
  Mercedes: '#00A19C',
  'Aston Martin': '#00594F',
  Alpine: '#0093CC',
  Williams: '#00A0DD',
  Haas: '#B6BABD',
  Sauber: '#00CF46',
  'Racing Bulls': '#1434CB',
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

  const [activeSession, setActiveSession] = useState<SessionType>('qualifying')
  const [savedSessions, setSavedSessions] = useState<Set<SessionType>>(new Set())
  const [unsavedSessions, setUnsavedSessions] = useState<Set<SessionType>>(new Set())
  const [status, setStatus] = useState('Loading...')
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)

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

      const [
        { data: driversData },
        { data: weekendData, error: weekendError },
        { data: picksData, error: picksError },
      ] = await Promise.all([
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
        if (idx >= 0 && idx < target.length) target[idx] = pick.driver_id
      }

      setQualifyingPicks(q)
      setSprintQualifyingPicks(sq)
      setSprintPicks(s)
      setRacePicks(r)

      // Mark sessions that already have complete picks as saved
      const initialSaved = new Set<SessionType>()
      if (q.every(Boolean)) initialSaved.add('qualifying')
      if (sq.every(Boolean)) initialSaved.add('sprint_qualifying')
      if (s.every(Boolean)) initialSaved.add('sprint')
      if (r.every(Boolean)) initialSaved.add('race')
      setSavedSessions(initialSaved)

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

  function getSessionPicks(session: SessionType): string[] {
    if (session === 'qualifying') return qualifyingPicks
    if (session === 'sprint_qualifying') return sprintQualifyingPicks
    if (session === 'sprint') return sprintPicks
    return racePicks
  }

  function setSessionPicks(session: SessionType, picks: string[]) {
    if (session === 'qualifying') setQualifyingPicks(picks)
    else if (session === 'sprint_qualifying') setSprintQualifyingPicks(picks)
    else if (session === 'sprint') setSprintPicks(picks)
    else setRacePicks(picks)
  }

  function updatePick(session: SessionType, position: number, driverId: string) {
    const next = [...getSessionPicks(session)]
    next[position - 1] = driverId
    setSessionPicks(session, next)
    setUnsavedSessions((prev) => new Set(prev).add(session))
    setSavedSessions((prev) => {
      const n = new Set(prev)
      n.delete(session)
      return n
    })
  }

  function getAvailableDrivers(session: SessionType) {
    const taken = new Set(getSessionPicks(session).filter(Boolean))
    return drivers.filter((d) => !taken.has(d.id))
  }

  function getDriverById(driverId: string) {
    return drivers.find((d) => d.id === driverId)
  }

  function getDriverCode(driverId: string) {
    return getDriverById(driverId)?.code ?? '?'
  }

  function getDriverLastName(driverId: string) {
    const name = getDriverById(driverId)?.full_name ?? ''
    return name.split(' ').slice(1).join(' ') || name
  }

  function validateUnique(picks: string[]): boolean {
    const chosen = picks.filter(Boolean)
    return new Set(chosen).size === chosen.length
  }

  function getDeadline(session: SessionType): number {
    if (!weekend) return 0
    if (session === 'qualifying') return new Date(weekend.qualifying_deadline).getTime()
    if (session === 'sprint_qualifying') return new Date(weekend.sprint_qualifying_deadline ?? weekend.sprint_deadline).getTime()
    if (session === 'sprint') return new Date(weekend.sprint_deadline).getTime()
    return new Date(weekend.race_deadline).getTime()
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
      setStatus(`Fill all ${SESSION_RULES[session].size} positions for ${SESSION_RULES[session].label}.`)
      return
    }

    if (!validateUnique(picks)) {
      setStatus(`Each driver can only be picked once per session.`)
      return
    }

    if (Date.now() >= getDeadline(session)) {
      setStatus(`${SESSION_RULES[session].label} picks are locked.`)
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

    if (error) {
      setStatus(error.message)
    } else {
      setStatus('')
      setSavedSessions((prev) => new Set(prev).add(session))
      setUnsavedSessions((prev) => {
        const n = new Set(prev)
        n.delete(session)
        return n
      })
    }
  }

  // ── Drag and drop handlers ──
  const onDragStart = (event: React.DragEvent, driverId: string, origin: 'pool' | 'slot', idx?: number) => {
    event.dataTransfer.setData('text/plain', JSON.stringify({ driverId, origin, idx }))
    event.dataTransfer.effectAllowed = 'move'
  }

  const onDropSlot = (event: React.DragEvent, slotIdx: number) => {
    event.preventDefault()
    setDragOverSlot(null)
    const data = event.dataTransfer.getData('text/plain')
    if (!data) return
    const { driverId, origin, idx } = JSON.parse(data) as { driverId: string; origin: string; idx?: number }
    if (locks[activeSession]) return

    const picks = [...getSessionPicks(activeSession)]

    if (origin === 'slot' && typeof idx === 'number') {
      if (idx === slotIdx) return
      // Swap: put dragged driver into new slot, clear old slot
      const displaced = picks[slotIdx]
      picks[slotIdx] = picks[idx]
      picks[idx] = displaced
    } else {
      // From pool: if slot already has a driver, clear it (goes back to pool)
      picks[slotIdx] = driverId
    }

    setSessionPicks(activeSession, picks)
    setUnsavedSessions((prev) => new Set(prev).add(activeSession))
    setSavedSessions((prev) => {
      const n = new Set(prev)
      n.delete(activeSession)
      return n
    })
  }

  const allowDrop = (event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }

  function renderSession(session: SessionType) {
    const config = SESSION_RULES[session]
    const picks = getSessionPicks(session)
    const pool = getAvailableDrivers(session)
    const isLocked = locks[session]

    const deadlineStr = new Date(getDeadline(session)).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    return (
      <div>
        {/* Save status + deadline */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <p className="small">Lock: {deadlineStr}</p>
          {isLocked ? (
            <span className="save-indicator locked">&#128274; Locked</span>
          ) : savedSessions.has(session) ? (
            <span className="save-indicator saved">&#10003; Saved</span>
          ) : unsavedSessions.has(session) ? (
            <span className="save-indicator unsaved">&#9679; Unsaved</span>
          ) : (
            <span className="save-indicator unsaved">Not saved</span>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
          {/* Available drivers pool */}
          <div>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem', fontWeight: 700 }}>
              Available ({pool.length})
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
              {pool.map((d) => (
                <div
                  key={d.id}
                  draggable={!isLocked}
                  onDragStart={(e) => onDragStart(e, d.id, 'pool')}
                  className={`driver-tile${isLocked ? ' locked' : ''}`}
                  style={{ '--team-color': TEAM_COLORS[d.team_name] ?? '#444' } as React.CSSProperties}
                  title={d.full_name}
                >
                  <span className="driver-code">{d.code}</span>
                  <span className="driver-name-sm">{getDriverLastName(d.id)}</span>
                </div>
              ))}
              {pool.length === 0 && (
                <p className="small">All drivers placed</p>
              )}
            </div>
          </div>

          {/* Position slots */}
          <div>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.6rem', fontWeight: 700 }}>
              Your Picks — {config.label} Top {config.size}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: '0.5rem' }}>
              {Array.from({ length: config.size }, (_, i) => {
                const filled = Boolean(picks[i])
                const isOver = dragOverSlot === i

                return (
                  <div
                    key={i}
                    onDragOver={(e) => { allowDrop(e); setDragOverSlot(i) }}
                    onDragLeave={() => setDragOverSlot(null)}
                    onDrop={(e) => onDropSlot(e, i)}
                    draggable={filled && !isLocked}
                    onDragStart={(e) => filled && onDragStart(e, picks[i], 'slot', i)}
                    className={`pick-slot${filled ? ' filled' : ''}${isOver ? ' drag-over' : ''}`}
                  >
                    <p className="pick-slot-pos">P{i + 1}</p>
                    {filled ? (
                      <>
                        <p className="pick-slot-driver">{getDriverCode(picks[i])}</p>
                        <p className="driver-name-sm" style={{ marginTop: '0.1rem' }}>
                          {getDriverLastName(picks[i])}
                        </p>
                        {!isLocked && (
                          <button
                            className="pick-slot-remove"
                            onClick={(e) => {
                              e.stopPropagation()
                              updatePick(session, i + 1, '')
                            }}
                            title="Remove"
                          >
                            &times;
                          </button>
                        )}
                      </>
                    ) : (
                      <p className="pick-slot-empty-hint">drag here</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <button
          disabled={isLocked}
          onClick={() => saveSession(session)}
          style={{ marginTop: '1.25rem', maxWidth: '200px' }}
        >
          {isLocked ? 'Locked' : `Save ${config.label}`}
        </button>
      </div>
    )
  }

  const weekendTitle = weekend
    ? `${weekend.season} Round ${weekend.round} — ${weekend.grand_prix}`
    : 'Make Picks'

  const allSessionsLocked = weekend
    ? Object.values(locks).every(Boolean)
    : false

  return (
    <main className="container">
      <h1 className="section-header" style={{ marginBottom: '1.5rem' }}>
        {weekendTitle}
      </h1>

      {/* Banner when all sessions are locked */}
      {allSessionsLocked && weekend && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--status-complete)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="small">All sessions are locked for this weekend.</p>
          <Link href={`/weekly/${weekend.id}`}>
            <button className="secondary" style={{ width: 'auto', padding: '0.4rem 0.85rem', fontSize: 'var(--font-xs)' }}>
              View Results →
            </button>
          </Link>
        </div>
      )}

      {status && (
        <div className="card" style={{ marginBottom: '1rem', borderLeft: '3px solid var(--status-unsaved)' }}>
          <p className="small">{status}</p>
        </div>
      )}

      {/* Session tabs */}
      <div className="session-tabs">
        {SESSION_ORDER.map((session) => {
          const isLocked = locks[session]
          const isSaved = savedSessions.has(session)
          const isUnsaved = unsavedSessions.has(session)
          const isActive = activeSession === session

          let indicator = ''
          if (isLocked) indicator = ' 🔒'
          else if (isSaved) indicator = ' ✓'
          else if (isUnsaved) indicator = ' ●'

          return (
            <button
              key={session}
              className={[
                'session-tab',
                isActive ? 'active' : '',
                isLocked ? 'locked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => setActiveSession(session)}
            >
              {SESSION_RULES[session].label}
              {indicator}
            </button>
          )
        })}
      </div>

      {/* Active session panel */}
      <div className="card">
        {renderSession(activeSession)}
      </div>
    </main>
  )
}
