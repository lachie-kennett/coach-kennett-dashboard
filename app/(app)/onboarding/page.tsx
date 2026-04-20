'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, UserPlus, ChevronRight, Check, Loader2 } from 'lucide-react'

interface OnboardingClient {
  id: string
  name: string
  email: string
  created_at: string
  drive_folder_url: string | null
  trainerize_url: string | null
  terms_url: string | null
  expectations_url: string | null
  onboarding_form_url: string | null
  step_form_sent: boolean
  step_terms_signed: boolean
  step_expectations_signed: boolean
  step_trainerize_setup: boolean
  step_tracker_created: boolean
  step_bloods_reminder_sent: boolean
  step_intro_call_done: boolean
}

const STEPS: { key: keyof OnboardingClient; label: string; emoji: string }[] = [
  { key: 'step_form_sent',            label: 'Onboarding form sent',       emoji: '📋' },
  { key: 'step_terms_signed',         label: 'T&C signed',                 emoji: '✍️' },
  { key: 'step_expectations_signed',  label: 'Expectations agreement signed', emoji: '🤝' },
  { key: 'step_trainerize_setup',     label: 'Trainerize set up',          emoji: '💪' },
  { key: 'step_tracker_created',      label: 'Tracker created',            emoji: '📊' },
  { key: 'step_bloods_reminder_sent', label: 'Bloods reminder sent',       emoji: '🩸' },
  { key: 'step_intro_call_done',      label: 'Intro call done',            emoji: '📞' },
]

function completedCount(client: OnboardingClient): number {
  return STEPS.filter(s => client[s.key] === true).length
}

