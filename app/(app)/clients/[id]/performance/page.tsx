'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import SectionHeader from '@/components/SectionHeader'
import { RefreshCw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface PerformanceTest {
  name: string
  category: string
  dates: string[]
  values: (number | null)[]
  latest: number | null
  unit: string
}

interface PerformanceData {
  tests: PerformanceTest[]
  client: { name: string }
}

const CATEGORY_ICONS: Record<string, string> = {
  'Speed & Acceleration': '⚡️',
  'Jumping & Explosive Power': '🦘',
  'Strength': '💪',
  'Aerobic Endurance': '🫁',
}

export default function CoachClientPerformance({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<PerformanceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/performance?clientId=${id}`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const tests = data?.tests ?? []
  const categories = [...new Set(tests.map(t => t.category))].filter(Boolean)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl mb-3 animate-pulse">⚡️</div>
        <p className="text-slate-400">Loading performance data…</p>
      </div>
    </div>
  )

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Viewing client</p>
          <h1 className="text-2xl font-bold">Performance ⚡️</h1>
          {data?.client.name && (
            <p className="text-slate-400 text-sm mt-0.5">{data.client.name}</p>
          )}
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      {error && (
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={load} className="text-orange-400 underline text-sm">Retry</button>
        </div>
      )}

      {categories.map(category => {
        const categoryTests = tests.filter(t => t.category === category)
        return (
          <div key={category} className="mb-8">
            <SectionHeader title={`${CATEGORY_ICONS[category] ?? ''} ${category}`} />
            <div className="space-y-3">
              {categoryTests.map(test => {
                const chartData = test.values
                  .map((v, i) => ({ index: i + 1, value: v }))
                  .filter(d => d.value !== null)

                return (
                  <div key={test.name} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-white text-sm">{test.name}</p>
                        <p className="text-xs text-slate-500">{test.unit}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-orange-400">
                          {test.latest != null ? test.latest : '—'}
                        </p>
                        {test.latest != null && (
                          <p className="text-xs text-slate-500">{test.unit}</p>
                        )}
                      </div>
                    </div>

                    {chartData.length > 1 && (
                      <ResponsiveContainer width="100%" height={80}>
                        <LineChart data={chartData}>
                          <XAxis dataKey="index" hide />
                          <YAxis domain={['auto', 'auto']} hide />
                          <Tooltip
                            contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }}
                            formatter={(v) => [`${v} ${test.unit}`, test.name]}
                            labelFormatter={() => ''}
                          />
                          <Line
                            type="monotone"
                            dataKey="value"
                            stroke="#f97316"
                            strokeWidth={2}
                            dot={{ r: 3, fill: '#f97316' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    )}

                    {chartData.length === 1 && (
                      <p className="text-xs text-slate-600 mt-1">One test recorded — more tests will show a trend</p>
                    )}

                    {chartData.length === 0 && (
                      <p className="text-xs text-slate-600">No results yet</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {tests.length === 0 && !error && (
        <div className="text-center py-12 text-slate-500">
          <p className="text-4xl mb-3">🏋️</p>
          <p>No performance tests recorded yet.</p>
        </div>
      )}
    </div>
  )
}
