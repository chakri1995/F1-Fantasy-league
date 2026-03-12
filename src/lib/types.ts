import type { SessionType } from '@/lib/scoring'

export interface Driver {
  id: string
  code: string
  number: number
  full_name: string
  team_name: string
}

export interface Weekend {
  id: string
  season: number
  round: number
  grand_prix: string
  qualifying_deadline: string
  sprint_qualifying_deadline?: string
  sprint_deadline: string
  race_deadline: string
}

export interface Pick {
  id?: string
  user_id?: string
  weekend_id: string
  session_type: SessionType
  predicted_position: number
  driver_id: string
}

export interface SessionResult {
  weekend_id: string
  session_type: SessionType
  driver_id: string
  actual_position: number
  status: string | null
}
