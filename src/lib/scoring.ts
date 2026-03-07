export type SessionType = 'qualifying' | 'sprint' | 'race'

const POINTS_BY_DIFF: Record<number, number> = {
  0: 12,
  1: 8,
  2: 5,
  3: 2,
}

export const DNF_PENALTY = -3

export function calculatePositionPoints(predictedPosition: number, actualPosition: number): number {
  const diff = Math.abs(predictedPosition - actualPosition)
  if (diff > 3) {
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
