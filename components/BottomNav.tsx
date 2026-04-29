'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Trophy, Droplets, Zap, Users, ChevronLeft, Salad, ShieldAlert, Home, UserPlus, FolderOpen, TrendingUp } from 'lucide-react'

const clientTabs = [
  { href: '/dashboard',   label: 'My Data',     icon: LayoutDashboard },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/performance', label: 'Performance', icon: Zap },
  { href: '/bloods',      label: 'Bloods',      icon: Droplets },
  { href: '/resources',   label: 'Resources',   icon: FolderOpen },
]

const coachTabs = [
  { href: '/home',        label: 'Home',        icon: Home },
  { href: '/clients',     label: 'Clients',     icon: Users },
  { href: '/onboarding',  label: 'Onboarding',  icon: UserPlus },
  { href: '/retention',   label: 'Retention',   icon: ShieldAlert },
  { href: '/revenue',     label: 'Revenue',     icon: TrendingUp },
]

export default function BottomNav({ isCoach }: { isCoach: boolean }) {
  const pathname = usePathname()

  // Detect coach viewing a client: /clients/[id]/...
  const coachViewMatch = pathname.match(/^\/clients\/([^/]+)\//)
  const viewingClientId = coachViewMatch?.[1] ?? null

  if (isCoach && viewingClientId) {
    const viewTabs = [
      { href: `/clients/${viewingClientId}/dashboard`,    label: 'Dashboard',   icon: LayoutDashboard },
      { href: `/clients/${viewingClientId}/performance`,  label: 'Performance', icon: Zap },
      { href: `/clients/${viewingClientId}/nutrition`,    label: 'Nutrition',   icon: Salad },
      { href: `/clients/${viewingClientId}/bloods`,       label: 'Bloods',      icon: Droplets },
    ]

    return (
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 pb-safe">
        <div className="flex">
          <Link
            href="/clients"
            className="flex-1 flex flex-col items-center gap-1 py-3 text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            <ChevronLeft size={20} strokeWidth={1.8} />
            <span className="font-medium">Clients</span>
          </Link>
          {viewTabs.map(({ href, label, icon: Icon }) => {
            const active = pathname === href
            return (
              <Link
                key={href}
                href={href}
                className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                  active ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
                <span className="font-medium">{label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    )
  }

  const tabs = isCoach ? coachTabs : clientTabs

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 pb-safe">
      <div className="flex">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs transition-colors ${
                active ? 'text-orange-400' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
