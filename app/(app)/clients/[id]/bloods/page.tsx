'use client'

import { useEffect, useState, useRef } from 'react'
import { use } from 'react'
import ReactMarkdown from 'react-markdown'
import BloodMarkerGauge from '@/components/BloodMarkerGauge'
import type { BloodMarker } from '@/lib/sheets/parseBloods'
import { RefreshCw, AlertTriangle, CheckCircle, ChevronRight, ChevronLeft, FileText, Loader2, ExternalLink, CheckCircle2, Upload } from 'lucide-react'

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

function categoryStatusSummary(markers: BloodMarker[]) {
  const issues = markers.filter(m => m.status === 'low' || m.status === 'high' || m.status === 'below_optimal' || m.status === 'above_optimal').length
  const optimal = markers.filter(m => m.status === 'optimal').length
  return { issues, optimal, total: markers.length }
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
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

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending',
  analysed: 'Analysed',
  released: 'Released',
}

const STATUS_COLOUR: Record<string, string> = {
  pending: 'text-amber-400',
  analysed: 'text-blue-400',
  released: 'text-green-400',
}

export default function CoachClientBloods({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [data, setData] = useState<BloodsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'markers' | 'uploads'>('markers')

  // Uploads state
  const [tests, setTests] = useState<BloodTest[]>([])
  const [testsLoading, setTestsLoading] = useState(true)
  const [expandedTest, setExpandedTest] = useState<string | null>(null)
  const [analysing, setAnalysing] = useState<string | null>(null)
  const [justAnalysed, setJustAnalysed] = useState<string | null>(null)
  const [analyseError, setAnalyseError] = useState<Record<string, string>>({})
  const [releasing, setReleasing] = useState<string | null>(null)
  const [savingNotes, setSavingNotes] = useState<string | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadSuccess, setUploadSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  async function loadTests() {
    setTestsLoading(true)
    try {
      const res = await fetch(`/api/blood-tests?clientId=${id}`)
      if (res.ok) {
        const list: BloodTest[] = await res.json()
        setTests(list)
        // Pre-fill note drafts with existing coach notes
        const notes: Record<string, string> = {}
        list.forEach(t => { if (t.coach_notes) notes[t.id] = t.coach_notes })
        setNoteDraft(prev => ({ ...notes, ...prev }))
      }
    } finally {
      setTestsLoading(false)
    }
  }

  useEffect(() => {
    load()
    loadTests()
  }, [id])

  async function handleAnalyse(testId: string) {
    setAnalysing(testId)
    try {
      const res = await fetch(`/api/blood-tests/${testId}/analyse`, { method: 'POST' })
      if (!res.ok) {
        let message = 'Analysis failed'
        try {
          const body = await res.json()
          message = body.error ?? message
        } catch {}
        setAnalyseError(prev => ({ ...prev, [testId]: message }))
        return
      }
      const updated: BloodTest = await res.json()
      setTests(prev => prev.map(t => t.id === testId ? updated : t))
      setExpandedTest(testId)
      setJustAnalysed(testId)
      setTimeout(() => setJustAnalysed(null), 5000)
    } finally {
      setAnalysing(null)
    }
  }

  async function handleSaveNotes(testId: string) {
    setSavingNotes(testId)
    try {
      const res = await fetch(`/api/blood-tests/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach_notes: noteDraft[testId] ?? '' }),
      })
      if (res.ok) {
        const updated: BloodTest = await res.json()
        setTests(prev => prev.map(t => t.id === testId ? updated : t))
      }
    } finally {
      setSavingNotes(null)
    }
  }

  async function handleRelease(testId: string) {
    setReleasing(testId)
    try {
      // Save notes first if there's a draft
      if (noteDraft[testId] !== undefined) {
        await fetch(`/api/blood-tests/${testId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ coach_notes: noteDraft[testId] }),
        })
      }
      const res = await fetch(`/api/blood-tests/${testId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'released' }),
      })
      if (res.ok) {
        const updated: BloodTest = await res.json()
        setTests(prev => prev.map(t => t.id === testId ? updated : t))
      }
    } finally {
      setReleasing(null)
    }
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setUploadError('')
    setUploadSuccess(false)
    try {
      const form = new FormData()
      form.append('file', file)
      form.append('clientId', id)
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

  async function openFile(testId: string) {
    const res = await fetch(`/api/blood-tests/${testId}/file`)
    if (res.ok) {
      const { url } = await res.json()
      window.open(url, '_blank')
    }
  }

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

  const pendingCount = tests.filter(t => t.status === 'pending').length

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

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <p className="text-slate-400 text-sm">Viewing client</p>
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
          Uploads {pendingCount > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5">{pendingCount}</span>}
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

      {/* UPLOADS TAB */}
      {activeTab === 'uploads' && (
        <div className="space-y-4">
          {/* Upload card */}
          <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5">
            <h2 className="font-semibold mb-1">Upload blood test</h2>
            <p className="text-slate-400 text-sm mb-4">Upload on behalf of {data?.client.name}. PDF or photo.</p>
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
            {uploadSuccess && <p className="text-green-400 text-sm mt-3">✓ Uploaded successfully.</p>}
          </div>

          {testsLoading && (
            <div className="text-center py-8 text-slate-500">
              <Loader2 size={20} className="animate-spin mx-auto mb-2" />
              <p className="text-sm">Loading…</p>
            </div>
          )}

          {!testsLoading && tests.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <p className="text-4xl mb-3">📄</p>
              <p className="text-sm">No uploads yet. The client hasn&apos;t uploaded any blood tests.</p>
            </div>
          )}

          {tests.map(test => (
            <div key={test.id} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
              {/* Header row */}
              <button
                onClick={() => setExpandedTest(expandedTest === test.id ? null : test.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-800 transition-colors"
              >
                <FileText size={18} className="text-slate-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{test.file_name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {test.test_date ? `Test: ${formatDate(test.test_date)} · ` : ''}
                    Uploaded {formatDate(test.uploaded_at)}
                  </p>
                </div>
                <span className={`text-xs font-medium ${STATUS_COLOUR[test.status]}`}>
                  {STATUS_LABEL[test.status]}
                </span>
                <ChevronRight
                  size={16}
                  className={`text-slate-500 shrink-0 transition-transform ${expandedTest === test.id ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Expanded panel */}
              {expandedTest === test.id && (
                <div className="border-t border-slate-700/50 p-4 space-y-4">
                  {/* View file */}
                  <button
                    onClick={() => openFile(test.id)}
                    className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors"
                  >
                    <ExternalLink size={14} />
                    View uploaded file
                  </button>

                  {/* Analyse button */}
                  {test.status !== 'released' && (
                    <button
                      onClick={() => handleAnalyse(test.id)}
                      disabled={analysing === test.id}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      {analysing === test.id ? (
                        <><Loader2 size={15} className="animate-spin" /> Reading blood work… this takes ~30–60s</>
                      ) : (
                        test.status === 'analysed' ? '🔄 Re-analyse' : '🤖 Analyse with AI'
                      )}
                    </button>
                  )}

                  {/* Error */}
                  {analyseError[test.id] && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-sm text-red-300">
                      ✗ {analyseError[test.id]}
                    </div>
                  )}

                  {/* Done flash */}
                  {justAnalysed === test.id && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-sm text-green-300">
                      ✓ Analysis complete — review below before releasing to the client.
                    </div>
                  )}

                  {/* Analysing status */}
                  {analysing === test.id && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-sm text-blue-300 animate-pulse">
                      🤖 Claude is reading the blood test and cross-referencing the knowledge base. Don&apos;t close this page…
                    </div>
                  )}

                  {/* AI interpretation */}
                  {test.ai_interpretation && (
                    <div>
                      <p className="text-xs text-slate-500 font-medium mb-2">AI Interpretation</p>
                      <div className="bg-slate-900/50 rounded-xl p-3 max-h-[600px] overflow-y-auto">
                        <MarkdownContent content={test.ai_interpretation} />
                      </div>
                    </div>
                  )}

                  {/* Coach notes */}
                  <div>
                    <p className="text-xs text-slate-500 font-medium mb-2">Your notes (visible to client when released)</p>
                    <textarea
                      value={noteDraft[test.id] ?? test.coach_notes ?? ''}
                      onChange={e => setNoteDraft(prev => ({ ...prev, [test.id]: e.target.value }))}
                      disabled={test.status === 'released'}
                      rows={3}
                      placeholder="Add notes for the client…"
                      className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 placeholder-slate-600 resize-none focus:outline-none focus:border-orange-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {test.status !== 'released' && (
                      <button
                        onClick={() => handleSaveNotes(test.id)}
                        disabled={savingNotes === test.id}
                        className="mt-2 text-xs text-slate-400 hover:text-slate-200 transition-colors disabled:opacity-50"
                      >
                        {savingNotes === test.id ? 'Saving…' : 'Save notes'}
                      </button>
                    )}
                  </div>

                  {/* Release button */}
                  {test.status !== 'released' && test.ai_interpretation && (
                    <button
                      onClick={() => handleRelease(test.id)}
                      disabled={releasing === test.id}
                      className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-500 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      {releasing === test.id ? (
                        <><Loader2 size={15} className="animate-spin" /> Releasing…</>
                      ) : (
                        <><CheckCircle2 size={15} /> Release to client</>
                      )}
                    </button>
                  )}

                  {test.status === 'released' && (
                    <p className="text-xs text-green-400 text-center">
                      ✓ Released to client on {formatDate(test.released_at!)}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
