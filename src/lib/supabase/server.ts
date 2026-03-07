import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export function createSupabaseServiceClient() {
  if (!url || !service) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(url, service, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function createSupabaseAnonClient() {
  if (!url || !anon) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  return createClient(url, anon, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
