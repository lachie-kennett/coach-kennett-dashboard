'use client'

import { useEffect, useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import BloodMarkerGauge from '@/components/BloodMarkerGauge'
import type { BloodMarker } from '@/lib/sheets/parseBloods'
import { RefreshCw, AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, Upload, FileText, Clock, Loader2 } from 'lucide-react'

interface BloodsData {
  markers: BloodMarker[]
  client: { name: string; sex: string }
}

interface BloodTest {
  id: string
  client_id: string
  uploaded_at: string
  file_name: string
  file_type: string
  test_date: string | null
  ai_interpretation: string | null
  coach_notes: string | null
  status: 'pending' | 'analysed' | 'released'
  released_at: string | null
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

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <h1 className="text-base font-bold text-white mt-4 mb-2 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-white mt-4 mb-2 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-orange-300 mt-3 mb-1">{children}</h3>,
        p: ({ children }) => <p className="text-sm text-slate-300 leading-relaxed mb-3">{children}</p>,
        ul: ({ children }) => <ul className="space-y-1 mb-3 ml-3">{children}</ul>,
        ol: ({ children }) => <ol className="space-y-1 mb-3 ml-3 list-decimal list-inside">{children}</ol>,
        li: ({ children }) => <li className="text-sm text-slate-300 leading-relaxed flex gap-2"><span className="text-orange-400 mt-1 shrink-0">•</span><span>{children}</span></li>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em: ({ children }) => <em className="text-slate-400">{children}</em>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-orange-400 underline hover:text-orange-300">{children}</a>,
        hr: () => <hr className="border-slate-700 my-4" />,
        blockquote: ({ children }) => <blockquote className="border-l-2 border-orange-500/50 pl-3 my-2 text-slate-400 italic">{children}</blockquote>,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

function categoryStatusSummary(markers: BloodMarker[]) {
  const issues = markers.filter(m => m.status === 'low' || m.status === 'high' || m.status === 'below_optimal' || m.status === 'above_optimal').length
  const optimal = markers.filter(m => m.status === 'optimal').length
  return { issues, optimal, total: markers.length }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function BloodsPage() {
  const [data, setData] = useState<BloodsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'markers' | 'uploads'>('markers')

  // Upload state
  const [tests, setTests] = useState<BloodTest[]>([])
  const [testsLoading, setTestsLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const [expandedTest, setExpandedTest] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/bloods')
      if (!res.ok) throw new Error('Failed to load')
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  async function loadTests() {
    setTestsLoading(true)
    try {
      const res = await fetch('/api/blood-tests')
      if (res.ok) setTests(await res.json())
    } finally {
      setTestsLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadTests()
  }, [])

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadError('')
    setUploadSuccess(false)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/blood-tests/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error ?? 'Upload failed')
      }
      setUploadSuccess(true)
      await loadTests()
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  const releasedTests = tests.filter(t => t.status === 'released')
  const pendingTests = tests.filter(t => t.status !== 'released')

  const allMarkers = data?.markers ?? []
  const withData = allMarkers.filter(m => m.latest !== null)
  const focusAreas = allMarkers.filter(m =>
    m.status === 'low' || m.status === 'high' || m.status === 'below_optimal' || m.status === 'above_optimal'
  )
  const optimal = allMarkers.filter(m => m.status === 'optimal')

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
            <p className="text-slate-400 text-sm mt-0.5">{displayMarkers.length} markers</p>
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

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Blood Work 🩸</h1>
          <p className="text-slate-400 text-sm mt-0.5">{data?.client.name}</p>
        </div>
        <button onClick={() => { load(); loadTests() }} className="p-2 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-800/60 rounded-xl p-1 mb-5">
        <button
          onClick={() => setActiveTab('markers')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'markers' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
        >
          Markers
        </button>
        <button
          onClick={() => setActiveTab('uploads')}
          className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'uploads' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'}`}
        >
          AI Analysis {releasedTests.length > 0 && <span className="ml-1 bg-orange-500 text-white text-xs rounded-full px-1.5">{releasedTests.length}</span>}
        </button>
      </div>

      {/* MARKERS TAB */}
      {activeTab === 'markers' && (
        <>
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
            {CATEGORIES.map(cat => {
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

            {CATEGORIES.length === 0 && !error && (
              <div className="text-center py-16 text-slate-500">
                <p className="text-4xl mb-3">🩸</p>
                <p>No blood work data yet.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* UPLOADS / AI ANALYSIS TAB */}
      {activeTab === 'uploads' && (
        <div className="space-y-4">
          {/* Upload card */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
            <h2 className="font-semibold mb-1">Upload a blood test</h2>
            <p className="text-slate-400 text-sm mb-4">Upload your results as a PDF or photo. Lachie will review and send you his analysis.</p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={onFileChange}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {uploading ? (
                <><Loader2 size={18} className="animate-spin" /> Uploading…</>
              ) : (
                <><Upload size={18} /> Choose file</>
              )}
            </button>

            {uploadError && <p className="text-red-400 text-sm mt-3">{uploadError}</p>}
            {uploadSuccess && <p className="text-green-400 text-sm mt-3">✓ Uploaded — Lachie will review it shortly.</p>}
          </div>

          {/* Pending uploads */}
          {pendingTests.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-2 px-1">Pending review</p>
              <div className="space-y-2">
                {pendingTests.map(test => (
                  <div key={test.id} className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4">
                    <FileText size={18} className="text-slate-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{test.file_name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{formatDate(test.uploaded_at)}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-amber-400">
                      <Clock size={12} />
                      <span>Pending</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Released interpretations */}
          {releasedTests.length > 0 && (
            <div>
              <p className="text-slate-500 text-xs uppercase tracking-wider font-medium mb-2 px-1">Analysis ready</p>
              <div className="space-y-3">
                {releasedTests.map(test => (
                  <div key={test.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <button
                      onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                      className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800 transition-colors"
                    >
                      <FileText size={18} className="text-orange-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{test.file_name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {test.test_date ? `Test date: ${formatDate(test.test_date)} · ` : ''}
                          Released {formatDate(test.released_at!)}
                        </p>
                      </div>
                      <ChevronRight
                        size={16}
                        className={`text-slate-500 shrink-0 transition-transform ${expandedTest === test.id ? 'rotate-90' : ''}`}
                      />
                    </button>

                    {expandedTest === test.id && (
                      <div className="border-t border-slate-700/50 p-4 space-y-4">
                        {test.coach_notes && (
                          <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                            <p className="text-xs text-orange-400 font-medium mb-1">Lachie&apos;s notes</p>
                            <p className="text-sm text-slate-200 whitespace-pre-wrap">{test.coach_notes}</p>
                          </div>
                        )}
                        {test.ai_interpretation && (
                          <div>
                            <p className="text-xs text-slate-500 font-medium mb-2">AI Interpretation</p>
                            <MarkdownContent content={test.ai_interpretation} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {testsLoading && (
            <div className="text-center py-8 text-slate-500">
              <Loader2 size={20} className="animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading…</p>
            </div>
          )}

          {!testsLoading && tests.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <p className="text-4xl mb-3">🩸</p>
              <p className="text-sm">No uploads yet. Upload your blood test results above.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
