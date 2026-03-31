'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import StatCard from '@/components/StatCard'
import SectionHeader from '@/components/SectionHeader'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts'
import { RefreshCw } from 'lucide-react'

interface TrackingData {
  months: Array<{
    month: string
    days: Array<{
      date: string
      sleep: string
      steps: string
      stepsGoal: string
      caloriesTracked: string
      caloriesGoal: string
      completedTracker: string
      sessionsTrained: string
      water: string
      energy: string
      sleepScore: string
      weight: string
    }>
    pointsEarned: string
  }>
  stats: {
    adherencePercent: number
    totalSessions: number
    totalPoints: number
    trackedDays: number
    totalDays: number
    monthlyPoints: Array<{ month: string; points: number }>
    currentStreak: number
  }
  client: { name: string }
}

const MONTH_SHORT: Record<string, string> = {
  January:'Jan', February:'Feb', March:'Mar', April:'Apr',
  May:'May', June:'Jun', July:'Jul', August:'Aug',
  September:'Sep', October:'Oct', November:'Nov', December:'Dec',
}

export default function CoachClientDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<TrackingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/tracking?clientId=${id}`)
      if (!res.ok) throw new Error('Failed to load data')
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const recentDays = data?.months
    .flatMap(m => m.days)
    .filter(d => d.completedTracker && d.completedTracker !== '')
    .slice(-30) ?? []

  const sleepTrend = recentDays
    .filter(d => d.sleep && !isNaN(parseFloat(d.sleep)))
    .map(d => ({ date: d.date, value: parseFloat(d.sleep) }))

  const weightTrend = recentDays
    .filter(d => d.weight && !isNaN(parseFloat(d.weight)))
    .map(d => ({ date: d.date, value: parseFloat(d.weight) }))

  const stepsTrend = recentDays
    .filter(d => d.steps && !isNaN(parseFloat(d.steps)))
    .map(d => ({ date: d.date, value: parseFloat(d.steps) }))

  const monthlyPointsData = (data?.stats.monthlyPoints ?? []).map(mp => ({
    month: MONTH_SHORT[mp.month] ?? mp.month,
    points: mp.points,
  }))

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">⚡️</div>
          <p className="text-slate-400">Loading client data…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={load} className="text-orange-400 underline">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-slate-400 text-sm">Viewing client</p>
          <h1 className="text-2xl font-bold">{data?.client.name ?? 'Athlete'}</h1>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Streak banner */}
      {(data?.stats.currentStreak ?? 0) > 0 && (
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl px-4 py-2.5 mb-6 flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <span className="text-orange-300 text-sm font-medium">
            {data?.stats.currentStreak} day streak
          </span>
        </div>
      )}

      {/* Top stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Adherence"
          value={`${data?.stats.adherencePercent ?? 0}%`}
          sub="days tracked"
          accent
          color="orange"
        />
        <StatCard
          label="Points 2026"
          value={data?.stats.totalPoints ?? 0}
          sub="total earned"
          color="green"
        />
        <StatCard
          label="Days Logged"
          value={`${data?.stats.trackedDays ?? 0}/${data?.stats.totalDays ?? 0}`}
          sub="entries complete"
          color="slate"
        />
      </div>

      {/* Monthly Points Chart */}
      {monthlyPointsData.length > 0 && (
        <div className="mb-6">
          <SectionHeader title="Monthly Points" subtitle="Points earned per month" />
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={monthlyPointsData} barSize={24}>
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }}
                  cursor={{ fill: 'rgba(249,115,22,0.1)' }}
                />
                <Bar dataKey="points" fill="#f97316" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Sleep Trend */}
      {sleepTrend.length > 2 && (
        <div className="mb-6">
          <SectionHeader title="Sleep" subtitle="Hours — last 30 days" />
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={sleepTrend}>
                <XAxis dataKey="date" hide />
                <YAxis domain={[4, 10]} hide />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }}
                  formatter={(v) => [`${v}h`, 'Sleep']}
                />
                <Line type="monotone" dataKey="value" stroke="#818cf8" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Steps Trend */}
      {stepsTrend.length > 2 && (
        <div className="mb-6">
          <SectionHeader title="Steps" subtitle="Daily steps — last 30 days" />
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={stepsTrend} barSize={6}>
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }}
                  formatter={(v) => [Number(v).toLocaleString(), 'Steps']}
                />
                <Bar dataKey="value" fill="#22c55e" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Weight Trend */}
      {weightTrend.length > 2 && (
        <div className="mb-6">
          <SectionHeader title="Weight" subtitle="kg — last 30 days" />
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={weightTrend}>
                <XAxis dataKey="date" hide />
                <YAxis domain={['auto','auto']} hide />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9' }}
                  formatter={(v) => [`${v}kg`, 'Weight']}
                />
                <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {recentDays.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p className="text-4xl mb-3">📊</p>
          <p>No data logged yet.</p>
        </div>
      )}
    </div>
  )
}
