import { NextRequest, NextResponse } from 'next/server'
import { fetchSessionResults } from '@/lib/f1'
import { createSupabaseAnonClient, createSupabaseServiceClient } from '@/lib/supabase/server'
import type { SessionType } from '@/lib/scoring'

async function ensureAdmin(request: NextRequest): Promise<{ ok: true } | { ok: false; error: NextResponse }> {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return { ok: false, error: NextResponse.json({ error: 'Missing access token' }, { status: 401 }) }
    }

    const anonClient = createSupabaseAnonClient()
    const serviceClient = createSupabaseServiceClient()

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser(token)

    if (userError || !user) {
      return { ok: false, error: NextResponse.json({ error: 'Invalid token' }, { status: 401 }) }
    }

    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.is_admin) {
      return { ok: false, error: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) }
    }

    return { ok: true }
  } catch (error) {
    return { ok: false, error: NextResponse.json({ error: (error as Error).message }, { status: 500 }) }
  }
}

export async function POST(request: NextRequest) {
  const auth = await ensureAdmin(request)
  if (!auth.ok) return auth.error

  try {
    const body = (await request.json()) as { season?: number; round?: number }
    const season = Number(body.season)
    const round = Number(body.round)

    if (!Number.isFinite(season) || !Number.isFinite(round)) {
      return NextResponse.json({ error: 'season and round are required' }, { status: 400 })
    }

    const serviceClient = createSupabaseServiceClient()

    const { data: weekend, error: weekendError } = await serviceClient
      .from('race_weekends')
      .select('id')
      .eq('season', season)
      .eq('round', round)
      .single()

    if (weekendError || !weekend) {
      return NextResponse.json({ error: 'race_weekends row not found for season/round' }, { status: 404 })
    }

    const sessions: SessionType[] = ['qualifying', 'sprint_qualifying', 'sprint', 'race']
    let totalRows = 0

    for (const session of sessions) {
      const parsed = await fetchSessionResults(season, round, session)
      if (!parsed.length) continue

      const driverRows = parsed.map((item) => ({
        id: item.driverId,
        code: item.code,
        number: item.number || 0,
        full_name: item.fullName || item.driverId,
        team_name: item.teamName || 'Unknown',
      }))

      const { error: driverError } = await serviceClient.from('drivers').upsert(driverRows, { onConflict: 'id' })
      if (driverError) {
        return NextResponse.json({ error: driverError.message }, { status: 500 })
      }

      const rows = parsed.map((item) => ({
        weekend_id: weekend.id,
        session_type: session,
        driver_id: item.driverId,
        actual_position: item.position,
        status: item.status,
        source: 'api.jolpi.ca',
      }))

      const { error } = await serviceClient.from('session_results').upsert(rows, {
        onConflict: 'weekend_id,session_type,driver_id',
      })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      totalRows += rows.length
    }

    return NextResponse.json({ message: 'Results synced.', synced: totalRows, weekendId: weekend.id })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
