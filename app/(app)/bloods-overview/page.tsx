'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Droplets, ChevronRight } from 'lucide-react'

interface ClientBloodSummary {
  id: string
  name: string
  criticalCount: number
  suboptimalCount: number
  optimalCount: number
  noDataCount: number
  totalMarkers: number
  status: 'critical' | 'suboptimal' | 'optimal' | 'no_data'
}

const STATUS_CONFIG = {
  critical:   { label: 'Action needed', bg: 'bg-rose-500/10',   border: 'border-rose-500/30',   text: 'text-rose-400',    dot: 'bg-rose-500' },
  suboptimal: { label: 'Suboptimal',    bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  text: 'text-amber-400',   dot: 'bg-amber-500' },
  optimal:    { label: 'All optimal',   bg: 'bg-emerald-500/10',border: 'border-emerald-500/30',text: 'text-emerald-400', dot: 'bg-emerald-500' },
  no_data:    { label: 'No data',       bg: 'bg-slate-800/40',  border: 'border-slate-700/30',  text: 'text-slate-500',   dot: 'bg-slate-600' },
}

export default function BloodsOverviewPage() {
  const [clients, setClients] = useState<ClientBloodSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/bloods-overview')
      if (!res.ok) throw new Error('Failed to load')
      setClients(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const critical   = clients.filter(c => c.status === 'critical')
  const suboptimal = clients.filter(c => c.status === 'suboptimal')
  const optimal    = clients.filter(c => c.status === 'optimal')
  const noData     = clients.filter(c => c.status === 'no_data')

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Coach view</p>
          <h1 className="text-2xl font-bold">Bloodwork 🩸</h1>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-3xl mb-3 animate-pulse">🩸</div>
            <p className="text-slate-400 text-sm">Analysing markers…</p>
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
        <>
          {/* Summary strip */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-rose-400">{critical.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">Action needed</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{suboptimal.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">Suboptimal</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{optimal.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">All optimal</p>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="text-center py-16">
              <Droplets size={48} className="mx-auto mb-4 text-slate-700" />
              <p className="text-white font-semibold mb-1">No bloodwork data</p>
              <p className="text-slate-500 text-sm">Add blood markers to client sheets to see results here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[
                { label: 'Action needed', items: critical },
                { label: 'Suboptimal markers', items: suboptimal },
                { label: 'All optimal', items: optimal },
                { label: 'No data yet', items: noData },
              ].map(({ label, items }) =>
                items.length === 0 ? null : (
                  <div key={label} className="mb-6">
                    <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">{label}</p>
                    <div className="space-y-2">
                      {items.map(client => (
                        <ClientBloodCard key={client.id} client={client} />
                      ))}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ClientBloodCard({ client }: { client: ClientBloodSummary }) {
  const cfg = STATUS_CONFIG[client.status]

  return (
    <Link
      href={`/clients/${client.id}/bloods`}
      className={`flex items-center gap-3 rounded-2xl p-4 border ${cfg.bg} ${cfg.border} hover:brightness-110 transition-all group`}
    >
      {/* Avatar */}
      <div className={`w-9 h-9 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0`}>
        <span className={`${cfg.text} font-bold text-xs`}>
          {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-white text-sm truncate mb-1.5">{client.name}</p>
        <div className="flex gap-2 flex-wrap">
          {client.criticalCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-medium">
              {client.criticalCount} critical
            </span>
          )}
          {client.suboptimalCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-medium">
              {client.suboptimalCount} suboptimal
            </span>
          )}
          {client.optimalCount > 0 && client.criticalCount === 0 && client.suboptimalCount === 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-medium">
              {client.optimalCount} optimal
            </span>
          )}
          {client.totalMarkers === 0 && (
            <span className="text-xs text-slate-600">No markers entered</span>
          )}
        </div>
      </div>

      <ChevronRight size={14} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
    </Link>
  )
}
