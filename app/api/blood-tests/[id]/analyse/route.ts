export const maxDuration = 120

import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const user = await requireCoach()
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY is not configured' }, { status: 500 })
    }

    const admin = getAdmin()

    // Get the blood test record + client info separately to avoid join issues
    const { data: test, error: testError } = await admin
      .from('blood_tests')
      .select('*')
      .eq('id', id)
      .single()

    if (testError || !test) {
      console.error('blood_tests fetch error:', testError)
      return NextResponse.json({ error: 'Blood test not found' }, { status: 404 })
    }

    const { data: clientData } = await admin
      .from('clients')
      .select('name, sex')
      .eq('id', test.client_id)
      .single()

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await admin.storage
      .from('blood-tests')
      .download(test.file_path)

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError)
      return NextResponse.json({ error: `Failed to download file: ${downloadError?.message ?? 'unknown'}` }, { status: 500 })
    }

    const arrayBuffer = await fileData.arrayBuffer()
    const base64 = Buffer.from(arrayBuffer).toString('base64')

    // Determine media type
    const mediaType = test.file_type as string
    const isPdf = mediaType === 'application/pdf'
    const isImage = mediaType.startsWith('image/')
    if (!isPdf && !isImage) {
      return NextResponse.json({ error: `Unsupported file type: ${mediaType}` }, { status: 400 })
    }

    // Read knowledge base
    const kbPath = path.join(process.cwd(), 'lib', 'bloodwork-knowledge-base.md')
    const knowledgeBase = fs.readFileSync(kbPath, 'utf-8')

    const clientName = clientData?.name ?? 'this client'
    const clientSex = clientData?.sex ?? 'unknown'

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const systemPrompt = `You are a functional medicine blood work analyst for Coach Kennett, a holistic athletic development coaching practice based in Melbourne, Australia. You analyse blood test results using functional/optimal ranges rather than conventional lab ranges.

Your job is to provide clear, evidence-based functional interpretations that help the coach understand what the results mean for the client's health, performance, and recovery. You are not diagnosing — you are identifying functional patterns and potential areas to investigate.

Below is your complete functional blood work reference knowledge base. Use this as your primary reference for optimal ranges, clinical patterns, and nutraceutical protocols:

---

${knowledgeBase}

---

Always use the optimal/functional ranges from the knowledge base, not conventional lab ranges. When a marker is outside optimal range but within conventional range, note this distinction.`

    const userMessage = `Please analyse the blood test results in the attached file for ${clientName} (${clientSex}).

Provide a structured functional interpretation with the following sections:

**1. Summary**
A brief 2–3 sentence overview of the overall picture.

**2. Key Findings**
List each marker that is outside the functional optimal range, what the deviation indicates, and the severity (mild concern / moderate concern / significant concern).

**3. Inter-Marker Patterns**
Identify any patterns across multiple markers — e.g. adrenal axis dysfunction, HPT axis issues, iron-copper-ceruloplasmin triangle, methylation issues, metabolic patterns, etc.

**4. Potential Contributing Factors**
Based on the patterns identified, what lifestyle, dietary, or physiological factors are likely driving these findings?

**5. Priority Recommendations**
The top 3–5 areas to address, in priority order. For each, reference the relevant nutraceutical protocol from the knowledge base where applicable. Be specific with dosages where the knowledge base provides them.

**6. Markers Within Optimal Range**
Briefly note what's looking good.

Keep the tone professional but clear — this is for the coach's review before being shared with the client.`

    type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

    const fileContent = isPdf
      ? {
          type: 'document' as const,
          source: {
            type: 'base64' as const,
            media_type: 'application/pdf' as const,
            data: base64,
          },
        }
      : {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType as ImageMediaType,
            data: base64,
          },
        }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            fileContent,
            { type: 'text', text: userMessage },
          ],
        },
      ],
    })

    const interpretation = message.content
      .filter(block => block.type === 'text')
      .map(block => (block as { type: 'text'; text: string }).text)
      .join('\n')

    // Save interpretation to DB
    const { data: updated, error: updateError } = await admin
      .from('blood_tests')
      .update({ ai_interpretation: interpretation, status: 'analysed' })
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('DB update error:', updateError)
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json(updated)

  } catch (err) {
    console.error('Analyse route uncaught error:', err)
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
