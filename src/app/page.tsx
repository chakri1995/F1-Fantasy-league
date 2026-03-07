'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client'

export default function HomePage() {
  const [email, setEmail] = useState<string>('')
  const configured = isSupabaseConfigured()

  useEffect(() => {
    async function load() {
      if (!supabase) return
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setEmail(user?.email ?? '')
    }

    load()
  }, [])

  return (
    <main className="container">
      <div className="card" style={{ marginTop: '1rem' }}>
        <span className="badge">Private League Ready</span>
        <h1 style={{ marginTop: '0.5rem' }}>F1 Fantasy for Friends</h1>
        <p className="small" style={{ marginTop: '0.5rem' }}>
          Drivers-only fantasy with separate picks for qualifying, sprint and race, plus automatic scoring updates.
        </p>

        {!configured && (
          <p style={{ marginTop: '1rem', color: '#b42318' }}>
            Configure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY first.
          </p>
        )}

        <div className="grid two" style={{ marginTop: '1rem' }}>
          <Link href="/auth">
            <button className="secondary">{email ? 'Switch Account' : 'Signup / Login'}</button>
          </Link>
          <Link href="/dashboard">
            <button>Open Dashboard</button>
          </Link>
        </div>
      </div>
    </main>
  )
}
