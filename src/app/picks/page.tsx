'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function PicksIndexPage() {
  const router = useRouter()

  useEffect(() => {
    async function redirect() {
      if (!supabase) {
        router.push('/auth')
        return
      }

      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth')
        return
      }

      // Find the next upcoming weekend (race_deadline in the future), ordered soonest first
      const { data: weekends } = await supabase
        .from('race_weekends')
        .select('id, race_deadline')
        .gt('race_deadline', new Date().toISOString())
        .order('race_deadline', { ascending: true })
        .limit(1)

      if (weekends && weekends.length > 0) {
        router.replace(`/picks/${weekends[0].id}`)
      } else {
        // No upcoming races — go home
        router.replace('/')
      }
    }

    redirect()
  }, [router])

  return (
    <main className="container">
      <p className="small" style={{ marginTop: '2rem' }}>Finding next race...</p>
    </main>
  )
}
