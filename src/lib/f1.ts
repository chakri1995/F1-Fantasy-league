import type { SessionType } from '@/lib/scoring'

export interface ParsedResult {
  driverId: string
  position: number
  status: string | null
  code: string
  number: number
  fullName: string
  teamName: string
}

interface ErgastResponse {
  MRData?: {
    RaceTable?: {
      Races?: Array<{
        QualifyingResults?: Array<any>
        SprintResults?: Array<any>
        Results?: Array<any>
      }>
    }
  }
}

function normalizeDriverId(givenName: string, familyName: string): string {
  return `${givenName}_${familyName}`.toLowerCase().replace(/[^a-z0-9]+/g, '_')
}

function parseList(session: SessionType, body: ErgastResponse): ParsedResult[] {
  const race = body.MRData?.RaceTable?.Races?.[0]
  if (!race) return []

  const raw =
    session === 'qualifying' ? race.QualifyingResults ?? [] : session === 'sprint' ? race.SprintResults ?? [] : race.Results ?? []

  return raw
    .map((item: any) => {
      const givenName = item.Driver?.givenName ?? ''
      const familyName = item.Driver?.familyName ?? ''
      const positionRaw = item.position
      const position = Number(positionRaw)

      return {
        driverId: normalizeDriverId(givenName, familyName),
        position,
        status: item.status ?? null,
        code: item.Driver?.code ?? familyName.slice(0, 3).toUpperCase(),
        number: Number(item.Driver?.permanentNumber ?? 0),
        fullName: `${givenName} ${familyName}`.trim(),
        teamName: item.Constructor?.name ?? 'Unknown',
      }
    })
    .filter((item: ParsedResult) => Number.isFinite(item.position) && item.position > 0)
}

export async function fetchSessionResults(season: number, round: number, session: SessionType): Promise<ParsedResult[]> {
  const endpoint =
    session === 'qualifying'
      ? `https://api.jolpi.ca/ergast/f1/${season}/${round}/qualifying.json`
      : session === 'sprint'
      ? `https://api.jolpi.ca/ergast/f1/${season}/${round}/sprint.json`
      : `https://api.jolpi.ca/ergast/f1/${season}/${round}/results.json`

  const response = await fetch(endpoint, { cache: 'no-store' })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${session} results (${response.status})`)
  }

  const body = (await response.json()) as ErgastResponse
  return parseList(session, body)
}
