'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { RefreshCw, TrendingUp, Link2, Link2Off } from 'lucide-react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'

interface ClientRevenue {
  name: string
  weeklyRate: number
  startDate: string | null
  weeksTo: number
  lifetime: number
}

interface RevenueData {
  clients: ClientRevenue[]
  chartData: { month: string; revenue: number }[]
  totalWeekly: number
  totalMonthly: number
}

interface XeroData {
  connected: boolean
  chartData?: { month: string; actual: number }[]
  invoices?: number
}

function fmt(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
}

function mergeChartData(
  forecast: { month: string; revenue: number }[],
  actual: { month: string; actual: number }[]
) {
  const map: Record<string, { month: string; forecast?: number; actual?: number }> = {}
  for (const f of forecast) map[f.month] = { month: f.month, forecast: f.revenue }
  for (const a of actual) {
    if (map[a.month]) map[a.month].actual = a.actual
    else map[a.month] = { month: a.month, actual: a.actual }
  }
  return Object.values(map)
}

function RevenuePageInner() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [xero, setXero] = useState<XeroData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [disconnecting, setDisconnecting] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [revRes, xeroRes] = await Promise.all([
        fetch('/api/admin/revenue'),
        fetch('/api/xero/invoices'),
      ])
      if (!revRes.ok) throw new Error('Failed to load revenue data')
      setData(await revRes.json())
      if (xeroRes.ok) setXero(await xeroRes.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // Clear xero query param after connecting
    if (searchParams.get('xero')) router.replace('/revenue')
  }, [load, searchParams, router])

  async function disconnect() {
    setDisconnecting(true)
    await fetch('/api/xero/disconnect', { method: 'POST' })
    setXero({ connected: false })
    setDisconnecting(false)
  }

  const xeroStatus = searchParams.get('xero')

  const chartData = data && xero?.connected && xero.chartData
    ? mergeChartData(data.chartData, xero.chartData)
    : data?.chartData.map(d => ({ month: d.month, forecast: d.revenue })) ?? []

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Coach view</p>
          <h1 className="text-2xl font-bold">Revenue</h1>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Xero connection banner */}
      {xeroStatus === 'connected' && (
        <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3 text-sm text-green-400">
          Xero connected successfully
        </div>
      )}
      {xeroStatus === 'error' && (
        <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          Failed to connect Xero: {searchParams.get('msg') ?? 'unknown error'}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-3xl mb-3 animate-pulse">💰</div>
            <p className="text-slate-400 text-sm">Loading revenue data…</p>
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
        <div className="space-y-6">
          {/* Stat cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
              <p className="text-slate-400 text-xs mb-1">Weekly forecast</p>
              <p className="text-2xl font-bold text-white">{fmt(data.totalWeekly)}</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
              <p className="text-slate-400 text-xs mb-1">Monthly forecast</p>
              <p className="text-2xl font-bold text-orange-400">{fmt(data.totalMonthly)}</p>
            </div>
          </div>

          {/* Xero connect / disconnect */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Xero</p>
              <p className="text-xs text-slate-500">
                {xero?.connected ? `${xero.invoices ?? 0} paid invoices loaded` : 'Connect to show actual revenue'}
              </p>
            </div>
            {xero?.connected ? (
              <button
                onClick={disconnect}
                disabled={disconnecting}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition-colors"
              >
                <Link2Off size={14} />
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            ) : (
              <a
                href="/api/xero/auth"
                className="flex items-center gap-1.5 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                <Link2 size={14} />
                Connect
              </a>
            )}
          </div>

          {/* Chart */}
          {chartData.length > 1 && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-orange-400" />
                <p className="text-sm font-semibold text-white">
                  {xero?.connected ? 'Forecast vs Actual' : 'Monthly Revenue Growth'}
                </p>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} width={40} />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#f1f5f9', fontSize: 12 }}
                    formatter={(v) => [fmt(Number(v)), '']}
                  />
                  {xero?.connected && <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />}
                  <Area type="monotone" dataKey="forecast" name="Forecast" stroke="#f97316" strokeWidth={2} fill="url(#forecastGrad)" dot={false} />
                  {xero?.connected && (
                    <Area type="monotone" dataKey="actual" name="Actual (Xero)" stroke="#22d3ee" strokeWidth={2} fill="url(#actualGrad)" dot={false} />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Client breakdown */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-700/50">
              <p className="text-sm font-semibold text-white">{data.clients.length} Active Clients</p>
            </div>
            <div className="divide-y divide-slate-700/30">
              {data.clients
                .sort((a, b) => b.weeklyRate - a.weeklyRate)
                .map((client, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-white">{client.name}</p>
                      {client.weeksTo > 0 && (
                        <p className="text-xs text-slate-500">{Math.round(client.weeksTo)} weeks together</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-orange-400">{fmt(client.weeklyRate)}<span className="text-slate-500 font-normal text-xs">/wk</span></p>
                      {client.lifetime > 0 && (
                        <p className="text-xs text-slate-500">{fmt(client.lifetime)} lifetime</p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RevenuePage() {
  return (
    <Suspense>
      <RevenuePageInner />
    </Suspense>
  )
}
