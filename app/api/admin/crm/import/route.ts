import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

async function sendWelcomeEmail(firstName: string, email: string) {
  await resend.emails.send({
    from: 'Lachie <lachie@coachkennett.com>',
    to: email,
    subject: "You're in — here's everything you need to get started",
    html: `
      <p>Hey ${firstName},</p>

      <p>Welcome to the program. Stoked to have you on board.</p>

      <p>Before we dive in, here's what I need from you.</p>

      <p><strong>Your first steps:</strong></p>
      <ol>
        <li><strong><a href="https://coachkennett.fillout.com/t/bvSN9q2gKNus">Fill out your roadmap form</a></strong> — this is the most important thing you can do right now. The more detail you give me, the better I can help you.</li>
        <li><strong>Sign your T&Cs and expectations agreement</strong> — I'll send these through separately.</li>
      </ol>

      <p><strong>Then:</strong></p>
      <p>After our roadmap call, I will have everything I need to finish your onboarding, your tracker, build your program, draft your nutrition plan, send you any relevant blood work or supplements to get.</p>
      <p>After that, we rip in!</p>

      <p><strong>How we work:</strong></p>
      <ul>
        <li>Check in with me regularly. If something feels off, tell me. Silence = I assume everything's fine. The clients who message me the most are the ones who get the best results.</li>
        <li>Show up consistently. Results come from the compounding of good days, not one perfect week.</li>
        <li>Trust the process, but ask questions. I want you to understand what we're doing and why.</li>
      </ul>

      <p>Any questions before we get started, reply here or shoot me a message on WhatsApp.</p>

      <p>Let's get to work.</p>

      <p>Lachie</p>
    `,
  })
}

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function requireCoach() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = getAdmin()
  const { data: profile } = await admin.from('clients').select('is_coach').eq('id', user.id).single()
  if (!profile?.is_coach) return null
  return user
}

export async function POST(request: NextRequest) {
  const user = await requireCoach()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { name, email, mobile, startDate, offerType, weeklyRate, birthday, tcSigned, expectationsSigned } = body

  if (!name || !email) {
    return NextResponse.json({ error: 'name and email are required' }, { status: 400 })
  }

  const admin = getAdmin()

  // Check if already exists
  const { data: existing } = await admin.from('clients').select('id').eq('email', email).single()
  if (existing) return NextResponse.json({ error: 'Client already exists' }, { status: 409 })

  // Parse weekly rate — strip $ and commas
  let weeklyRateNum: number | null = null
  if (weeklyRate) {
    const parsed = parseFloat(weeklyRate.toString().replace(/[$,\s]/g, ''))
    if (!isNaN(parsed)) weeklyRateNum = parsed
  }

  // Invite user — sends them an email to set their password
  const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { is_coach: false },
  })

  if (authError) return NextResponse.json({ error: authError.message }, { status: 400 })

  const { data: client, error: dbError } = await admin.from('clients').insert({
    id: authData.user.id,
    name,
    email,
    sex: 'Male',
    is_coach: false,
    whatsapp_number: mobile || null,
    start_date: startDate || null,
    offer_type: offerType || null,
    weekly_rate: weeklyRateNum,
    birthday: birthday || null,
    step_terms_signed: tcSigned ?? false,
    step_expectations_signed: expectationsSigned ?? false,
  }).select().single()

  if (dbError) {
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Send welcome email — fire and forget, don't fail the import if email fails
  const firstName = name.split(' ')[0]
  sendWelcomeEmail(firstName, email).catch(() => {})

  return NextResponse.json(client, { status: 201 })
}
