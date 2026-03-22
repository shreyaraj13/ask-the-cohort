'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronUp, ChevronDown, LogOut, MessageSquare, Send, CornerDownRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface Question {
  id: string
  name: string
  question: string
  vote_count: number
  created_at: string
}

interface Reply {
  id: string
  question_id: string
  parent_id: string | null
  name: string
  body: string
  created_at: string
}

const VOTES_KEY = 'atc_votes'

function getVoteMap(): Record<string, 'up' | 'down'> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(VOTES_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveVoteMap(map: Record<string, 'up' | 'down'>) {
  localStorage.setItem(VOTES_KEY, JSON.stringify(map))
}

function sorted(qs: Question[]): Question[] {
  return [...qs].sort((a, b) =>
    b.vote_count !== a.vote_count
      ? b.vote_count - a.vote_count
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const inputCls =
  'rounded-lg border border-[#2a2a3e] bg-[#0f0f1a] px-3 py-2 text-sm text-[#f0f0ff] placeholder-[#555] focus:outline-none focus:ring-2 focus:ring-[#7c3aed] focus:border-transparent transition'

export default function Home() {
  const router = useRouter()

  // Auth
  const [authReady, setAuthReady] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Questions
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [voteMap, setVoteMap] = useState<Record<string, 'up' | 'down'>>({})

  // Replies
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [replies, setReplies] = useState<Record<string, Reply[]>>({})
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({})
  const [loadingReplies, setLoadingReplies] = useState(false)

  // Active reply input: parentId = null → replying to question, string → replying to a reply
  const [activeReplyParent, setActiveReplyParent] = useState<string | null>(null)
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({}) // keyed by parentId or 'root'
  const [replySubmitting, setReplySubmitting] = useState(false)

  // Auth check
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/auth'); return }
      setName(session.user.user_metadata?.full_name || session.user.email || '')
      setEmail(session.user.email || '')
      setAuthReady(true)
    })
  }, [router])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const fetchQuestions = useCallback(async () => {
    setLoading(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from('cohort_questions').select('*')
    if (error || !data) {
      setFetchError(true)
    } else {
      setQuestions(sorted(data as Question[]))
      setFetchError(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: counts } = await (supabase as any)
        .from('cohort_replies')
        .select('question_id')
      if (counts) {
        const countMap: Record<string, number> = {}
        for (const row of counts as { question_id: string }[]) {
          countMap[row.question_id] = (countMap[row.question_id] || 0) + 1
        }
        setReplyCounts(countMap)
      }
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authReady) return
    setVoteMap(getVoteMap())
    fetchQuestions()
  }, [authReady, fetchQuestions])

  async function fetchReplies(questionId: string) {
    setLoadingReplies(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('cohort_replies')
      .select('*')
      .eq('question_id', questionId)
      .order('created_at', { ascending: true })
    if (data) setReplies(prev => ({ ...prev, [questionId]: data as Reply[] }))
    setLoadingReplies(false)
  }

  function toggleThread(questionId: string) {
    if (expandedId === questionId) {
      setExpandedId(null)
      setActiveReplyParent(null)
    } else {
      setExpandedId(questionId)
      setActiveReplyParent(null)
      if (!replies[questionId]) fetchReplies(questionId)
    }
  }

  function toggleReplyInput(parentId: string | null) {
    const key = parentId ?? 'root'
    setActiveReplyParent(prev => {
      const prevKey = prev ?? 'root'
      return prevKey === key ? null : parentId
    })
  }

  function setReplyText(key: string, val: string) {
    setReplyTexts(prev => ({ ...prev, [key]: val }))
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!questionText.trim()) { setSubmitError('Please write a question.'); return }
    setSubmitError(null)
    setSubmitting(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('cohort_questions')
      .insert({ name: name.trim(), question: questionText.trim() })
      .select()
      .single()
    setSubmitting(false)
    if (error || !data) { setSubmitError('Failed to post. Please try again.'); return }
    setQuestions(prev => sorted([...prev, data as Question]))
    setQuestionText('')
  }

  async function handleVote(id: string, direction: 'up' | 'down') {
    const current = voteMap[id]
    if (current === direction) return
    const delta = direction === 'up' ? (current === 'down' ? 2 : 1) : (current === 'up' ? -2 : -1)
    const updated = { ...voteMap, [id]: direction }
    setVoteMap(updated)
    saveVoteMap(updated)
    setQuestions(prev => sorted(prev.map(q => q.id === id ? { ...q, vote_count: q.vote_count + delta } : q)))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).rpc('adjust_vote', { question_id: id, delta })
  }

  async function handleReply(questionId: string, parentId: string | null) {
    const key = parentId ?? 'root'
    const text = replyTexts[key]?.trim()
    if (!text) return
    setReplySubmitting(true)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from('cohort_replies')
      .insert({ question_id: questionId, parent_id: parentId, name: name.trim(), body: text })
      .select()
      .single()
    setReplySubmitting(false)
    if (error || !data) return
    setReplies(prev => ({ ...prev, [questionId]: [...(prev[questionId] || []), data as Reply] }))
    setReplyCounts(prev => ({ ...prev, [questionId]: (prev[questionId] || 0) + 1 }))
    setReplyTexts(prev => ({ ...prev, [key]: '' }))
    setActiveReplyParent(null)
  }

  if (!authReady) return null

  const firstName = name.split(' ')[0] || name
  const initial = name[0]?.toUpperCase() || 'U'

  function ReplyInput({ questionId, parentId }: { questionId: string; parentId: string | null }) {
    const key = parentId ?? 'root'
    const text = replyTexts[key] || ''
    return (
      <div className="flex gap-2 items-start">
        <div className="w-5 h-5 rounded-full bg-[#7c3aed]/20 flex items-center justify-center text-[10px] font-bold text-[#7c3aed] shrink-0 mt-1.5">
          {initial}
        </div>
        <div className="flex-1 flex gap-2">
          <input
            autoFocus
            type="text"
            placeholder={parentId ? `Reply to this…` : 'Write a reply…'}
            value={text}
            onChange={e => setReplyText(key, e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply(questionId, parentId) }
              if (e.key === 'Escape') setActiveReplyParent(null)
            }}
            className={`${inputCls} flex-1`}
          />
          <button
            onClick={() => handleReply(questionId, parentId)}
            disabled={replySubmitting || !text}
            className="p-2 rounded-lg bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-40 text-white transition shrink-0"
          >
            <Send size={14} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f1a]">
      <div className="max-w-[640px] mx-auto px-4 py-10">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#f0f0ff] tracking-tight">Ask the Cohort</h1>
            <p className="mt-1 text-sm text-[#666]">
              Post a question. Vote up what matters — the best rise to the top.
            </p>
          </div>

          <div className="relative shrink-0 ml-4" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(prev => !prev)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-[#1a1a2e] transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-[#7c3aed]/20 flex items-center justify-center text-xs font-bold text-[#7c3aed] select-none">
                {initial}
              </div>
              <span className="text-sm text-[#f0f0ff] font-medium hidden sm:block">{firstName}</span>
              <ChevronDown size={14} className={`text-[#555] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-52 bg-[#1a1a2e] rounded-lg shadow-lg border border-[#2a2a3e] py-1 z-50">
                <div className="px-3 py-2 border-b border-[#2a2a3e]">
                  <p className="text-sm text-[#f0f0ff] font-medium truncate">{name}</p>
                  <p className="text-xs text-[#555] truncate">{email}</p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#666] hover:bg-[#0f0f1a] hover:text-red-400 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Post form */}
        <form onSubmit={handleSubmit} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl p-5 mb-6 space-y-3">
          <textarea
            placeholder="What's your question? e.g. How do I think about pricing for a free product?"
            rows={3}
            value={questionText}
            onChange={e => setQuestionText(e.target.value)}
            className={`${inputCls} w-full resize-none`}
          />
          <div className="flex gap-2 items-center">
            <span className="text-sm text-[#555]">Posting as <span className="text-[#f0f0ff]">{firstName}</span></span>
            <div className="flex-1" />
            <button type="submit" disabled={submitting} className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white text-sm font-semibold rounded-lg px-5 py-2 transition">
              {submitting ? 'Posting…' : 'Ask →'}
            </button>
          </div>
          {submitError && <p className="text-xs text-red-400">{submitError}</p>}
        </form>

        {/* Questions list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl animate-pulse" />)}
          </div>
        ) : fetchError ? (
          <p className="text-sm text-red-400 text-center py-8">
            Failed to load. <button onClick={fetchQuestions} className="underline">Retry</button>
          </p>
        ) : questions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-[#f0f0ff] font-semibold">The first question is yours to ask.</p>
            <p className="text-sm text-[#666] mt-1">Guaranteed 10 others are wondering the same thing.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {questions.map(q => {
              const myVote = voteMap[q.id]
              const isExpanded = expandedId === q.id
              const threadReplies = replies[q.id] || []
              const replyCount = replyCounts[q.id] || 0
              const topLevel = threadReplies.filter(r => !r.parent_id)
              const childrenOf = (id: string) => threadReplies.filter(r => r.parent_id === id)

              return (
                <div key={q.id} className="bg-[#1a1a2e] border border-[#2a2a3e] rounded-xl overflow-hidden">
                  {/* Question row */}
                  <div className="flex gap-4 p-4">
                    {/* Vote column */}
                    <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
                      <button
                        onClick={() => handleVote(q.id, 'up')}
                        aria-label="Upvote"
                        className={`p-1 rounded-md transition ${myVote === 'up' ? 'text-[#7c3aed] bg-[#7c3aed]/10' : 'text-[#555] hover:text-[#7c3aed] hover:bg-[#7c3aed]/10'}`}
                      >
                        <ChevronUp size={16} />
                      </button>
                      <span className={`text-xs font-bold tabular-nums ${myVote === 'up' ? 'text-[#7c3aed]' : myVote === 'down' ? 'text-red-400' : 'text-[#555]'}`}>
                        {q.vote_count}
                      </span>
                      <button
                        onClick={() => handleVote(q.id, 'down')}
                        aria-label="Downvote"
                        className={`p-1 rounded-md transition ${myVote === 'down' ? 'text-red-400 bg-red-400/10' : 'text-[#555] hover:text-red-400 hover:bg-red-400/10'}`}
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[#f0f0ff] text-sm leading-relaxed">{q.question}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-xs text-[#555]">
                          <span className="text-[#777]">{q.name}</span>{' · '}{timeAgo(q.created_at)}
                        </p>
                        <button
                          onClick={() => toggleThread(q.id)}
                          className="flex items-center gap-1 text-xs text-[#555] hover:text-[#7c3aed] transition-colors"
                        >
                          <MessageSquare size={12} />
                          {replyCount > 0 ? `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}` : 'Reply'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Thread panel */}
                  {isExpanded && (
                    <div className="border-t border-[#2a2a3e] bg-[#0f0f1a]/60">
                      {loadingReplies && !replies[q.id] ? (
                        <div className="px-4 py-3 text-xs text-[#555]">Loading…</div>
                      ) : topLevel.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-[#555]">No replies yet — be the first.</div>
                      ) : (
                        <div className="divide-y divide-[#2a2a3e]/50">
                          {topLevel.map(r => {
                            const children = childrenOf(r.id)
                            const isReplyingToThis = activeReplyParent === r.id
                            return (
                              <div key={r.id}>
                                {/* Top-level reply */}
                                <div className="px-4 py-3 flex gap-3">
                                  <div className="w-5 h-5 rounded-full bg-[#7c3aed]/15 flex items-center justify-center text-[10px] font-bold text-[#7c3aed] shrink-0 mt-0.5">
                                    {r.name[0]?.toUpperCase()}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-[#f0f0ff]">
                                      <span className="font-medium">{r.name}</span>
                                      <span className="text-[#555] ml-2">{timeAgo(r.created_at)}</span>
                                    </p>
                                    <p className="mt-1 text-sm text-[#ccc] leading-relaxed">{r.body}</p>
                                    <button
                                      onClick={() => toggleReplyInput(r.id)}
                                      className="mt-1.5 flex items-center gap-1 text-xs text-[#555] hover:text-[#7c3aed] transition-colors"
                                    >
                                      <CornerDownRight size={11} />
                                      Reply
                                    </button>
                                  </div>
                                </div>

                                {/* Nested replies */}
                                {children.length > 0 && (
                                  <div className="ml-8 border-l border-[#2a2a3e] divide-y divide-[#2a2a3e]/30">
                                    {children.map(child => (
                                      <div key={child.id} className="px-4 py-2.5 flex gap-3">
                                        <div className="w-4 h-4 rounded-full bg-[#7c3aed]/10 flex items-center justify-center text-[9px] font-bold text-[#7c3aed] shrink-0 mt-0.5">
                                          {child.name[0]?.toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs text-[#f0f0ff]">
                                            <span className="font-medium">{child.name}</span>
                                            <span className="text-[#555] ml-2">{timeAgo(child.created_at)}</span>
                                          </p>
                                          <p className="mt-1 text-sm text-[#ccc] leading-relaxed">{child.body}</p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Inline reply input for this reply */}
                                {isReplyingToThis && (
                                  <div className="ml-8 px-4 py-2.5 border-t border-[#2a2a3e]/50">
                                    <ReplyInput questionId={q.id} parentId={r.id} />
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {/* Bottom reply input (replying to question) */}
                      {activeReplyParent === null ? (
                        <div className="px-4 py-3 border-t border-[#2a2a3e]/50">
                          <ReplyInput questionId={q.id} parentId={null} />
                        </div>
                      ) : (
                        <div className="px-4 py-2 border-t border-[#2a2a3e]/50">
                          <button
                            onClick={() => toggleReplyInput(null)}
                            className="text-xs text-[#555] hover:text-[#7c3aed] transition-colors flex items-center gap-1"
                          >
                            <MessageSquare size={11} />
                            Reply to thread
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
