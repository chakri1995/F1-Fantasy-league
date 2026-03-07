import { NextRequest, NextResponse } from 'next/server'
import { calculatePositionPoints, DNF_PENALTY, isDnfStatus } from '@/lib/scoring'
import { createSupabaseAnonClient, createSupabaseServiceClient } from '@/lib/supabase/server'

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
    const body = (await request.json()) as { weekendId?: string }
    const weekendId = body.weekendId

    if (!weekendId) {
      return NextResponse.json({ error: 'weekendId is required' }, { status: 400 })
    }

    const serviceClient = createSupabaseServiceClient()

    const [{ data: picks, error: picksError }, { data: results, error: resultsError }, { data: drivers }] = await Promise.all([
      serviceClient.from('picks').select('*').eq('weekend_id', weekendId),
      serviceClient.from('session_results').select('*').eq('weekend_id', weekendId),
      serviceClient.from('drivers').select('id, full_name'),
    ])

    if (picksError) {
      return NextResponse.json({ error: picksError.message }, { status: 500 })
    }

    if (resultsError) {
      return NextResponse.json({ error: resultsError.message }, { status: 500 })
    }

    await serviceClient.from('score_events').delete().eq('weekend_id', weekendId)

    const resultMap = new Map<string, { position: number; status: string | null }>()

    for (const result of results ?? []) {
      resultMap.set(`${result.session_type}:${result.driver_id}`, {
        position: result.actual_position,
        status: result.status,
      })
    }

    const driverMap = new Map<string, string>()
    for (const driver of drivers ?? []) {
      driverMap.set(driver.id, driver.full_name)
    }

    const rows = (picks ?? []).map((pick) => {
      const key = `${pick.session_type}:${pick.driver_id}`
      const result = resultMap.get(key)

      let points = result ? calculatePositionPoints(pick.predicted_position, result.position) : 0
      let penaltyReason: string | null = null

      if ((pick.session_type === 'sprint' || pick.session_type === 'race') && result && isDnfStatus(result.status)) {
        points += DNF_PENALTY
        penaltyReason = `DNF ${DNF_PENALTY}`
      }

      return {
        weekend_id: weekendId,
        user_id: pick.user_id,
        session_type: pick.session_type,
        predicted_position: pick.predicted_position,
        driver_id: pick.driver_id,
        driver_name: driverMap.get(pick.driver_id) ?? pick.driver_id,
        actual_position: result?.position ?? null,
        points,
        penalty_reason: penaltyReason,
      }
    })

    if (rows.length > 0) {
      const { error } = await serviceClient.from('score_events').insert(rows)
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ message: 'Scoring completed.', scored: rows.length })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
