'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import SectionHeader from '@/components/SectionHeader'
import { RefreshCw, Copy, Check } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, ReferenceLine, Legend,
} from 'recharts'

interface DayEntry {
  date: string
  caloriesTracked: string
  caloriesGoal: string
  proteinTracked: string
  proteinGoal: string
  carbTracked: string
  carbGoal: string
  fatTracked: string
  fatGoal: string
  nutritionQualitative: string
}

interface TrackingData {
  months: Array<{ month: string; days: DayEntry[] }>
  client: { name: string }
}

interface MealPlanDay {
  day: string
  planName: string
  meals: string[]
  miscellaneous: string
  supplements: string
}

interface ShoppingItem {
  name: string
  notes: string
  calories: string
  protein: string
  fat: string
  carbs: string
  per: string
}

const QUAL_SCORE: Record<string, number> = {
  'Excellent': 4, 'Good': 3, 'Average': 2, 'Poor': 1, 'Terrible': 0,
  'excellent': 4, 'good': 3, 'average': 2, 'poor': 1, 'terrible': 0,
}

function num(v: string) {
  const n = parseFloat(v)
  return isNaN(n) ? null : n
}

type Tab = 'tracked' | 'mealplan' | 'shopping'

export default function CoachClientNutrition({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<TrackingData | null>(null)
  const [mealPlan, setMealPlan] = useState<MealPlanDay[]>([])
  const [shopping, setShopping] = useState<ShoppingItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('tracked')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const [copied, setCopied] = useState(false)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [trackingRes, mealRes, shopRes] = await Promise.all([
        fetch(`/api/tracking?clientId=${id}`),
        fetch(`/api/mealplan?clientId=${id}`),
        fetch(`/api/shoppinglist?clientId=${id}`),
      ])
      if (!trackingRes.ok) throw new Error('Failed to load')
      setData(await trackingRes.json())
      if (mealRes.ok) setMealPlan((await mealRes.json()).days ?? [])
      if (shopRes.ok) setShopping((await shopRes.json()).items ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const allDays = data?.months.flatMap(m => m.days) ?? []
  const recentDays = allDays
    .filter(d => d.caloriesTracked || d.proteinTracked || d.nutritionQualitative)
    .slice(-30)

  const calorieDays = recentDays.filter(d => num(d.caloriesTracked) !== null)
  const calorieData = calorieDays.map(d => ({ date: d.date, calories: num(d.caloriesTracked)! }))
  const macroDays = recentDays.filter(d => num(d.proteinTracked) !== null)
  const macroData = macroDays.map(d => ({
    date: d.date,
    protein: num(d.proteinTracked),
    carbs: num(d.carbTracked),
    fat: num(d.fatTracked),
  }))
  const avgCalories = calorieDays.length ? Math.round(calorieDays.reduce((s, d) => s + num(d.caloriesTracked)!, 0) / calorieDays.length) : null
  const avgProtein = macroDays.length ? Math.round(macroDays.reduce((s, d) => s + (num(d.proteinTracked) ?? 0), 0) / macroDays.length) : null
  const calorieGoal = num(calorieDays[0]?.caloriesGoal) ?? null
  const proteinGoal = num(macroDays[0]?.proteinGoal) ?? null
  const qualDays = recentDays.filter(d => QUAL_SCORE[d.nutritionQualitative] !== undefined)
  const qualData = qualDays.map(d => ({ date: d.date, score: QUAL_SCORE[d.nutritionQualitative], label: d.nutritionQualitative }))
  const avgQual = qualDays.length ? qualDays.reduce((s, d) => s + QUAL_SCORE[d.nutritionQualitative], 0) / qualDays.length : null
  const qualLabel = avgQual === null ? null : avgQual >= 3.5 ? 'Excellent' : avgQual >= 2.5 ? 'Good' : avgQual >= 1.5 ? 'Average' : 'Poor'
  const qualColor = avgQual === null ? 'text-slate-500' : avgQual >= 3.5 ? 'text-green-400' : avgQual >= 2.5 ? 'text-yellow-400' : 'text-red-400'

  function toggleCheck(i: number) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  async function copyList() {
    const text = shopping.map(item => {
      let line = `• ${item.name}`
      if (item.notes) line += ` — ${item.notes}`
      return line
    }).join('\n')
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl mb-3 animate-pulse">🥗</div>
        <p className="text-slate-400">Loading nutrition…</p>
      </div>
    </div>
  )

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Viewing client</p>
          <h1 className="text-2xl font-bold">Nutrition 🥗</h1>
          {data?.client.name && <p className="text-slate-400 text-sm mt-0.5">{data.client.name}</p>}
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {([
          { key: 'tracked', label: '📊 Tracked' },
          { key: 'mealplan', label: '🍽️ Meal Plan' },
          { key: 'shopping', label: '🛒 Shopping' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tracked tab */}
      {tab === 'tracked' && (
        <>
          {calorieData.length === 0 && macroData.length === 0 && qualData.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-4xl mb-3">📊</p>
              <p>No nutrition data logged yet.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-6">
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Avg Calories</p>
                  <p className="text-2xl font-bold text-orange-400">{avgCalories ?? '—'}</p>
                  {calorieGoal && <p className="text-xs text-slate-500 mt-0.5">Goal: {calorieGoal}</p>}
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Diet Quality</p>
                  <p className={`text-2xl font-bold ${qualColor}`}>{qualLabel ?? '—'}</p>
                  {avgQual !== null && <p className="text-xs text-slate-500 mt-0.5">{avgQual.toFixed(1)} / 4.0 avg</p>}
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Avg Protein</p>
                  <p className="text-2xl font-bold text-blue-400">{avgProtein ?? '—'}<span className="text-sm font-normal text-slate-500">g</span></p>
                  {proteinGoal && <p className="text-xs text-slate-500 mt-0.5">Goal: {proteinGoal}g</p>}
                </div>
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">Days Tracked</p>
                  <p className="text-2xl font-bold text-green-400">{calorieDays.length}</p>
                  <p className="text-xs text-slate-500 mt-0.5">last 30 days</p>
                </div>
              </div>

              {calorieData.length > 2 && (
                <div className="mb-6">
                  <SectionHeader title="Calories" subtitle="Last 30 days" />
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                    <ResponsiveContainer width="100%" height={130}>
                      <BarChart data={calorieData} barSize={8}>
                        <XAxis dataKey="date" hide />
                        <YAxis hide domain={['auto', 'auto']} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} formatter={(v) => [`${v} kcal`, 'Calories']} />
                        {calorieGoal && <ReferenceLine y={calorieGoal} stroke="#f97316" strokeDasharray="4 2" strokeOpacity={0.5} />}
                        <Bar dataKey="calories" fill="#f97316" radius={[3, 3, 0, 0]} opacity={0.9} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {macroData.length > 2 && (
                <div className="mb-6">
                  <SectionHeader title="Macros" subtitle="Protein · Carbs · Fat (g)" />
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                    <ResponsiveContainer width="100%" height={130}>
                      <LineChart data={macroData}>
                        <XAxis dataKey="date" hide />
                        <YAxis hide />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} formatter={(v, name) => [`${v}g`, name]} />
                        <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} formatter={(v) => v.charAt(0).toUpperCase() + v.slice(1)} />
                        <Line type="monotone" dataKey="protein" stroke="#60a5fa" strokeWidth={2} dot={false} name="protein" />
                        <Line type="monotone" dataKey="carbs" stroke="#a78bfa" strokeWidth={2} dot={false} name="carbs" />
                        <Line type="monotone" dataKey="fat" stroke="#fb923c" strokeWidth={2} dot={false} name="fat" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {qualData.length > 2 && (
                <div className="mb-6">
                  <SectionHeader title="Diet Quality" subtitle="Self-reported — last 30 days" />
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                    <ResponsiveContainer width="100%" height={100}>
                      <BarChart data={qualData} barSize={8}>
                        <XAxis dataKey="date" hide />
                        <YAxis hide domain={[0, 4]} />
                        <Tooltip contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, color: '#f1f5f9', fontSize: 12 }} formatter={(_, __, props) => [props.payload.label, 'Quality']} />
                        <Bar dataKey="score" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="flex justify-between mt-2 text-xs text-slate-600">
                      <span>Poor</span><span>Average</span><span>Good</span><span>Excellent</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Meal Plan tab */}
      {tab === 'mealplan' && (
        <>
          {mealPlan.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-4xl mb-3">🍽️</p>
              <p>No meal plan yet.</p>
            </div>
          ) : (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar mb-4">
                {mealPlan.map(d => (
                  <button
                    key={d.day}
                    onClick={() => setSelectedDay(selectedDay === d.day ? null : d.day)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex-shrink-0 ${
                      selectedDay === d.day ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {d.day}
                  </button>
                ))}
              </div>

              {!selectedDay && <p className="text-slate-500 text-sm text-center py-8">Select a day above to view meals</p>}

              {selectedDay && (() => {
                const day = mealPlan.find(d => d.day === selectedDay)
                if (!day) return null
                return (
                  <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 space-y-5">
                    {day.planName && <p className="text-xs text-orange-400 font-medium uppercase tracking-wide">{day.planName}</p>}
                    {day.meals.map((meal, i) => !meal ? null : (
                      <div key={i} className="border-b border-slate-700/50 pb-4 last:border-0 last:pb-0">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Meal {i + 1}</p>
                        <p className="text-sm text-white whitespace-pre-line leading-relaxed">{meal}</p>
                      </div>
                    ))}
                    {day.miscellaneous && (
                      <div className="border-b border-slate-700/50 pb-4">
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Miscellaneous</p>
                        <p className="text-sm text-white whitespace-pre-line">{day.miscellaneous}</p>
                      </div>
                    )}
                    {day.supplements && (
                      <div>
                        <p className="text-xs text-slate-500 uppercase tracking-wide mb-1.5">Supplements</p>
                        <p className="text-sm text-white whitespace-pre-line">{day.supplements}</p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </>
          )}
        </>
      )}

      {/* Shopping List tab */}
      {tab === 'shopping' && (
        <>
          {shopping.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <p className="text-4xl mb-3">🛒</p>
              <p>No shopping list yet.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <p className="text-slate-400 text-sm">{shopping.length} items · {checked.size} checked off</p>
                <div className="flex gap-2">
                  {checked.size > 0 && (
                    <button onClick={() => setChecked(new Set())} className="text-xs text-slate-500 hover:text-white transition-colors">Clear</button>
                  )}
                  <button
                    onClick={copyList}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 rounded-lg text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                    {copied ? 'Copied!' : 'Copy list'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {shopping.map((item, i) => {
                  const isChecked = checked.has(i)
                  const hasMacros = item.calories || item.protein || item.fat || item.carbs
                  return (
                    <button
                      key={i}
                      onClick={() => toggleCheck(i)}
                      className={`w-full flex items-start gap-3 rounded-2xl p-4 border text-left transition-all ${
                        isChecked ? 'bg-slate-800/30 border-slate-700/30 opacity-50' : 'bg-slate-800/60 border-slate-700/50 hover:border-orange-500/30'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                        isChecked ? 'bg-green-500 border-green-500' : 'border-slate-600'
                      }`}>
                        {isChecked && <Check size={11} className="text-white" strokeWidth={3} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${isChecked ? 'line-through text-slate-500' : 'text-white'}`}>{item.name}</p>
                        {item.notes && <p className="text-xs text-slate-500 mt-0.5">{item.notes}</p>}
                        {hasMacros && (
                          <div className="flex gap-3 mt-1.5 text-xs text-slate-600">
                            {item.calories && <span>{item.calories} kcal</span>}
                            {item.protein && <span>{item.protein}g protein</span>}
                            {item.carbs && <span>{item.carbs}g carbs</span>}
                            {item.fat && <span>{item.fat}g fat</span>}
                            {item.per && <span>per {item.per}</span>}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
