export type SessionType = 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race'

// Points for an exact match (all sessions, before normalization)
export const EXACT_MATCH_POINTS = 10

// Points deducted per position of difference, per session type:
//   race:              -1 per diff  → diff=0→10, diff=1→9, …, diff=9→1, diff≥10→0
//   sprint:            -2 per diff  → diff=0→10, diff=1→8, diff=2→6, diff=3→4, diff=4→2, diff≥5→0
//   qualifying / sq:   -3 per diff  → diff=0→10, diff=1→7, diff=2→4, diff=3→1, diff≥4→0
const DECREMENT_PER_DIFF: Record<SessionType, number> = {
  race:              1,
  sprint:            2,
  qualifying:        3,
  sprint_qualifying: 3,
}

// penalty applied when a selected driver is not in the session results
export const DNF_PENALTY = -5

/**
 * Sprint weekend normalization multipliers (1:2 weightage, sprint:normal).
 *
 * On a normal weekend:
 *   Qualifying: 3 picks × 10pts = 30pts max
 *   Race:      10 picks × 10pts = 100pts max
 *
 * On a sprint weekend the paired sessions must share the same ceiling:
 *   Sprint Quali (1 part) + Quali (2 parts) = 30pts  → ×(1/3) and ×(2/3)
 *   Sprint Race  (1 part) + Race  (2 parts) = 100pts → ×(1/3) and ×(2/3)
 *
 * So on a sprint weekend every raw score is multiplied by:
 *   qualifying:        2/3 ≈ 0.6667
 *   sprint_qualifying: 1/3 ≈ 0.3333
 *   sprint (race):     1/3 ≈ 0.3333
 *   race:              2/3 ≈ 0.6667
 */
export const SPRINT_WEEKEND_MULTIPLIER: Record<SessionType, number> = {
  qualifying:        2 / 3,
  sprint_qualifying: 1 / 3,
  sprint:            1 / 3,
  race:              2 / 3,
}

/**
 * Calculate points for a single pick, with optional sprint-weekend normalization.
 *   raw    = max(0, 10 - diff * decrement)
 *   final  = isSprint ? round(raw * multiplier[session]) : raw
 */
export function calculatePositionPoints(
  predictedPosition: number,
  actualPosition: number,
  session: SessionType,
  isSprint = false,
): number {
  const diff = Math.abs(predictedPosition - actualPosition)
  const decrement = DECREMENT_PER_DIFF[session]
  const raw = Math.max(0, EXACT_MATCH_POINTS - diff * decrement)
  if (!isSprint) return raw
  return Math.round(raw * SPRINT_WEEKEND_MULTIPLIER[session] * 100) / 100
}

export function isDnfStatus(status: string | null | undefined): boolean {
  if (!status) return false
  const normalized = status.toLowerCase()
  if (normalized.includes('finished') || normalized.startsWith('+')) return false
  return true
}
