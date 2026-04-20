'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ChevronRight, ShieldAlert, Trophy, Users, Droplets, UserPlus, Bell, BarChart2, Film, Lock } from 'lucide-react'

interface ClientSummary {
  id: string
  name: string
  adherencePercent: number
  totalPoints: number
  trackedDays: number
  currentStreak: number
}

interface RetentionCounts {
  buyersRemorse: number
  plateau: number
  packageEnd: number
  total: number
}

function adherenceColor(pct: number) {
  if (pct >= 80) return { text: 'text-emerald-400', bar: 'bg-emerald-500', badge: 'bg-emerald-500/20 text-emerald-300' }
  if (pct >= 60) return { text: 'text-amber-400',   bar: 'bg-amber-500',   badge: 'bg-amber-500/20 text-amber-300' }
  return              { text: 'text-rose-400',    bar: 'bg-rose-500',    badge: 'bg-rose-500/20 text-rose-300' }
}

export default function CoachHomePage() {
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [retention, setRetention] = useState<RetentionCounts | null>(null)
  const [nudgeCount, setNudgeCount] = useState<number | null>(null)
  const [bloodsActionCount, setBloodsActionCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [lbRes, retRes, nudgeRes, bloodsRes] = await Promise.all([
        fetch('/api/leaderboard'),
        fetch('/api/admin/retention'),
        fetch('/api/admin/nudges'),
        fetch('/api/admin/bloods-overview'),
      ])
      if (!lbRes.ok) throw new Error('Failed to load clients')
      setClients(await lbRes.json())
      if (retRes.ok) {
        const ret = await retRes.json()
        setRetention(ret.counts)
      }
      if (nudgeRes.ok) {
        const nudges = await nudgeRes.json()
        setNudgeCount(nudges.length)
      }
      if (bloodsRes.ok) {
        const bloods: { status: string }[] = await bloodsRes.json()
        setBloodsActionCount(bloods.filter(c => c.status === 'critical').length)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const avgAdherence = clients.length
    ? Math.round(clients.reduce((sum, c) => sum + c.adherencePercent, 0) / clients.length)
    : 0

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Coach Kennett</p>
          <h1 className="text-2xl font-bold">Command Centre 🏠</h1>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <div className="text-center py-4 mb-4">
          <p className="text-red-400 text-sm mb-2">{error}</p>
          <button onClick={load} className="text-orange-400 underline text-sm">Retry</button>
        </div>
      )}

      {/* Top stat strip */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{loading ? '—' : clients.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Clients</p>
        </div>
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 text-center">
          <p className={`text-2xl font-bold ${loading ? 'text-slate-500' : adherenceColor(avgAdherence).text}`}>
            {loading ? '—' : `${avgAdherence}%`}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Avg Adherence</p>
        </div>
        <div className={`rounded-2xl p-3 text-center border ${
          !loading && retention && retention.total > 0
            ? 'bg-rose-500/10 border-rose-500/30'
            : 'bg-slate-800/60 border-slate-700/50'
        }`}>
          <p className={`text-2xl font-bold ${!loading && retention && retention.total > 0 ? 'text-rose-400' : 'text-slate-500'}`}>
            {loading ? '—' : (retention?.total ?? 0)}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">At Risk</p>
        </div>
      </div>

      {/* Feature blocks */}
      <div className="mb-8">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Dashboards</p>
        <div className="grid grid-cols-2 gap-3">

          {/* Retention — LIVE */}
          <Link href="/retention" className={`rounded-2xl p-4 border transition-all hover:brightness-110 ${
            retention && retention.total > 0
              ? 'bg-rose-500/10 border-rose-500/30'
              : 'bg-slate-800/60 border-slate-700/50 hover:border-orange-500/40'
          }`}>
            <ShieldAlert size={20} className={retention && retention.total > 0 ? 'text-rose-400' : 'text-slate-400'} />
            <p className="font-semibold text-white mt-3 text-sm">Retention</p>
            <p className="text-xs mt-0.5">
              {loading
                ? <span className="text-slate-500">Loading…</span>
                : retention && retention.total > 0
                  ? <span className="text-rose-400">{retention.total} at risk</span>
                  : <span className="text-emerald-400">All clear</span>
              }
            </p>
          </Link>

          {/* Leaderboard — LIVE */}
          <Link href="/leaderboard" className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-orange-500/40 hover:bg-slate-800 transition-all">
            <Trophy size={20} className="text-orange-400" />
            <p className="font-semibold text-white mt-3 text-sm">Leaderboard</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? 'Loading…' : `${clients.length} athlete${clients.length !== 1 ? 's' : ''}`}
            </p>
          </Link>

          {/* Client List — LIVE */}
          <Link href="/clients" className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-orange-500/40 hover:bg-slate-800 transition-all">
            <Users size={20} className="text-blue-400" />
            <p className="font-semibold text-white mt-3 text-sm">Client Roster</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? 'Loading…' : `${clients.length} active`}
            </p>
          </Link>

          {/* Bloodwork — LIVE */}
          <Link href="/bloods-overview" className={`rounded-2xl p-4 border transition-all hover:brightness-110 ${
            bloodsActionCount && bloodsActionCount > 0
              ? 'bg-rose-500/10 border-rose-500/30'
              : 'bg-slate-800/60 border-slate-700/50 hover:border-orange-500/40'
          }`}>
            <Droplets size={20} className={bloodsActionCount && bloodsActionCount > 0 ? 'text-rose-400' : 'text-slate-400'} />
            <p className="font-semibold text-white mt-3 text-sm">Bloodwork</p>
            <p className="text-xs mt-0.5">
              {loading
                ? <span className="text-slate-500">Loading…</span>
                : bloodsActionCount && bloodsActionCount > 0
                  ? <span className="text-rose-400">{bloodsActionCount} action needed</span>
                  : <span className="text-slate-400">All markers reviewed</span>
              }
            </p>
          </Link>

          {/* Onboarding — LIVE */}
          <Link href="/onboarding" className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-orange-500/40 hover:bg-slate-800 transition-all">
            <UserPlus size={20} className="text-purple-400" />
            <p className="font-semibold text-white mt-3 text-sm">Onboarding</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {loading ? 'Loading…' : `${clients.length} client${clients.length !== 1 ? 's' : ''}`}
            </p>
          </Link>

          {/* Tracker Nudges — LIVE */}
          <Link href="/nudges" className={`rounded-2xl p-4 border transition-all hover:brightness-110 ${
            nudgeCount && nudgeCount > 0
              ? 'bg-amber-500/10 border-amber-500/30'
              : 'bg-slate-800/60 border-slate-700/50 hover:border-orange-500/40'
          }`}>
            <Bell size={20} className={nudgeCount && nudgeCount > 0 ? 'text-amber-400' : 'text-slate-400'} />
            <p className="font-semibold text-white mt-3 text-sm">Nudges</p>
            <p className="text-xs mt-0.5">
              {loading
                ? <span className="text-slate-500">Loading…</span>
                : nudgeCount && nudgeCount > 0
                  ? <span className="text-amber-400">{nudgeCount} need check-in</span>
                  : <span className="text-slate-400">All logging</span>
              }
            </p>
          </Link>

          {/* Revenue — COMING SOON */}
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-4 opacity-60 cursor-not-allowed relative">
            <BarChart2 size={20} className="text-slate-500" />
            <p className="font-semibold text-slate-400 mt-3 text-sm">Revenue</p>
            <p className="text-xs text-slate-500 mt-0.5">ARPC · LTV · Churn</p>
            <div className="absolute top-3 right-3">
              <Lock size={11} className="text-slate-600" />
            </div>
          </div>

          {/* Content Pipeline — COMING SOON */}
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-2xl p-4 opacity-60 cursor-not-allowed relative">
            <Film size={20} className="text-slate-500" />
            <p className="font-semibold text-slate-400 mt-3 text-sm">Content</p>
            <p className="text-xs text-slate-500 mt-0.5">Ideas → Filmed → Posted</p>
            <div className="absolute top-3 right-3">
              <Lock size={11} className="text-slate-600" />
            </div>
          </div>

        </div>
      </div>

      {/* Client tracker summary */}
      {!loading && clients.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Tracker Summary</p>
          <div className="space-y-3">
            {[...clients]
              .sort((a, b) => b.adherencePercent - a.adherencePercent)
              .map(client => {
                const col = adherenceColor(client.adherencePercent)
                return (
                  <Link
                    key={client.id}
                    href={`/clients/${client.id}/dashboard`}
                    className="flex items-center gap-4 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-orange-500/40 hover:bg-slate-800 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                      <span className="text-orange-400 font-bold text-sm">
                        {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="font-semibold text-white truncate group-hover:text-orange-300 transition-colors text-sm">
                          {client.name}
                        </p>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${col.badge}`}>
                          {client.adherencePercent}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden mb-2">
                        <div className={`h-full ${col.bar} rounded-full`} style={{ width: `${client.adherencePercent}%` }} />
                      </div>
                      <div className="flex gap-3 text-xs text-slate-500">
                        <span>{client.trackedDays} days logged</span>
                        <span>{client.totalPoints} pts</span>
                        {client.currentStreak > 0 && <span>🔥 {client.currentStreak} streak</span>}
                      </div>
                    </div>
                    <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
                  </Link>
                )
              })}
          </div>
        </div>
      )}
    </div>
  )
}
