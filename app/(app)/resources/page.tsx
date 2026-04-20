'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, FileText, Dumbbell, TableIcon, ClipboardList, Video, Droplets } from 'lucide-react'

interface ClientProfile {
  name: string
  spreadsheet_id: string
  trainerize_url: string | null
  terms_url: string | null
  expectations_url: string | null
  onboarding_form_url: string | null
  step_bloods_reminder_sent: boolean
}

interface ResourceLink {
  label: string
  description: string
  url: string | null
  icon: React.ReactNode
  color: string
  external: boolean
}

export default function ResourcesPage() {
  const [profile, setProfile] = useState<ClientProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/tracking')
        if (!res.ok) return
        const data = await res.json()
        setProfile(data.client)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const resources: ResourceLink[] = [
    {
      label: 'My Tracker',
      description: 'Open your Google Sheet tracker',
      url: profile?.spreadsheet_id
        ? `https://docs.google.com/spreadsheets/d/${profile.spreadsheet_id}`
        : null,
      icon: <TableIcon size={22} />,
      color: 'text-emerald-400',
      external: true,
    },
    {
      label: 'Training App',
      description: 'Open Trainerize',
      url: profile?.trainerize_url ?? null,
      icon: <Dumbbell size={22} />,
      color: 'text-orange-400',
      external: true,
    },
    {
      label: 'Terms & Conditions',
      description: 'View your signed T&C agreement',
      url: profile?.terms_url ?? null,
      icon: <FileText size={22} />,
      color: 'text-blue-400',
      external: true,
    },
    {
      label: 'Expectations Agreement',
      description: 'View your signed expectations doc',
      url: profile?.expectations_url ?? null,
      icon: <FileText size={22} />,
      color: 'text-indigo-400',
      external: true,
    },
    {
      label: 'Onboarding Form',
      description: 'Your roadmap call questionnaire',
      url: profile?.onboarding_form_url ?? null,
      icon: <ClipboardList size={22} />,
      color: 'text-purple-400',
      external: true,
    },
    {
      label: 'Dashboard Guide',
      description: 'Watch how to use this dashboard',
      url: process.env.NEXT_PUBLIC_DASHBOARD_TUTORIAL_URL ?? null,
      icon: <Video size={22} />,
      color: 'text-rose-400',
      external: true,
    },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="text-3xl mb-3 animate-pulse">📁</div>
          <p className="text-slate-400 text-sm">Loading resources…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-4 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Resources 📁</h1>
        <p className="text-slate-400 text-sm mt-0.5">Everything you need in one place</p>
      </div>

      {/* Blood work reminder banner */}
      {profile && !profile.step_bloods_reminder_sent && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <Droplets size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-white">Blood work reminder</p>
            <p className="text-xs text-slate-400 mt-0.5">
              Make sure you've ordered your blood work and sent the results through to Lachie when they arrive.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {resources.map(resource => (
          resource.url ? (
            <a
              key={resource.label}
              href={resource.url}
              target={resource.external ? '_blank' : undefined}
              rel={resource.external ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-4 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 hover:border-orange-500/40 hover:bg-slate-800 transition-all group"
            >
              <div className={`w-10 h-10 rounded-xl bg-slate-700/60 flex items-center justify-center flex-shrink-0 ${resource.color}`}>
                {resource.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-white text-sm group-hover:text-orange-300 transition-colors">
                  {resource.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{resource.description}</p>
              </div>
              <ExternalLink size={14} className="text-slate-600 group-hover:text-slate-400 flex-shrink-0 transition-colors" />
            </a>
          ) : (
            <div
              key={resource.label}
              className="flex items-center gap-4 bg-slate-800/30 border border-slate-700/30 rounded-2xl p-4 opacity-50 cursor-not-allowed"
            >
              <div className={`w-10 h-10 rounded-xl bg-slate-700/40 flex items-center justify-center flex-shrink-0 text-slate-600`}>
                {resource.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-400 text-sm">{resource.label}</p>
                <p className="text-xs text-slate-600 mt-0.5">Not yet available</p>
              </div>
            </div>
          )
        ))}
      </div>
    </div>
  )
}
