-- Broward Arrest Records — initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------- arrests
create table if not exists public.arrests (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'bso-booking-blotter',
  county text not null default 'Broward',
  arrest_number text not null,
  first_name text,
  middle_name text,
  last_name text,
  full_name text not null,
  sex text,
  age integer,
  booking_date date,
  arrest_date date,
  release_date date,
  location text,
  charges_json jsonb,
  bond_json jsonb,
  charges_text text,
  mugshot_url text,
  official_detail_url text,
  status text not null default 'published' check (status in ('published', 'pending')),
  is_hidden boolean not null default false,
  hidden_reason text,
  mugshot_hidden boolean not null default false,
  removal_requested boolean not null default false,
  removal_requested_at timestamptz,
  removed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Dedupe key used by the scraper's idempotent upsert.
create unique index if not exists arrests_source_arrest_number_key
  on public.arrests (source, arrest_number);

create index if not exists arrests_booking_date_idx on public.arrests (booking_date desc);
create index if not exists arrests_last_name_idx on public.arrests (lower(last_name));
create index if not exists arrests_first_name_idx on public.arrests (lower(first_name));
create index if not exists arrests_status_hidden_idx on public.arrests (status, is_hidden);
create index if not exists arrests_charges_text_idx on public.arrests using gin (to_tsvector('english', coalesce(charges_text, '')));

-- -------------------------------------------------------- scraper_runs
create table if not exists public.scraper_runs (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'bso-booking-blotter',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running'
    check (status in ('running', 'success', 'partial', 'blocked', 'no_data', 'error', 'dry_run')),
  records_found integer not null default 0,
  records_inserted integer not null default 0,
  records_updated integer not null default 0,
  errors_json jsonb,
  created_at timestamptz not null default now()
);

create index if not exists scraper_runs_started_at_idx on public.scraper_runs (started_at desc);

-- ---------------------------------------------------- removal_requests
create table if not exists public.removal_requests (
  id uuid primary key default gen_random_uuid(),
  arrest_id uuid references public.arrests (id) on delete set null,
  requester_name text not null,
  requester_email text not null,
  requester_phone text,
  relationship_to_person text,
  proof_notes text,
  message text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists removal_requests_status_idx on public.removal_requests (status, created_at desc);

-- ---------------------------------------------------- suppression_list
-- Records on this list are never re-inserted or re-published by the
-- scraper or by manual imports.
create table if not exists public.suppression_list (
  id uuid primary key default gen_random_uuid(),
  arrest_number text,
  full_name text,
  reason text,
  created_at timestamptz not null default now()
);

create index if not exists suppression_arrest_number_idx on public.suppression_list (arrest_number);
create index if not exists suppression_full_name_idx on public.suppression_list (lower(full_name));

-- ------------------------------------------------------- updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists arrests_set_updated_at on public.arrests;
create trigger arrests_set_updated_at
  before update on public.arrests
  for each row execute function public.set_updated_at();

-- ------------------------------------------------------------- RLS
-- The Next.js app talks to the database from the server with the service
-- role key (which bypasses RLS). These policies exist so the anon key can
-- never read hidden/pending records or any admin table, even if it leaks
-- into a client bundle.
alter table public.arrests enable row level security;
alter table public.scraper_runs enable row level security;
alter table public.removal_requests enable row level security;
alter table public.suppression_list enable row level security;

drop policy if exists "public can read published arrests" on public.arrests;
create policy "public can read published arrests"
  on public.arrests for select
  to anon
  using (status = 'published' and is_hidden = false);

drop policy if exists "public can file removal requests" on public.removal_requests;
create policy "public can file removal requests"
  on public.removal_requests for insert
  to anon
  with check (status = 'pending');
