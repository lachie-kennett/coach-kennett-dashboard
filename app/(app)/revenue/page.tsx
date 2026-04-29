'use client'

import { useEffect, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts'
import { RefreshCw, TrendingUp } from 'lucide-react'

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

function fmt(n: number) {
  return n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 })
}

export default function RevenuePage() {
  const [data, setData] = useState<RevenueData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/revenue')
      if (!res.ok) throw new Error('Failed to load revenue data')
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

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
              <p className="text-slate-400 text-xs mb-1">Weekly</p>
              <p className="text-2xl font-bold text-white">{fmt(data.totalWeekly)}</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
              <p className="text-slate-400 text-xs mb-1">Monthly</p>
              <p className="text-2xl font-bold text-orange-400">{fmt(data.totalMonthly)}</p>
            </div>
          </div>

          {/* Chart */}
          {data.chartData.length > 1 && (
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp size={16} className="text-orange-400" />
                <p className="text-sm font-semibold text-white">Monthly Revenue Growth</p>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                    labelStyle={{ color: '#f1f5f9', fontSize: 12 }}
                    formatter={(v: number) => [fmt(v), 'Revenue']}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                    dot={false}
                  />
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
