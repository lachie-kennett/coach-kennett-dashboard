-- Run this in your Supabase SQL editor

-- Clients table: links a Supabase auth user to their Google Sheet
create table public.clients (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  spreadsheet_id text not null default '',  -- Google Sheets ID for this client (empty for coach)
  sex text not null default 'Male' check (sex in ('Male', 'Female')),
  is_coach boolean not null default false,
  package_end_date date,                    -- Optional: when their package ends (for retention alerts)
  whatsapp_number text,                     -- Optional: client WhatsApp number for nudges (e.g. +61412345678)
  drive_folder_url text,                    -- Google Drive folder URL for this client
  trainerize_url text,                      -- Trainerize profile link
  legal_docs_url text,                      -- Signed legal docs (Google Drive)
  onboarding_form_url text,                 -- Their onboarding form link
  -- Onboarding checklist
  step_form_sent boolean not null default false,
  step_terms_signed boolean not null default false,
  step_trainerize_setup boolean not null default false,
  step_tracker_created boolean not null default false,
  step_bloods_reminder_sent boolean not null default false,
  step_intro_call_done boolean not null default false,
  created_at timestamptz default now()
);

-- Migration: if adding to an existing table, run:
-- alter table public.clients add column if not exists is_coach boolean not null default false;
-- alter table public.clients alter column spreadsheet_id set default '';
-- alter table public.clients add column if not exists package_end_date date;
-- alter table public.clients add column if not exists whatsapp_number text;
-- alter table public.clients add column if not exists drive_folder_url text;
-- alter table public.clients add column if not exists trainerize_url text;
-- alter table public.clients add column if not exists legal_docs_url text;
-- alter table public.clients add column if not exists onboarding_form_url text;
-- alter table public.clients add column if not exists step_form_sent boolean not null default false;
-- alter table public.clients add column if not exists step_terms_signed boolean not null default false;
-- alter table public.clients add column if not exists step_trainerize_setup boolean not null default false;
-- alter table public.clients add column if not exists step_tracker_created boolean not null default false;
-- alter table public.clients add column if not exists step_bloods_reminder_sent boolean not null default false;
-- alter table public.clients add column if not exists step_intro_call_done boolean not null default false;

-- Only the user can read their own row; coach can read all via service role
alter table public.clients enable row level security;

create policy "Users can read own profile"
  on public.clients for select
  using (auth.uid() = id);

-- Coach admin view (used server-side with service role key — bypasses RLS)
-- No additional policy needed for service role