function StepDot({ done }: { done: boolean }) {
  return (
    <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
      done ? 'bg-emerald-500' : 'bg-slate-700'
    }`}>
      {done && <Check size={11} strokeWidth={3} className="text-white" />}
    </div>
  )
}

const TERMS_URL = process.env.NEXT_PUBLIC_TERMS_TEMPLATE_URL
const EXPECTATIONS_URL = process.env.NEXT_PUBLIC_EXPECTATIONS_TEMPLATE_URL

function ClientOnboardingCard({ client, onToggle, setupLoading }: {
  client: OnboardingClient
  onToggle: (clientId: string, step: string, value: boolean) => void
  setupLoading: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const done = completedCount(client)
  const total = STEPS.length
  const allDone = done === total

  return (
    <div className={`rounded-2xl border overflow-hidden ${
      allDone
        ? 'bg-emerald-500/5 border-emerald-500/20'
        : 'bg-slate-800/60 border-slate-700/50'
    }`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-orange-400 font-bold text-xs">
            {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm truncate">{client.name}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {done}/{total} steps complete
            {allDone && <span className="text-emerald-400 ml-1">· All done ✓</span>}
          </p>
        </div>
        {/* Progress dots */}
        <div className="flex gap-1 mr-2">
          {STEPS.map(s => (
            <StepDot key={s.key as string} done={client[s.key] as boolean} />
          ))}
        </div>
        <ChevronRight
          size={14}
          className={`text-slate-600 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Expanded checklist */}
      {expanded && (
        <div className="px-4 pb-4 space-y-1 border-t border-slate-700/50 pt-3">
          {STEPS.map(step => {
            const done = client[step.key] as boolean
            const isTrackerStep = step.key === 'step_tracker_created'

            return (
              <div key={step.key as string} className="flex items-center gap-3 py-1.5">
                <button
                  onClick={() => onToggle(client.id, step.key as string, !done)}
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border transition-colors ${
                    done
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'bg-transparent border-slate-600 hover:border-orange-400'
                  }`}
                >
                  {done && <Check size={11} strokeWidth={3} className="text-white" />}
                </button>
                <span className="text-sm">{step.emoji}</span>
                <span className={`text-sm flex-1 ${done ? 'text-slate-400 line-through' : 'text-white'}`}>
                  {step.label}
                </span>

                {/* Auto-setup button for tracker */}
                {isTrackerStep && !done && (
                  <button
                    onClick={() => onToggle(client.id, 'auto_setup_tracker', true)}
                    disabled={setupLoading === client.id}
                    className="flex items-center gap-1 text-xs text-orange-400 hover:text-orange-300 transition-colors disabled:opacity-50"
                  >
                    {setupLoading === client.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : '⚡️'
                    }
                    Auto-create
                  </button>
                )}

                {/* Open T&C doc */}
                {step.key === 'step_terms_signed' && (
                  <a
                    href={client.terms_url ?? TERMS_URL ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {client.terms_url ? 'Open signed' : 'Open template'}
                  </a>
                )}

                {/* Open Expectations doc */}
                {step.key === 'step_expectations_signed' && (
                  <a
                    href={client.expectations_url ?? EXPECTATIONS_URL ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    {client.expectations_url ? 'Open signed' : 'Open template'}
                  </a>
                )}
              </div>
            )
          })}

          {/* Links row */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-700/50 mt-2">
            <Link
              href={`/clients/${client.id}/edit`}
              className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
            >
              Edit details
            </Link>
            {client.drive_folder_url && (
              <a href={client.drive_folder_url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                Drive folder
              </a>
            )}
            {client.trainerize_url && (
              <a href={client.trainerize_url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                Trainerize
              </a>
            )}
            {client.terms_url && (
              <a href={client.terms_url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                T&C
              </a>
            )}
            {client.expectations_url && (
              <a href={client.expectations_url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors">
                Expectations
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function OnboardingPage() {
  const [clients, setClients] = useState<OnboardingClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [setupLoading, setSetupLoading] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/clients')
      if (!res.ok) throw new Error('Failed to load')
      const data = await res.json()
      setClients(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleToggle(clientId: string, step: string, value: boolean) {
    // Auto-create tracker via Drive API
    if (step === 'auto_setup_tracker') {
      setSetupLoading(clientId)
      try {
        const res = await fetch('/api/admin/setup-client', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ clientId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        await load()
      } catch (e: unknown) {
        alert(e instanceof Error ? e.message : 'Setup failed')
      } finally {
        setSetupLoading(null)
      }
      return
    }

    // Regular step toggle
    setClients(prev => prev.map(c =>
      c.id === clientId ? { ...c, [step]: value } : c
    ))
    await fetch(`/api/admin/clients/${clientId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [step]: value }),
    })
  }

  const incomplete = clients.filter(c => completedCount(c) < STEPS.length)
  const complete   = clients.filter(c => completedCount(c) === STEPS.length)

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Coach view</p>
          <h1 className="text-2xl font-bold">Onboarding 🚀</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <Link href="/clients/new" className="p-2 text-slate-400 hover:text-orange-400 transition-colors">
            <UserPlus size={18} />
          </Link>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-3xl mb-3 animate-pulse">🚀</div>
            <p className="text-slate-400 text-sm">Loading onboarding…</p>
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
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-amber-400">{incomplete.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">In progress</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{complete.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">Fully onboarded</p>
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="text-center py-16">
              <UserPlus size={48} className="mx-auto mb-4 text-slate-700" />
              <p className="text-white font-semibold mb-1">No clients yet</p>
              <Link href="/clients/new" className="text-orange-400 underline text-sm">Add your first client</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {incomplete.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">In progress</p>
                  <div className="space-y-3">
                    {incomplete.map(c => (
                      <ClientOnboardingCard key={c.id} client={c} onToggle={handleToggle} setupLoading={setupLoading} />
                    ))}
                  </div>
                </div>
              )}
              {complete.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Fully onboarded</p>
                  <div className="space-y-3">
                    {complete.map(c => (
                      <ClientOnboardingCard key={c.id} client={c} onToggle={handleToggle} setupLoading={setupLoading} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
