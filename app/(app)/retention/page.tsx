'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ShieldAlert, ChevronRight } from 'lucide-react'

interface RetentionClient {
  id: string
  name: string
  daysAsMember: number
  daysInZone: number
  daysRemainingInZone: number
  packageEndDate: string | null
  adherencePercent: number
  currentStreak: number
  zones: ('buyersRemorse' | 'plateau' | 'packageEnd')[]
}

interface RetentionData {
  zones: {
    buyersRemorse: RetentionClient[]
    plateau: RetentionClient[]
    packageEnd: RetentionClient[]
  }
  counts: {
    buyersRemorse: number
    plateau: number
    packageEnd: number
    total: number
  }
}

function adherenceColor(pct: number) {
  if (pct >= 80) return 'bg-emerald-500/20 text-emerald-300'
  if (pct >= 60) return 'bg-amber-500/20 text-amber-300'
  return 'bg-rose-500/20 text-rose-300'
}

function ClientCard({ client }: { client: RetentionClient }) {
  const isPackageEnd = client.zones.includes('packageEnd')

  const statusLabel = isPackageEnd
    ? client.daysRemainingInZone === 0
      ? 'Package ends today'
      : `Package ends in ${client.daysRemainingInZone} day${client.daysRemainingInZone !== 1 ? 's' : ''}`
    : `Day ${client.daysAsMember}`

  return (
    <Link
      href={`/clients/${client.id}/dashboard`}
      className="flex items-center gap-3 rounded-2xl p-4 border bg-slate-800/60 border-slate-700/50 hover:border-orange-500/40 hover:bg-slate-800 transition-all group"
    >
      <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
        <span className="text-orange-400 font-bold text-xs">
          {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="font-semibold text-white text-sm truncate">{client.name}</p>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${adherenceColor(client.adherencePercent)}`}>
            {client.adherencePercent}%
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className={isPackageEnd ? 'text-rose-400' : 'text-amber-400'}>{statusLabel}</span>
          {client.currentStreak > 0 && <span>🔥 {client.currentStreak} day streak</span>}
        </div>
      </div>

      <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
    </Link>
  )
}

export default function RetentionPage() {
  const [data, setData] = useState<RetentionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/retention')
      if (!res.ok) throw new Error('Failed to load retention data')
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Merge all zones into one list, packageEnd first, deduplicated
  const allClients = data ? [
    ...data.zones.packageEnd,
    ...data.zones.plateau.filter(c => !data.zones.packageEnd.find(p => p.id === c.id)),
    ...data.zones.buyersRemorse.filter(c =>
      !data.zones.packageEnd.find(p => p.id === c.id) &&
      !data.zones.plateau.find(p => p.id === c.id)
    ),
  ] : []

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Coach view</p>
          <h1 className="text-2xl font-bold">Retention 🛡️</h1>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-3xl mb-3 animate-pulse">🛡️</div>
            <p className="text-slate-400 text-sm">Checking in on your clients…</p>
          </div>
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={load} className="text-orange-400 underline text-sm">Retry</button>
        </div>
      )}

      {!loading && !error && data && (
        allClients.length === 0 ? (
          <div className="text-center py-16">
            <ShieldAlert size={48} className="mx-auto mb-4 text-slate-700" />
            <p className="text-white font-semibold mb-1">All clear</p>
            <p className="text-slate-500 text-sm">No clients need attention right now.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">
              {allClients.length} client{allClients.length !== 1 ? 's' : ''} need attention
            </p>
            {allClients.map(client => (
              <ClientCard key={client.id} client={client} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
