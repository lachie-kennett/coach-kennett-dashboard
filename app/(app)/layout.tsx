export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import BottomNav from '@/components/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data: profile } = await admin.from('clients').select('is_coach').eq('id', user.id).single()
  const isCoach = profile?.is_coach === true

  return (
    <div className="min-h-screen pb-20">
      {children}
      <Suspense fallback={null}>
        <BottomNav isCoach={isCoach} />
      </Suspense>
    </div>
  )
}
