-- ============================================================================
-- CareCircle — initial schema migration
-- Run this in the Supabase SQL Editor (Dashboard → SQL → New query).
-- Read docs/SPEC.md for the data model rationale.
--
-- Design rules enforced here:
--   * RLS is ENABLED on every table with ZERO policies.
--     The server uses the service-role key (bypasses RLS); the anon key
--     therefore reads/writes nothing. "Done when: a query with the anon key
--     returns nothing."
--   * All timestamps are timestamptz, stored in UTC. "Today" is decided in
--     app code by converting to Asia/Kolkata (see lib/schedule.ts).
--   * Idempotency columns (reminder_sent_at, escalated_at, reminded_24h_at,
--     reminded_2h_at, notified_at) make the cron tick safe to run twice.
--   * The unique constraint dose_logs(medication_id, scheduled_for) is what
--     lets the tick re-insert today's doses with ON CONFLICT DO NOTHING.
-- ============================================================================

-- Needed for gen_random_uuid() on older Postgres; harmless if already present.
create extension if not exists pgcrypto;

-- ============================================================================
-- 1. profiles
-- ============================================================================
create table if not exists public.profiles (
  id          uuid primary key default gen_random_uuid(),
  elder_name  text not null check (char_length(elder_name) between 1 and 120),
  language    text not null default 'en-IN'
              check (language in ('en-IN', 'hi-IN', 'ta-IN')),
  timezone    text not null default 'Asia/Kolkata',
  created_at  timestamptz not null default now()
);

-- ============================================================================
-- 2. members
--   role: elder | caretaker | family
--   is_trusted applies to family members only (CHECK below).
--   trust_order ranks backup trusted contacts (1 = primary, 2 = backup).
-- ============================================================================
create table if not exists public.members (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  role          text not null check (role in ('elder', 'caretaker', 'family')),
  name          text not null check (char_length(name) between 1 and 120),
  email         text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  passcode_hash text not null,
  is_trusted    boolean not null default false,
  trust_order   integer check (trust_order is null or trust_order >= 1),
  created_at    timestamptz not null default now(),
  -- is_trusted may only be true for family members.
  constraint members_trusted_only_family
    check (not is_trusted or role = 'family')
);

create index if not exists members_profile_id_idx on public.members(profile_id);
create index if not exists members_profile_role_idx on public.members(profile_id, role);

-- A profile has exactly one elder. Enforced via a partial unique index.
create unique index if not exists members_one_elder_per_profile
  on public.members(profile_id) where role = 'elder';

-- One primary trusted contact (trust_order = 1) per profile, and no two
-- trusted members of the same profile may share a trust_order (prevents two
-- backups both labeled order 2, which would make "email trust_order 2" ambiguous).
create unique index if not exists members_trusted_order_unique
  on public.members(profile_id, trust_order) where is_trusted;

-- Note on "at least one member is a caretaker":
--   This is hard to enforce declaratively without a trigger because INSERT
--   of the first caretaker and DELETE of the last both need protection, and
--   the caretaker is created in the same POST /api/profiles transaction as
--   the profile. We enforce it in application code (lib/auth.ts) and assert
--   it in tests; a deferred constraint trigger would also work but adds
--   fragility. Documented in docs/SPEC.md.

-- ============================================================================
-- 3. medications
--   times is text[] of 'HH:MM' strings (e.g. {'08:00','20:00'}).
-- ============================================================================
create table if not exists public.medications (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 160),
  dosage      text not null check (char_length(dosage) between 1 and 80),
  times       text[] not null check (array_length(times, 1) between 1 and 12),
  notes       text check (notes is null or char_length(notes) <= 500),
  is_critical boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Time-string format ('HH:MM' 24-hour) is validated in the application layer
-- (zod schema in src/lib/validators.ts), not here: a DB CHECK on times::text
-- is fragile because Postgres does not quote simple elements when casting
-- text[] to text ({08:00,20:00}, not {"08:00","20:00"}), so a regex on the
-- cast would reject valid input. zod already validates every body per spec.

create index if not exists medications_profile_active_idx
  on public.medications(profile_id) where active;

