'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Save, ExternalLink } from 'lucide-react'

interface ClientData {
  id: string
  name: string
  email: string
  sex: string
  spreadsheet_id: string
  package_end_date: string | null
  whatsapp_number: string | null
}

export default function EditClientPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [form, setForm] = useState({
    name: '',
    sex: 'Male',
    whatsappNumber: '',
    packageEndDate: '',
    spreadsheetUrl: '',
    trainerizeUrl: '',
    termsUrl: '',
    expectationsUrl: '',
    onboardingFormUrl: '',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function fetchClient() {
      try {
        const res = await fetch(`/api/admin/clients/${id}`)
        if (!res.ok) throw new Error('Failed to load client')
        const data: ClientData = await res.json()
        setForm({
          name: data.name,
          sex: data.sex,
          whatsappNumber: data.whatsapp_number ?? '',
          packageEndDate: data.package_end_date ?? '',
          spreadsheetUrl: data.spreadsheet_id,
          trainerizeUrl: (data as Record<string, string>).trainerize_url ?? '',
          termsUrl: (data as Record<string, string>).terms_url ?? '',
          expectationsUrl: (data as Record<string, string>).expectations_url ?? '',
          onboardingFormUrl: (data as Record<string, string>).onboarding_form_url ?? '',
        })
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    }
    fetchClient()
  }, [id])

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    setSuccess(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetch(`/api/admin/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          sex: form.sex,
          whatsappNumber: form.whatsappNumber,
          packageEndDate: form.packageEndDate,
          spreadsheetUrl: form.spreadsheetUrl,
          trainerizeUrl: form.trainerizeUrl,
          termsUrl: form.termsUrl,
          expectationsUrl: form.expectationsUrl,
          onboardingFormUrl: form.onboardingFormUrl,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to save')
      setSuccess(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">✏️</div>
          <p className="text-slate-400 text-sm">Loading client…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link
          href={`/clients/${id}/dashboard`}
          className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Edit Client</h1>
          <p className="text-slate-400 text-sm mt-0.5">Update details & contact info</p>
        </div>
        <a
          href={`https://docs.google.com/spreadsheets/d/${form.spreadsheetUrl.includes('/') ? form.spreadsheetUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/)?.[1] ?? form.spreadsheetUrl : form.spreadsheetUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors"
        >
          <ExternalLink size={13} />
          Spreadsheet
        </a>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Full Name</label>
          <input
            type="text"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">WhatsApp Number</label>
          <input
            type="tel"
            value={form.whatsappNumber}
            onChange={e => update('whatsappNumber', e.target.value)}
            placeholder="+61412345678"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <p className="text-xs text-slate-500 mt-1.5">Include country code — used for tracker nudges</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Package End Date <span className="text-slate-500 font-normal">(optional)</span></label>
          <input
            type="date"
            value={form.packageEndDate}
            onChange={e => update('packageEndDate', e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Sex</label>
          <div className="flex gap-3">
            {['Male', 'Female'].map(s => (
              <button
                key={s}
                type="button"
                onClick={() => update('sex', s)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-colors ${
                  form.sex === s
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Trainerize URL <span className="text-slate-500 font-normal">(optional)</span></label>
          <input
            type="url"
            value={form.trainerizeUrl}
            onChange={e => update('trainerizeUrl', e.target.value)}
            placeholder="https://app.trainerize.com/..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Terms & Conditions URL <span className="text-slate-500 font-normal">(optional)</span></label>
          <input
            type="url"
            value={form.termsUrl}
            onChange={e => update('termsUrl', e.target.value)}
            placeholder="https://docs.google.com/..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <p className="text-xs text-slate-500 mt-1.5">Google Doc with T&C for eSign request</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Expectations Agreement URL <span className="text-slate-500 font-normal">(optional)</span></label>
          <input
            type="url"
            value={form.expectationsUrl}
            onChange={e => update('expectationsUrl', e.target.value)}
            placeholder="https://docs.google.com/..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
          <p className="text-xs text-slate-500 mt-1.5">Google Doc with expectations agreement for eSign request</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Onboarding Form URL <span className="text-slate-500 font-normal">(optional)</span></label>
          <input
            type="url"
            value={form.onboardingFormUrl}
            onChange={e => update('onboardingFormUrl', e.target.value)}
            placeholder="https://docs.google.com/forms/..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">Google Sheet URL or ID</label>
          <input
            type="text"
            value={form.spreadsheetUrl}
            onChange={e => update('spreadsheetUrl', e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/... or sheet ID"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition-colors"
          />
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3">
            <p className="text-emerald-400 text-sm">Saved successfully</p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-colors"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/clients/${id}/dashboard`)}
            className="px-5 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-xl transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
