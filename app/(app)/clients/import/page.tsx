'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, RefreshCw, UserPlus, Check, Loader2 } from 'lucide-react'

interface CRMContact {
  name: string
  email: string
  mobile: string
  birthday: string
  startDate: string
  offerType: string
  weeklyRate: string
  tcSigned: boolean
  expectationsSigned: boolean
  alreadyImported: boolean
}

export default function ImportFromCRMPage() {
  const [contacts, setContacts] = useState<CRMContact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState<string | null>(null)
  const [imported, setImported] = useState<Set<string>>(new Set())

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/crm')
      if (!res.ok) throw new Error('Failed to read CRM sheet')
      setContacts(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading CRM')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleImport(contact: CRMContact) {
    setImporting(contact.email)
    try {
      const res = await fetch('/api/admin/crm/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: contact.name,
          email: contact.email,
          mobile: contact.mobile,
          startDate: contact.startDate,
          offerType: contact.offerType,
          weeklyRate: contact.weeklyRate,
          birthday: contact.birthday,
          tcSigned: contact.tcSigned,
          expectationsSigned: contact.expectationsSigned,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setImported(prev => new Set([...prev, contact.email]))
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(null)
    }
  }

  const pending  = contacts.filter(c => !c.alreadyImported && !imported.has(c.email))
  const done     = contacts.filter(c => c.alreadyImported || imported.has(c.email))

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/clients" className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Import from CRM</h1>
          <p className="text-slate-400 text-sm mt-0.5">Google Sheets → Dashboard</p>
        </div>
        <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
          <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-3xl mb-3 animate-pulse">📋</div>
            <p className="text-slate-400 text-sm">Reading your CRM…</p>
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
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-white">{pending.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">To import</p>
            </div>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 text-center">
              <p className="text-2xl font-bold text-emerald-400">{done.length}</p>
              <p className="text-xs text-slate-400 mt-0.5">Already in system</p>
            </div>
          </div>

          {pending.length > 0 && (
            <div className="mb-6">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Ready to import</p>
              <div className="space-y-3">
                {pending.map(contact => (
                  <ContactCard
                    key={contact.email}
                    contact={contact}
                    onImport={handleImport}
                    importing={importing === contact.email}
                    done={false}
                  />
                ))}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Already in system</p>
              <div className="space-y-3">
                {done.map(contact => (
                  <ContactCard
                    key={contact.email}
                    contact={contact}
                    onImport={handleImport}
                    importing={false}
                    done={true}
                  />
                ))}
              </div>
            </div>
          )}

          {contacts.length === 0 && (
            <div className="text-center py-16">
              <p className="text-white font-semibold mb-1">No contacts found</p>
              <p className="text-slate-500 text-sm">Make sure the sheet is shared with the service account</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ContactCard({
  contact,
  onImport,
  importing,
  done,
}: {
  contact: CRMContact
  onImport: (c: CRMContact) => void
  importing: boolean
  done: boolean
}) {
  return (
    <div className={`rounded-2xl border p-4 ${
      done
        ? 'bg-slate-800/30 border-slate-700/30 opacity-60'
        : 'bg-slate-800/60 border-slate-700/50'
    }`}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-orange-400 font-bold text-xs">
            {contact.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white text-sm">{contact.name || '—'}</p>
          <p className="text-xs text-slate-500 mt-0.5">{contact.email}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {contact.mobile && (
              <span className="text-xs text-slate-400">{contact.mobile}</span>
            )}
            {contact.startDate && (
              <span className="text-xs text-slate-400">Started {contact.startDate}</span>
            )}
            {contact.weeklyRate && (
              <span className="text-xs text-emerald-400 font-medium">${contact.weeklyRate}/wk</span>
            )}
            {contact.offerType && (
              <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">{contact.offerType}</span>
            )}
          </div>
          {(contact.tcSigned || contact.expectationsSigned) && (
            <div className="flex gap-2 mt-2">
              {contact.tcSigned && (
                <span className="text-xs px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full">T&C signed</span>
              )}
              {contact.expectationsSigned && (
                <span className="text-xs px-2 py-0.5 bg-emerald-500/15 text-emerald-400 rounded-full">Expectations signed</span>
              )}
            </div>
          )}
        </div>
        <div className="flex-shrink-0">
          {done ? (
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <Check size={14} className="text-emerald-400" strokeWidth={2.5} />
            </div>
          ) : (
            <button
              onClick={() => onImport(contact)}
              disabled={importing}
              className="w-8 h-8 rounded-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center transition-colors"
            >
              {importing
                ? <Loader2 size={14} className="text-white animate-spin" />
                : <UserPlus size={14} className="text-white" />
              }
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
