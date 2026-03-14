export type SessionType = 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race'

// Points for an exact match (all sessions)
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
 * Calculate points for a single pick.
 *   points = max(0, 10 - diff * decrement)
 *
 * Examples:
 *   race      diff=0 → 10 | diff=1 → 9  | diff=5 → 5  | diff=9 → 1  | diff=10 → 0
 *   sprint    diff=0 → 10 | diff=1 → 8  | diff=3 → 4  | diff=4 → 2  | diff=5  → 0
 *   quali/sq  diff=0 → 10 | diff=1 → 7  | diff=2 → 4  | diff=3 → 1  | diff=4  → 0
 */
export function calculatePositionPoints(
  predictedPosition: number,
  actualPosition: number,
  session: SessionType,
): number {
  const diff = Math.abs(predictedPosition - actualPosition)
  const decrement = DECREMENT_PER_DIFF[session]
  return Math.max(0, EXACT_MATCH_POINTS - diff * decrement)
}

export function isDnfStatus(status: string | null | undefined): boolean {
  if (!status) return false
  const normalized = status.toLowerCase()
  if (normalized.includes('finished') || normalized.startsWith('+')) return false
  return true
}
