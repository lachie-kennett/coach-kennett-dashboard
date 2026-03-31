'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import BloodMarkerGauge from '@/components/BloodMarkerGauge'
import type { BloodMarker } from '@/lib/sheets/parseBloods'
import { RefreshCw, AlertTriangle, CheckCircle, ChevronRight, ChevronLeft } from 'lucide-react'

interface BloodsData {
  markers: BloodMarker[]
  client: { name: string; sex: string }
}

const CATEGORIES = [
  'Complete Blood Count',
  'Metabolic Markers',
  'Lipids',
  'Iron Studies',
  'Thyroid Markers',
  'Hormones',
  'Nutrients',
  'MISC',
  'GI MAP',
]

const CATEGORY_ICONS: Record<string, string> = {
  'Complete Blood Count': '🩸',
  'Metabolic Markers':    '🧪',
  'Lipids':               '💊',
  'Iron Studies':         '🔩',
  'Thyroid Markers':      '🦋',
  'Hormones':             '⚡️',
  'Nutrients':            '🥗',
  'MISC':                 '🔬',
  'GI MAP':               '🦠',
}

function categoryStatusSummary(markers: BloodMarker[]) {
  const issues = markers.filter(m => m.status === 'low' || m.status === 'high' || m.status === 'below_optimal' || m.status === 'above_optimal').length
  const optimal = markers.filter(m => m.status === 'optimal').length
  return { issues, optimal, total: markers.length }
}

export default function CoachClientBloods({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<BloodsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/bloods?clientId=${id}`)
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const allMarkers = data?.markers ?? []
  const withData = allMarkers.filter(m => m.latest !== null)
  const focusAreas = allMarkers.filter(m =>
    m.status === 'low' || m.status === 'high' || m.status === 'below_optimal' || m.status === 'above_optimal'
  )
  const optimal = allMarkers.filter(m => m.status === 'optimal')

  const presentCategories = CATEGORIES

  const displayMarkers = activeCategory === 'Focus Areas'
    ? focusAreas
    : activeCategory
      ? allMarkers.filter(m => m.category === activeCategory && m.latest !== null)
      : []

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-3xl mb-3 animate-pulse">🩸</div>
        <p className="text-slate-400">Loading blood work…</p>
      </div>
    </div>
  )

  // Category detail view
  if (activeCategory) {
    return (
      <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setActiveCategory(null)}
            className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">
              {activeCategory === 'Focus Areas'
                ? '⚠️ Focus Areas'
                : `${CATEGORY_ICONS[activeCategory] ?? ''} ${activeCategory}`}
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">{data?.client.name} · {displayMarkers.length} markers</p>
          </div>
          <button onClick={load} className="ml-auto p-2 text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={18} />
          </button>
        </div>

        <div className="space-y-3">
          {displayMarkers.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              {activeCategory === 'Focus Areas'
                ? <><p className="text-4xl mb-3">✅</p><p>All markers are optimal!</p></>
                : <><p className="text-4xl mb-3">🩸</p><p>No data for this category yet.</p></>
              }
            </div>
          )}
          {displayMarkers.map(marker => (
            <BloodMarkerGauge key={`${marker.category}-${marker.name}`} marker={marker} />
          ))}
        </div>
      </div>
    )
  }

  // Category list view
  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Viewing client</p>
          <h1 className="text-2xl font-bold">Blood Work 🩸</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {data?.client.name} · {withData.length} markers tracked
          </p>
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

      {withData.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-3 text-center">
            <AlertTriangle size={16} className="text-red-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-red-400">{focusAreas.length}</p>
            <p className="text-xs text-slate-500">Need attention</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-3 text-center">
            <CheckCircle size={16} className="text-green-400 mx-auto mb-1" />
            <p className="text-xl font-bold text-green-400">{optimal.length}</p>
            <p className="text-xs text-slate-500">Optimal</p>
          </div>
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 text-center">
            <p className="text-xl font-bold text-slate-300 mt-4">{withData.length}</p>
            <p className="text-xs text-slate-500">Total tracked</p>
          </div>
        </div>
      )}

      {focusAreas.length > 0 && (
        <button
          onClick={() => setActiveCategory('Focus Areas')}
          className="w-full flex items-center gap-4 bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mb-3 hover:bg-red-500/20 transition-all text-left"
        >
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="font-semibold text-white">Focus Areas</p>
            <p className="text-xs text-red-400 mt-0.5">{focusAreas.length} marker{focusAreas.length !== 1 ? 's' : ''} need attention</p>
          </div>
          <ChevronRight size={16} className="text-slate-500" />
        </button>
      )}

      <div className="space-y-3">
        {presentCategories.map(cat => {
          const catMarkers = allMarkers.filter(m => m.category === cat && m.latest !== null)
          const { issues, optimal: opt } = categoryStatusSummary(catMarkers)
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="w-full flex items-center gap-4 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-orange-500/40 hover:bg-slate-800 transition-all text-left group"
            >
              <span className="text-2xl">{CATEGORY_ICONS[cat] ?? '🔬'}</span>
              <div className="flex-1">
                <p className="font-semibold text-white group-hover:text-orange-300 transition-colors">{cat}</p>
                <div className="flex gap-3 mt-0.5 text-xs">
                  <span className="text-green-400">{opt} optimal</span>
                  {issues > 0 && <span className="text-red-400">{issues} needs attention</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{catMarkers.length}</span>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
              </div>
            </button>
          )
        })}

        {presentCategories.length === 0 && !error && (
          <div className="text-center py-16 text-slate-500">
            <p className="text-4xl mb-3">🩸</p>
            <p>No blood work data yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
