'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function AuthPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(true)
  const [status, setStatus] = useState('')

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) {
      setStatus('Supabase is not configured.')
      return
    }

    setStatus('Processing...')

    const response = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })

    if (response.error) {
      setStatus(response.error.message)
      return
    }

    setStatus(isSignup ? 'Signup successful. Check email if confirmation is required.' : 'Login successful.')
    router.push('/')
    router.refresh()
  }

  return (
    <main className="container">
      <div className="card" style={{ marginTop: '1rem', maxWidth: 520, marginInline: 'auto' }}>
        <h1>{isSignup ? 'Create Account' : 'Login'}</h1>


        <form onSubmit={onSubmit} style={{ marginTop: '1rem' }}>
          <div style={{ marginBottom: '0.8rem' }}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div style={{ marginBottom: '0.8rem' }}>
            <label>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={isSignup ? 'new-password' : 'current-password'}
            />
          </div>

          <button type="submit">{isSignup ? 'Sign Up' : 'Login'}</button>
        </form>

        <button
          type="button"
          className="secondary"
          style={{ marginTop: '0.6rem' }}
          onClick={() => setIsSignup((prev) => !prev)}
        >
          {isSignup ? 'Already have account? Login' : 'Need account? Sign Up'}
        </button>

        {status && <p className="small" style={{ marginTop: '0.8rem' }}>{status}</p>}
      </div>
    </main>
  )
}
