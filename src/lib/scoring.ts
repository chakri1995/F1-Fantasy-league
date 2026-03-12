export type SessionType = 'qualifying' | 'sprint_qualifying' | 'sprint' | 'race'

// base points for an exact match or small differences; same mapping regardless of session
const POINTS_BY_DIFF: Record<number, number> = {
  0: 12,
  1: 8,
  2: 5,
  3: 2,
  // additional diffs exist but map to 0 unless the max limit allows them
}

// maximum allowed diff per session before returning zero
const MAX_DIFF: Record<SessionType, number> = {
  qualifying: 3,
  sprint_qualifying: 3,
  sprint: 5,
  race: 10,
}

// penalty applied when a selected driver DNF's
export const DNF_PENALTY = -5

export function calculatePositionPoints(
  predictedPosition: number,
  actualPosition: number,
  session: SessionType,
): number {
  const diff = Math.abs(predictedPosition - actualPosition)
  const max = MAX_DIFF[session]
  if (diff > max) {
    return 0
  }
  return POINTS_BY_DIFF[diff] ?? 0
}

export function isDnfStatus(status: string | null | undefined): boolean {
  if (!status) {
    return false
  }

  const normalized = status.toLowerCase()
  if (normalized.includes('finished') || normalized.startsWith('+')) {
    return false
  }

  return true
}
