'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface NavState {
  displayName: string
  isAdmin: boolean
  loaded: boolean
}

export default function Nav() {
  const router = useRouter()
  const pathname = usePathname()
  const [state, setState] = useState<NavState>({ displayName: '', isAdmin: false, loaded: false })

  useEffect(() => {
    if (!supabase) {
      setState({ displayName: '', isAdmin: false, loaded: true })
      return
    }

    async function loadUser() {
      if (!supabase) return
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setState({ displayName: '', isAdmin: false, loaded: true })
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name, is_admin')
        .eq('id', user.id)
        .maybeSingle()

      setState({
        displayName: profile?.display_name || user.email?.split('@')[0] || '',
        isAdmin: profile?.is_admin ?? false,
        loaded: true,
      })
    }

    loadUser()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadUser()
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  async function logout() {
    if (!supabase) return
    await supabase.auth.signOut()
    router.push('/auth')
  }

  // Don't render nav on auth page
  if (pathname === '/auth') return null

  // Render placeholder while loading to prevent layout shift
  if (!state.loaded) {
    return (
      <div
        style={{
          height: '56px',
          background: 'var(--nav-bg)',
          borderBottom: '3px solid var(--nav-stripe)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      />
    )
  }

  return (
    <nav className="site-nav">
      <Link href="/" className="site-nav-brand" style={{ display: 'flex', alignItems: 'center' }}>
        <Image src="/logo.svg" alt="F1 Fantasy" width={110} height={28} priority style={{ height: '28px', width: 'auto' }} />
      </Link>

      <div className="site-nav-links">
        <Link href="/" className={`site-nav-link${pathname === '/' ? ' active' : ''}`}>
          Home
        </Link>
        <Link href="/picks" className={`site-nav-link${pathname?.startsWith('/picks') ? ' active' : ''}`}>
          Picks
        </Link>
        <Link href="/rules" className={`site-nav-link${pathname === '/rules' ? ' active' : ''}`}>
          Rules
        </Link>
        {state.isAdmin && (
          <Link href="/admin" className={`site-nav-link${pathname === '/admin' ? ' active' : ''}`}>
            Admin
          </Link>
        )}
      </div>

      <div className="site-nav-right">
        {state.displayName && <span className="site-nav-user">{state.displayName}</span>}
        {state.displayName && (
          <button className="site-nav-logout" onClick={logout}>
            Logout
          </button>
        )}
      </div>
    </nav>
  )
}
