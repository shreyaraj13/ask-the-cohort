import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Ask the Cohort',
  description: 'Post a question, let the cohort vote on what matters most.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
