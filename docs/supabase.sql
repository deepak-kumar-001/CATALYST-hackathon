-- CareCircle production schema. Run with the Supabase SQL editor.
-- The browser never receives the service-role key. RLS is enabled on every app table and no anon policies are created.

create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  elder_name text not null,
  language text not null default 'en-IN',
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

create type member_role as enum ('elder', 'caretaker', 'family');
create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  role member_role not null,
  name text not null,
  email text,
  passcode_hash text not null,
  is_trusted boolean not null default false,
  trust_order integer,
  created_at timestamptz not null default now()
);

create type dose_status as enum ('pending', 'taken', 'skipped', 'missed');
create table if not exists medications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  dosage text not null,
  times text[] not null,
  notes text not null default '',
  is_critical boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists dose_logs (
  id uuid primary key default gen_random_uuid(),
  medication_id uuid not null references medications(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  scheduled_for timestamptz not null,
  status dose_status not null default 'pending',
  confirmed_by uuid references members(id),
  taken_at timestamptz,
  reminder_sent_at timestamptz,
  escalated_at timestamptz,
  unique (medication_id, scheduled_for)
);
create index if not exists dose_logs_profile_scheduled on dose_logs(profile_id, scheduled_for);
create index if not exists dose_logs_status_scheduled on dose_logs(status, scheduled_for);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  doctor text not null,
  location text not null,
  starts_at timestamptz not null,
  notes text not null default '',
  reminded_24h_at timestamptz,
  reminded_2h_at timestamptz
);

create type voice_note_status as enum ('new', 'heard', 'private', 'forwarded', 'resolved');
create type voice_note_tag as enum ('pain', 'concern', 'other');
create table if not exists voice_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  audio_path text not null,
  duration_s integer not null check (duration_s between 1 and 60),
  status voice_note_status not null default 'new',
  tag voice_note_tag,
  handled_by uuid references members(id),
  forwarded_at timestamptz,
  notified_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  member_id uuid references members(id),
  action text not null,
  target text not null,
  created_at timestamptz not null default now()
);

create table if not exists auth_attempts (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  ip inet not null,
  succeeded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists auth_attempts_profile_ip_time on auth_attempts(profile_id, ip, created_at);

alter table profiles enable row level security;
alter table members enable row level security;
alter table medications enable row level security;
alter table dose_logs enable row level security;
alter table appointments enable row level security;
alter table voice_notes enable row level security;
alter table activity_log enable row level security;
alter table auth_attempts enable row level security;

insert into storage.buckets (id, name, public) values ('carecircle-audio', 'carecircle-audio', false)
on conflict (id) do update set public = false;

-- No public policies are intentional. All reads and writes use the server service-role client.
