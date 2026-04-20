'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Users, Plus, LogOut, RefreshCw, ChevronRight, Pencil, Sheet } from 'lucide-react'

interface ClientSummary {
  id: string
  name: string
  email: string
  sex: string
  spreadsheet_id: string
  created_at: string
}

export default function ClientsPage() {
  const [clients, setClients] = useState<ClientSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/clients')
      if (!res.ok) throw new Error('Failed to load clients')
      setClients(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error loading clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-slate-400 text-sm">Coach view</p>
          <h1 className="text-2xl font-bold">Clients 👥</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 text-slate-400 hover:text-white transition-colors">
            <RefreshCw size={18} />
          </button>
          <Link
            href="/clients/import"
            className="p-2 text-slate-400 hover:text-orange-400 transition-colors"
            title="Import from CRM"
          >
            <Sheet size={18} />
          </Link>
          <Link
            href="/clients/new"
            className="p-2 text-slate-400 hover:text-orange-400 transition-colors"
            title="Add client manually"
          >
            <Plus size={18} />
          </Link>
          <button onClick={handleSignOut} className="p-2 text-slate-400 hover:text-white transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-3xl mb-3 animate-pulse">👥</div>
            <p className="text-slate-400 text-sm">Loading clients…</p>
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
          <p className="text-slate-500 text-sm mb-4">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
          <div className="space-y-3">
            {clients.map(client => (
              <div
                key={client.id}
                className="flex items-center gap-4 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-orange-500/40 hover:bg-slate-800 transition-all group"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-400 font-bold text-sm">
                    {client.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <Link href={`/clients/${client.id}/dashboard`} className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate group-hover:text-orange-300 transition-colors">
                    {client.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{client.email}</p>
                </Link>

                <Link
                  href={`/clients/${client.id}/edit`}
                  className="p-2 text-slate-600 hover:text-orange-400 transition-colors flex-shrink-0"
                  title="Edit client"
                  onClick={e => e.stopPropagation()}
                >
                  <Pencil size={15} />
                </Link>
                <Link href={`/clients/${client.id}/dashboard`} className="flex-shrink-0">
                  <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                </Link>
              </div>
            ))}

            {clients.length === 0 && (
              <div className="text-center py-16">
                <Users size={40} className="mx-auto mb-4 text-slate-700" />
                <p className="text-slate-500 mb-2">No clients yet</p>
                <Link href="/clients/new" className="text-orange-400 underline text-sm">
                  Add your first client
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
