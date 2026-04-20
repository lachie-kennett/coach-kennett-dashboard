'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, Bell, ExternalLink, ChevronRight } from 'lucide-react'

interface NudgeClient {
  id: string
  name: string
  whatsappNumber: string | null
  lastLoggedDate: string | null
  daysSinceLog: number
  adherencePercent: number
  currentStreak: number
  urgency: 'critical' | 'warning'
}

function draftMessage(name: string, days: number): string {
  const first = name.split(' ')[0]
  if (days >= 7) {
    return `Hey ${first}. Over a week with nothing in the tracker. This is a non-negotiable part of the program — I need you to action this today.`
  }
  if (days >= 5) {
    return `Hey ${first}, tracker's been blank for a few days now. You know how this works — can't track progress we don't have. Get it done today.`
  }
  return `Hey ${first}, just noticed your tracker hasn't been filled in the last couple of days. Quick nudge to get on it — even a partial fill counts 👊`
}

function whatsappUrl(number: string, message: string): string {
  const clean = number.replace(/\s+/g, '').replace(/^\+/, '')
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`
}

function formatLastLogged(days: number): string {
  if (days >= 999) return 'Never logged'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

function urgencyConfig(urgency: 'critical' | 'warning', days: number) {
  if (days >= 7) return {
    bg: 'bg-rose-500/10', border: 'border-rose-500/30',
    text: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-300', label: '7+ days',
  }
  if (urgency === 'critical') return {
    bg: 'bg-rose-500/10', border: 'border-rose-500/30',
    text: 'text-rose-400', badge: 'bg-rose-500/20 text-rose-300', label: '5–6 days',
  }
  return {
    bg: 'bg-amber-500/10', border: 'border-amber-500/30',
    text: 'text-amber-400', badge: 'bg-amber-500/20 text-amber-300', label: '3–4 days',
  }
}

function ClientNudgeCard({ client }: { client: NudgeClient }) {
  const cfg = urgencyConfig(client.urgency, client.daysSinceLog)
  const message = draftMessage(client.name, client.daysSinceLog)
  const [expanded, setExpanded] = useState(false)
  const [edited, setEdited] = useState(message)

  return (
    <div className={`rounded-2xl border ${cfg.bg} ${cfg.border} overflow-hidden`}>
      {/* Client row */}
      <div className="flex items-center gap-3 p-4">
        <div className={`w-9 h-9 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center flex-shrink-0`}>
          <span className={`${cfg.text} font-bold text-xs`}>
            {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="font-semibold text-white text-sm truncate">{client.name}</p>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Last logged {formatLastLogged(client.daysSinceLog)} · {client.adherencePercent}% adherence
          </p>
        </div>
        <Link
          href={`/clients/${client.id}/dashboard`}
          className="p-1.5 text-slate-600 hover:text-slate-400 transition-colors"
        >
          <ChevronRight size={14} />
        </Link>
      </div>

      {/* Message draft */}
      <div className="px-4 pb-4">
        <button
          onClick={() => setExpanded(v => !v)}
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-2"
        >
          {expanded ? '▾ Hide message' : '▸ View drafted message'}
        </button>

        {expanded && (
          <div className="space-y-2">
            <textarea
              value={edited}
              onChange={e => setEdited(e.target.value)}
              rows={3}
              className="w-full bg-slate-900/60 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors resize-none"
            />
            <div className="flex gap-2">
              {client.whatsappNumber ? (
                <a
                  href={whatsappUrl(client.whatsappNumber, edited)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 rounded-xl transition-colors"
                >
                  <ExternalLink size={13} />
                  Send via WhatsApp
                </a>
              ) : (
                <div className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 text-slate-500 text-xs font-medium py-2.5 rounded-xl cursor-not-allowed">
                  No WhatsApp number saved
                </div>
              )}
              <button
                onClick={() => setEdited(message)}
                className="px-3 py-2.5 bg-slate-800/60 hover:bg-slate-700 text-slate-400 text-xs rounded-xl transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function NudgesPage() {
  const [clients, setClients] = useState<NudgeClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/nudges')
      if (!res.ok) throw new Error('Failed to load')
      setClients(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const urgent  = clients.filter(c => c.daysSinceLog >= 7)
  const serious = clients.filter(c => c.daysSinceLog >= 5 && c.daysSinceLog < 7)
  const mild    = clients.filter(c => c.daysSinceLog >= 3 && c.daysSinceLog < 5)

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Coach view</p>
          <h1 className="text-2xl font-bold">Nudges 🔔</h1>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-3xl mb-3 animate-pulse">🔔</div>
            <p className="text-slate-400 text-sm">Checking trackers…</p>
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
          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-rose-400">{urgent.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">7+ days</p>
            </div>
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-rose-400">{serious.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">5–6 days</p>
            </div>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{mild.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">3–4 days</p>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="text-center py-16">
              <Bell size={48} className="mx-auto mb-4 text-slate-700" />
              <p className="text-white font-semibold mb-1">All caught up</p>
              <p className="text-slate-500 text-sm">Every client has logged in the last 3 days.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {urgent.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Over a week — be direct</p>
                  <div className="space-y-3">{urgent.map(c => <ClientNudgeCard key={c.id} client={c} />)}</div>
                </div>
              )}
              {serious.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">5–6 days — follow up</p>
                  <div className="space-y-3">{serious.map(c => <ClientNudgeCard key={c.id} client={c} />)}</div>
                </div>
              )}
              {mild.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">3–4 days — friendly nudge</p>
                  <div className="space-y-3">{mild.map(c => <ClientNudgeCard key={c.id} client={c} />)}</div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
