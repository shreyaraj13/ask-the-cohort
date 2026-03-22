'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const inputCls =
  'w-full rounded-lg border border-[#2a2a3e] bg-[#0f0f1a] px-3.5 py-2.5 text-sm text-[#f0f0ff] placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent transition'

type Mode = 'signin' | 'signup'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function toggleMode() {
    setMode((m) => (m === 'signin' ? 'signup' : 'signin'))
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (mode === 'signup') {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      })
      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) {
        setError(authError.message)
        setLoading(false)
        return
      }
    }

    router.push('/')
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a3e] px-8 py-10">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-[#7c3aed] tracking-wide">Ask the Cohort</h1>
            <p className="mt-2 text-sm text-[#666]">
              {mode === 'signin' ? 'Sign in to your account' : 'Create your account'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'signup' && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-[#f0f0ff] mb-1.5">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  className={inputCls}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-[#f0f0ff] mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputCls}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[#f0f0ff] mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className={inputCls}
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-[#0f0f1a] border border-red-400/40 rounded-lg px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#7c3aed] hover:opacity-90 disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition"
            >
              {loading
                ? mode === 'signin' ? 'Signing in…' : 'Creating account…'
                : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-[#666]">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={toggleMode}
              className="text-[#7c3aed] font-medium hover:text-[#f0f0ff] transition-colors"
            >
              {mode === 'signin' ? 'Create one' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
