import { NextResponse, type NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

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

// Extract a field value from Fillout's questions array by matching label
function getField(questions: { name: string; value: unknown }[], ...labels: string[]): string {
  for (const label of labels) {
    const q = questions.find(
      q => q.name.toLowerCase().trim() === label.toLowerCase().trim()
    )
    if (q && q.value !== null && q.value !== undefined && q.value !== '') {
      return String(q.value).trim()
    }
  }
  return ''
}

export async function POST(request: NextRequest) {
  // Verify webhook secret if configured
  const secret = process.env.FILLOUT_WEBHOOK_SECRET
  if (secret) {
    const authHeader = request.headers.get('x-fillout-secret') ?? request.headers.get('authorization')
    if (authHeader !== secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  // Fillout sends either a single submission or wraps in { submission: ... }
  // Handle both formats
  const payload = body as Record<string, unknown>
  const submission = (payload.submission ?? payload) as Record<string, unknown>
  const questions = (submission.questions ?? []) as { name: string; value: unknown }[]

  if (!questions.length) {
    console.error('Fillout webhook: no questions found in payload', JSON.stringify(body))
    return NextResponse.json({ error: 'No questions in payload' }, { status: 400 })
  }

  // Extract fields
  const fullName = getField(questions, 'full name', 'name', 'full_name')
  const email = getField(questions, 'email', 'email address')
  const mobile = getField(questions, 'best contact number', 'phone', 'mobile', 'contact number', 'phone number', 'mobile number')
  const birthday = getField(questions, 'birth date', 'date of birth', 'birthday', 'dob')

  if (!fullName || !email) {
    console.error('Fillout webhook: missing name or email', { fullName, email })
    return NextResponse.json({ error: 'Missing required fields: full name and email' }, { status: 400 })
  }

  const admin = getAdmin()

  // Check if client already exists — don't duplicate
  const { data: existing } = await admin.from('clients').select('id').eq('email', email.toLowerCase()).single()
  if (existing) {
    console.log(`Fillout webhook: client already exists for ${email}`)
    return NextResponse.json({ message: 'Client already exists' }, { status: 200 })
  }

  // Invite user via Supabase auth (sends password setup email)
  const { data: authData, error: authError } = await admin.auth.admin.inviteUserByEmail(email.toLowerCase(), {
    data: { is_coach: false },
  })

  if (authError) {
    console.error('Fillout webhook: auth invite error', authError)
    return NextResponse.json({ error: authError.message }, { status: 400 })
  }

  // Insert client record
  const { error: dbError } = await admin.from('clients').insert({
    id: authData.user.id,
    name: fullName,
    email: email.toLowerCase(),
    sex: 'Male', // default — coach updates manually
    is_coach: false,
    whatsapp_number: mobile || null,
    birthday: birthday || null,
  })

  if (dbError) {
    console.error('Fillout webhook: db insert error', dbError)
    await admin.auth.admin.deleteUser(authData.user.id)
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  // Send welcome email — fire and forget
  const firstName = fullName.split(' ')[0]
  sendWelcomeEmail(firstName, email).catch(err =>
    console.error('Fillout webhook: welcome email failed', err)
  )

  console.log(`Fillout webhook: created client ${fullName} (${email})`)
  return NextResponse.json({ message: 'Client created', name: fullName, email }, { status: 201 })
}
