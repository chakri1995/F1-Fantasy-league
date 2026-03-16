import { NextRequest, NextResponse } from 'next/server'
import { calculatePositionPoints, DNF_PENALTY, isDnfStatus, SessionType, SPRINT_WEEKEND_MULTIPLIER } from '@/lib/scoring'
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

    const [{ data: picks, error: picksError }, { data: results, error: resultsError }, { data: drivers }, { data: weekend }] = await Promise.all([
      serviceClient.from('picks').select('*').eq('weekend_id', weekendId),
      serviceClient.from('session_results').select('*').eq('weekend_id', weekendId),
      serviceClient.from('drivers').select('id, full_name'),
      serviceClient.from('race_weekends').select('sprint_qualifying_deadline').eq('id', weekendId).single(),
    ])

    // A sprint weekend has a sprint_qualifying_deadline set
    const isSprint = !!(weekend as any)?.sprint_qualifying_deadline

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

    // build a set of rows for each pick; we'll later apply bonuses on top of this array
    const rows = (picks ?? []).map((pick) => {
      const key = `${pick.session_type}:${pick.driver_id}`
      const result = resultMap.get(key)

      // session-specific scoring (with sprint normalization if applicable)
      let points = 0
      if (result) {
        points = calculatePositionPoints(pick.predicted_position, result.position, pick.session_type as any, isSprint)
      }
      let penaltyReason: string | null = null

      // apply DNF penalty (scaled on sprint weekends to match normalization)
      if (result && isDnfStatus(result.status)) {
        const penalty = isSprint
          ? Math.round(DNF_PENALTY * SPRINT_WEEKEND_MULTIPLIER[pick.session_type as SessionType] * 100) / 100
          : DNF_PENALTY
        points += penalty
        penaltyReason = `DNF ${penalty}`
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

    // calculate bonuses per user/session and across sessions
    const groupByUserSession = new Map<string, typeof rows>()
    for (const row of rows) {
      const key = `${row.user_id}:${row.session_type}`
      if (!groupByUserSession.has(key)) groupByUserSession.set(key, [])
      groupByUserSession.get(key)!.push(row)
    }

    const usersWithPerfectPodium = new Set<string>()

    for (const [key, sessionRows] of groupByUserSession.entries()) {
      const [userId, sessionType] = key.split(':')
      // check if session has exactly three podium picks and they all matched
      const podium = sessionRows.filter((r) => r.predicted_position <= 3)
      if (podium.length === 3 && podium.every((r) => r.actual_position === r.predicted_position)) {
        usersWithPerfectPodium.add(userId)
        // award 10 bonus points to the first podium row for visibility
        podium[0].points += 10
        podium[0].penalty_reason = (podium[0].penalty_reason ?? '') + ' + podium bonus'
      }
    }

    // check cross-session podium bonus: if a user had a perfect podium in every session for the weekend
    const sessionsPresent = new Set<SessionType>((picks ?? []).map((p) => p.session_type as SessionType))
    for (const userId of Array.from(usersWithPerfectPodium)) {
      const userHasAll = ['qualifying', 'sprint_qualifying', 'sprint', 'race'].every(
        (s) => groupByUserSession.has(`${userId}:${s}`) &&
          groupByUserSession.get(`${userId}:${s}`)!.filter((r) => r.predicted_position <= 3).length === 3 &&
          groupByUserSession
            .get(`${userId}:${s}`)!
            .every((r) => r.predicted_position <= 3 ? r.actual_position === r.predicted_position : true),
      )
      if (userHasAll) {
        // give 50 points once on the first row for that user
        const firstRow = rows.find((r) => r.user_id === userId)
        if (firstRow) {
          firstRow.points += 50
          firstRow.penalty_reason = (firstRow.penalty_reason ?? '') + ' + all-podiums bonus'
        }
      }
    }

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