-- ============================================================================
-- 4. dose_logs
--   unique (medication_id, scheduled_for) → tick uses ON CONFLICT DO NOTHING.
-- ============================================================================
create table if not exists public.dose_logs (
  id                uuid primary key default gen_random_uuid(),
  medication_id     uuid not null references public.medications(id) on delete cascade,
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  scheduled_for     timestamptz not null,
  status            text not null default 'pending'
                    check (status in ('pending', 'taken', 'skipped', 'missed')),
  confirmed_by      uuid references public.members(id) on delete set null,
  taken_at          timestamptz,
  reminder_sent_at  timestamptz,
  escalated_at      timestamptz,
  created_at        timestamptz not null default now()
);

create unique index if not exists dose_logs_med_sched_unique
  on public.dose_logs(medication_id, scheduled_for);
create index if not exists dose_logs_profile_sched_idx
  on public.dose_logs(profile_id, scheduled_for);
create index if not exists dose_logs_status_sched_idx
  on public.dose_logs(status, scheduled_for);

-- ============================================================================
-- 5. appointments
-- ============================================================================
create table if not exists public.appointments (
  id              uuid primary key default gen_random_uuid(),
  profile_id      uuid not null references public.profiles(id) on delete cascade,
  doctor          text not null check (char_length(doctor) between 1 and 160),
  location        text check (location is null or char_length(location) <= 200),
  starts_at       timestamptz not null,
  notes           text check (notes is null or char_length(notes) <= 500),
  reminded_24h_at timestamptz,
  reminded_2h_at  timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists appointments_profile_starts_idx
  on public.appointments(profile_id, starts_at);

-- ============================================================================
-- 6. voice_notes
--   status: new | heard | private | forwarded | resolved
--   tag:    pain | concern | other | null (until triaged)
--   audio_path: server-generated (profile_id/uuid.ext), never client filename.
-- ============================================================================
create table if not exists public.voice_notes (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid not null references public.profiles(id) on delete cascade,
  audio_path   text not null,
  duration_s   integer not null check (duration_s between 1 and 60),
  status       text not null default 'new'
               check (status in ('new', 'heard', 'private', 'forwarded', 'resolved')),
  tag          text check (tag is null or tag in ('pain', 'concern', 'other')),
  handled_by   uuid references public.members(id) on delete set null,
  forwarded_at timestamptz,
  notified_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists voice_notes_profile_created_idx
  on public.voice_notes(profile_id, created_at desc);
create index if not exists voice_notes_status_notified_idx
  on public.voice_notes(status, notified_at);

-- ============================================================================
-- 7. activity_log
--   NEVER mentions that a private voice note exists (see docs/SPEC.md).
--   `target` is a free-form label like "medication:abc" — never note audio.
-- ============================================================================
create table if not exists public.activity_log (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  member_id   uuid references public.members(id) on delete set null,
  action      text not null check (char_length(action) between 1 and 80),
  target      text check (target is null or char_length(target) <= 120),
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_profile_created_idx
  on public.activity_log(profile_id, created_at desc);

-- ============================================================================
-- 8. auth_attempts
--   Used by the 5-in-15-min lockout. Index on (profile_id, ip, created_at).
-- ============================================================================
create table if not exists public.auth_attempts (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  ip          inet not null,
  succeeded   boolean not null,
  created_at  timestamptz not null default now()
);

create index if not exists auth_attempts_profile_ip_created_idx
  on public.auth_attempts(profile_id, ip, created_at);

-- ============================================================================
-- Row Level Security: ENABLE on every table, ZERO policies.
--   The server uses the service-role key, which bypasses RLS entirely, so it
--   can read/write everything. The anon/authenticated keys (used by browsers
--   if they ever reached Supabase directly — they should not) hit RLS with no
--   policies → no rows visible, no rows writable.
-- ============================================================================
alter table public.profiles      enable row level security;
alter table public.members       enable row level security;
alter table public.medications   enable row level security;
alter table public.dose_logs     enable row level security;
alter table public.appointments  enable row level security;
alter table public.voice_notes   enable row level security;
alter table public.activity_log  enable row level security;
alter table public.auth_attempts enable row level security;

-- ============================================================================
-- Storage: private bucket for voice notes.
--   public = false  → no public URLs, ever.
--   No storage policies → anon key cannot read or write objects.
--   The server uses the service-role key to upload and to mint 5-minute
--   signed URLs for the trusted contact / forwarded-caretaker.
-- ============================================================================
insert into storage.buckets (id, name, public)
  values ('voice-notes', 'voice-notes', false)
  on conflict (id) do update set public = false;

-- ============================================================================
-- done.
-- ============================================================================
