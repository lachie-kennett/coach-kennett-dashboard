'use client'

import { useEffect, useState } from 'react'
import SectionHeader from '@/components/SectionHeader'
import { RefreshCw, Medal } from 'lucide-react'

interface LeaderboardEntry {
  id: string
  name: string
  adherencePercent: number
  totalPoints: number
  totalSessions: number
  trackedDays: number
  currentStreak: number
  sprint10: number | null
  cmj: number | null
  squat: number | null
  vo2: number | null
  isCurrentUser: boolean
}

type SortKey = 'adherencePercent' | 'totalPoints' | 'totalSessions' | 'currentStreak' | 'squat' | 'cmj'

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'adherencePercent', label: 'Adherence' },
  { key: 'totalPoints',      label: 'Points' },
  { key: 'currentStreak',    label: '🔥 Streak' },
  { key: 'squat',            label: 'Squat' },
  { key: 'cmj',              label: 'Jump' },
]

const MEDAL = ['🥇', '🥈', '🥉']

function formatValue(entry: LeaderboardEntry, key: SortKey): string {
  if (key === 'adherencePercent') return `${entry.adherencePercent}%`
  if (key === 'totalPoints') return `${entry.totalPoints} pts`
  if (key === 'currentStreak') return `${entry.currentStreak} days`
  if (key === 'totalSessions') return `${entry.totalSessions}`
  if (key === 'squat') return entry.squat != null ? `${entry.squat}kg` : '—'
  if (key === 'cmj') return entry.cmj != null ? `${entry.cmj}cm` : '—'
  return '—'
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('adherencePercent')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/leaderboard')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading leaderboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const sorted = [...data].sort((a, b) => {
    const av = a[sortBy] ?? -1
    const bv = b[sortBy] ?? -1
    return (bv as number) - (av as number)
  })

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Leaderboard 🏆</h1>
          <p className="text-slate-400 text-sm mt-0.5">See how you stack up</p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Sort tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              sortBy === opt.key
                ? 'bg-orange-500 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-3xl mb-3 animate-pulse">⚡️</div>
            <p className="text-slate-400 text-sm">Loading leaderboard…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={load} className="text-orange-400 underline text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && (
        <div className="space-y-3">
          {sorted.map((entry, i) => (
            <div
              key={entry.id}
              className={`flex items-center gap-3 rounded-2xl p-4 border transition-all ${
                entry.isCurrentUser
                  ? 'bg-orange-500/10 border-orange-500/30'
                  : 'bg-slate-800/60 border-slate-700/50'
              }`}
            >
              {/* Rank */}
              <div className="w-8 text-center">
                {i < 3
                  ? <span className="text-xl">{MEDAL[i]}</span>
                  : <span className="text-slate-500 font-bold text-sm">{i + 1}</span>
                }
              </div>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className={`font-semibold truncate ${entry.isCurrentUser ? 'text-orange-300' : 'text-white'}`}>
                  {entry.name}
                  {entry.isCurrentUser && <span className="text-xs text-orange-400 ml-1">(you)</span>}
                </p>
                <div className="flex gap-3 mt-1 text-xs text-slate-500">
                  <span>{entry.trackedDays} days logged</span>
                  {entry.currentStreak > 0 && <span>🔥 {entry.currentStreak} day streak</span>}
                </div>
              </div>

              {/* Primary metric */}
              <div className="text-right">
                <p className={`text-lg font-bold ${entry.isCurrentUser ? 'text-orange-400' : 'text-white'}`}>
                  {formatValue(entry, sortBy)}
                </p>
                <p className="text-xs text-slate-500 capitalize">
                  {SORT_OPTIONS.find(o => o.key === sortBy)?.label}
                </p>
              </div>
            </div>
          ))}

          {sorted.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Medal size={40} className="mx-auto mb-3 opacity-30" />
              <p>No data yet</p>
            </div>
          )}
        </div>
      )}

      {/* All stats breakdown for current user */}
      {!loading && !error && sorted.length > 0 && (() => {
        const me = sorted.find(e => e.isCurrentUser)
        if (!me) return null
        return (
          <div className="mt-8">
            <SectionHeader title="Your Stats" />
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Adherence', value: `${me.adherencePercent}%` },
                { label: 'Points', value: me.totalPoints },
                { label: '🔥 Streak', value: `${me.currentStreak} days` },
                { label: '10m Sprint', value: me.sprint10 != null ? `${me.sprint10}s` : '—' },
                { label: 'CMJ', value: me.cmj != null ? `${me.cmj}cm` : '—' },
                { label: 'Back Squat', value: me.squat != null ? `${me.squat}kg` : '—' },
                { label: 'VO₂ Max', value: me.vo2 != null ? `${me.vo2}` : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">{label}</p>
                  <p className="text-xl font-bold text-orange-400">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
