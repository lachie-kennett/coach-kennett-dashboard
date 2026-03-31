# Coach Kennett Dashboard — Setup Guide

## 1. Supabase

1. Create a free project at https://supabase.com
2. Go to **SQL Editor** and run the contents of `supabase/schema.sql`
3. In **Authentication → Users**, create an account for each client (use their email + a password)
4. In **Table Editor → clients**, add a row for each client:
   - `id` → the UUID from their Auth user
   - `name` → their full name
   - `email` → their email
   - `spreadsheet_id` → the Google Sheet ID (from the URL: `docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit`)
   - `sex` → `Male` or `Female`

## 2. Google Service Account

1. Go to https://console.cloud.google.com
2. Create a new project (or use existing)
3. Enable the **Google Sheets API**
4. Go to **IAM & Admin → Service Accounts → Create Service Account**
5. Give it any name, click through
6. Click the service account → **Keys → Add Key → JSON** — download the file
7. From the JSON file, copy:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`

## 3. Share Each Client's Sheet

For each client spreadsheet, click **Share** and add your service account email with **Viewer** access.

## 4. Environment Variables

Copy `.env.local.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
```

## 5. Icons (PWA)

Add two PNG icons to `public/icons/`:
- `icon-192.png` (192×192)
- `icon-512.png` (512×512)

Use any ⚡️ / lightning bolt style icon. Tools like https://realfavicongenerator.net work well.

## 6. Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Add all env vars in the Vercel dashboard under **Settings → Environment Variables**.

## 7. Client Access

Share the Vercel URL with clients. They can:
- Open it in Safari/Chrome → **Add to Home Screen** for app-like access
- Log in with the email/password you created in Supabase

## Sending Blood Work

Blood work data lives in the `🩸Bloods` tab of their tracker. Once they or you fill it in, the `/bloods` page auto-populates. Share the URL directly if needed.
