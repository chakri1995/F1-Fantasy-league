import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import '@/app/globals.css'
import Nav from '@/app/components/Nav'

export const metadata: Metadata = {
  title: 'F1 Private Fantasy League',
  description: 'Private league with qualifying, sprint and race prediction scoring.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Nav />
        {children}
      </body>
    </html>
  )
}
