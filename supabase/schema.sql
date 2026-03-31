-- Run this in your Supabase SQL editor

-- Clients table: links a Supabase auth user to their Google Sheet
create table public.clients (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  spreadsheet_id text not null default '',  -- Google Sheets ID for this client (empty for coach)
  sex text not null default 'Male' check (sex in ('Male', 'Female')),
  is_coach boolean not null default false,
  created_at timestamptz default now()
);

-- Migration: if adding to an existing table, run:
-- alter table public.clients add column if not exists is_coach boolean not null default false;
-- alter table public.clients alter column spreadsheet_id set default '';

-- Only the user can read their own row; coach can read all via service role
alter table public.clients enable row level security;

create policy "Users can read own profile"
  on public.clients for select
  using (auth.uid() = id);

-- Coach admin view (used server-side with service role key — bypasses RLS)
-- No additional policy needed for service role
