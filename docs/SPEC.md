# CareCircle — SPEC (Technical Specification)

Nov 15, 2026 · @hoolahoo

## Spec: architecture

Browsers only call the Next.js server, which alone holds the database key, signs audio URLs and sends email.

```
   ┌──────────┬──────────────┬──────────────┐
   │ Elder    │ Caretaker    │ Trusted      │
   │ browser  │ browser      │ contact      │
   │ Today,   │ Meds, Appts, │ browser      │
   │ Record   │ Adherence    │ Notes inbox  │
   └────┬─────┴──────┬───────┴──────┬───────┘
        │  HTTPS + httpOnly JWT cookie (SameSite=Lax)
        │  No direct DB/Storage access from any browser
        ▼
 ┌─────────────────────────────────────────────────┐
 │  Next.js server (Vercel) — App Router, TS        │
 │   /app/p/[id]/* pages  ·  /api/* route handlers  │
 │   /lib: db · auth · mail · schedule · validators │
 │   Holds: service-role key, JWT_SECRET,           │
 │           CRON_SECRET, GMAIL creds                │
 └───┬───────────────┬────────────────────┬────────┘
     │ service-role  │ service-role +     │ SMTP
     │ (bypasses     │ signed URL, private│ (Gmail
     │  RLS, server  │ bucket             │  App Pwd,
     │  only)        │                    │  1 transport
     ▼               ▼                    ▼
 ┌──────────┐  ┌──────────────┐      ┌──────────┐
 │Supabase  │  │Supabase      │      │ Gmail    │
 │Postgres  │  │Storage       │      │ SMTP     │
 │RLS on,   │  │private bucket│      │          │
 │0 policies│  │ 5-min URLs   │      │          │
 └─────▲────┘  └──────────────┘      └──────────┘
       │
       │ GET /api/cron/tick  every 5 min
       │ Authorization: Bearer CRON_SECRET  → else 401
 ┌─────┴──────────┐
 │ cron-job.org   │   (no DB access; just pings the route)
 └────────────────┘
```

The scheduler reaches the server through the tick route with a secret header; the database and storage are never exposed to a browser.

## Spec: stack, folders and environment

One Next.js codebase (App Router, TypeScript) deployed on Vercel; every database and storage call happens in server code.

| Concern | Choice |
| --- | --- |
| UI | Tailwind, shadcn/ui |
| Database and storage | Supabase Postgres and a private Storage bucket, service-role key on the server only |
| Sessions | jose-signed JWT in an httpOnly cookie; bcryptjs for passcodes |
| Validation | zod on every route |
| Email | Nodemailer with Gmail SMTP and an App Password |
| Scheduler | cron-job.org calling the tick route |

```text
src/
  app/
    page.tsx                  landing, create profile
    p/[id]/page.tsx           passcode gate
    p/[id]/today/             elder screen
    p/[id]/meds/              caretaker schedule editor
    p/[id]/appointments/
    p/[id]/adherence/
    p/[id]/notes/             voice-note inbox (trusted contacts, caretaker)
    api/                      route handlers (see auth table)
  lib/
    db.ts                     Supabase server client
    auth.ts                   passcodes, session, role guard
    mail.ts                   Nodemailer and templates
    schedule.ts               dose generation and tick logic
    validators.ts             zod schemas
docs/                         PRD.md, SPEC.md
supabase/migrations/          SQL migrations
AGENTS.md                     rules for coding agents
```

**Environment variables (never commit):** SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET, CRON_SECRET, GMAIL_USER, GMAIL_APP_PASSWORD, GRACE_MINUTES, APP_URL. No variable holding a secret may start with NEXT_PUBLIC_.

## Spec: data model and RLS

Enable RLS on every table and add no policies; the server uses the service-role key, so the public anon key can read nothing. Store all timestamps as timestamptz in UTC.

| Table | Columns and constraints |
| --- | --- |
| profiles | id, elder_name, language, timezone (default Asia/Kolkata), created_at |
| members | id, profile_id, role (elder, caretaker, family), name, email (nullable), passcode_hash, is_trusted, trust_order |
| medications | id, profile_id, name, dosage, times (array of HH:MM), notes, is_critical, active |
| dose_logs | id, medication_id, profile_id, scheduled_for, status (pending, taken, skipped, missed), confirmed_by, taken_at, reminder_sent_at, escalated_at; unique (medication_id, scheduled_for); index (profile_id, scheduled_for); index (status, scheduled_for) |
| appointments | id, profile_id, doctor, location, starts_at, notes, reminded_24h_at, reminded_2h_at |
| voice_notes | id, profile_id, audio_path, duration_s, status (new, heard, private, forwarded, resolved), tag, handled_by, forwarded_at, notified_at, created_at |
| activity_log | id, profile_id, member_id, action, target, created_at |
| auth_attempts | id, profile_id, ip, succeeded, created_at; index (profile_id, ip, created_at) |

Integrity rules: a profile has exactly one elder; at least one member is a caretaker; is_trusted applies to family members only. Delete audio files and rows older than 30 days from the tick.

The SQL migration is at `supabase/migrations/0001_init.sql`.

## Spec: auth and permissions

Every route reads the session, checks the role, and checks that the profile in the session matches the profile in the request; the UI hiding a button is not enforcement.

**Passcodes:** 8 random characters from an alphabet without look-alike characters (no 0, O, 1, I, l), generated server-side with crypto, shown once, stored as a bcrypt hash. Login compares only against members of the profile in the URL.

**Lockout:** after 5 failed attempts in 15 minutes for the same profile and IP, return 429 and write nothing else.

**Session:** a signed JWT (memberId, profileId, role) in an httpOnly, Secure, SameSite=Lax cookie. The elder's session lasts 30 days so she never logs in again; other roles last 12 hours. State-changing routes accept JSON only and check the Origin header.

| Route | Method | Allowed roles |
| --- | --- | --- |
| /api/profiles | POST | public (creates the profile and returns the passcodes once) |
| /api/auth | POST | public, rate-limited |
| /api/meds | GET | elder, caretaker, family |
| /api/meds, /api/meds/[id] | POST, PATCH | caretaker |
| /api/doses/[id]/take | POST | elder, caretaker |
| /api/appointments | GET | all roles |
| /api/appointments | POST, PATCH | caretaker |
| /api/adherence | GET | all roles |
| /api/voice-notes | POST | elder |
| /api/voice-notes | GET | elder (own notes, status only), trusted family (all), caretaker (forwarded only) |
| /api/voice-notes/[id]/audio | GET | trusted family; caretaker only if forwarded; returns a 5-minute signed URL |
| /api/voice-notes/[id] | PATCH | trusted family (tag, forward, keep private, resolve) |
| /api/cron/tick | GET | CRON_SECRET in the Authorization header |

## Spec: reminder engine

The tick runs every few minutes, uses a fixed number of batched queries per run, and is safe to run twice. Convert to Asia/Kolkata only when deciding what "today" means.

1. Check the Authorization header against CRON_SECRET; otherwise return 401.
2. Create today's dose_logs from active medications with an insert that ignores conflicts on (medication_id, scheduled_for).
3. Select pending doses due within 10 minutes where reminder_sent_at is null; email the recipients, then set reminder_sent_at.
4. Select pending doses older than GRACE_MINUTES where escalated_at is null; set status to missed and escalated_at, then email the caretaker (and trusted contacts if the medicine is critical).
5. Select appointments starting within 24 hours or 2 hours with the matching reminded_ column null; email, then set the column.
6. Select voice notes with status new and notified_at null; email the trusted contacts with a generic message, then set notified_at.
7. Delete voice notes and audio files older than 30 days.

**Mark the row before or in the same step as sending**, so a retry cannot double-send. Group recipients per email so each person gets one message per run.

**Email rules:** subjects and bodies say only that something needs attention, with a link to the profile page. No medicine names, dosages or note text. Send from a single Nodemailer transport created once per process.

## Spec: voice notes and Listen

The elder screen has one large record button, and the trusted contact decides what happens to each note.

**Recording.** The first tap starts MediaRecorder using the first supported type from audio/webm;codecs=opus, audio/mp4 and audio/ogg (check with isTypeSupported). The button turns red with a countdown and reads "Tap again to send". A second tap, or 60 seconds, stops and uploads with no review step. Success shows a large tick and "Sent to [name]". The caretaker grants microphone permission once on the elder's device during setup. Recording needs HTTPS. Cancel any speech before recording starts.

**Upload.** POST /api/voice-notes as multipart. The server requires the elder role, a size of 2 MB or less and a content type from the allowlist, generates the storage path itself (profile id, random UUID, extension; never the client's filename), and inserts a row with status new. Limit each profile to 10 notes an hour.

**Triage.** The trusted contact's inbox lists new notes with date and length. Playing one uses a 5-minute signed URL and moves it from new to heard. They tag it (pain, concern, other) and choose forward to caretaker, keep private, or resolve. Only status forwarded is ever returned to a caretaker. The elder sees each note as Sent or Heard, nothing more.

**Backup contact (if ahead).** A note still new after 4 hours emails the member with trust_order 2.

**Listen (if ahead).** A Listen button reads fixed sentences with slots, for example "Good morning {name}. You have {n} medicines this morning. Next: {medicine} at {time}", plus "Done, well done" after Taken. Keep them in src/lib/phrases.ts keyed by language (en-IN, hi-IN, ta-IN); have Gemini translate them once and a speaker of the language check them. Use window.speechSynthesis, choose a voice whose language matches, and fall back to English if none is installed. Browsers block audio until a tap, so reading starts only from the button. Never generate spoken text at runtime, so a wrong dose can never be read aloud.

## Spec: security and efficiency checks

The round-one judge reads the repository, so each of these should be visible in code or in the README.

**Security**

- RLS enabled on every table with no policies, and the service-role key used only in server code.
- A role and profile check in every route, proven by tests: family PATCH on meds returns 403, and a caretaker cannot fetch a private note.
- Hashed random passcodes, lockout, an httpOnly session cookie and an Origin check on writes.
- zod validation on every body, rejecting unknown fields.
- Audio in a private bucket, 5-minute signed URLs, type and size limits, server-generated paths, 30-day deletion.
- Private notes absent from emails, logs, the activity log and the adherence view.
- No secrets in the repo, the cron secret in a header, and no health data in logs.
- Response headers set in next.config: X-Content-Type-Options, Referrer-Policy no-referrer, a frame-ancestors none policy, and Permissions-Policy allowing the microphone for the app only.

**Efficiency**

- An idempotent tick built on the unique constraint and the reminder and escalation flag columns.
- A fixed number of batched queries per tick, with no query inside a loop, and the indexes listed under the data model.
- Server components for data pages, a 50-row limit on lists, and one Nodemailer transport per process.

## Build order for your coding agents

Give an agent one task at a time with this instruction: read AGENTS.md and docs, do only the task named, and list the files changed. Commit and push after each task so the live link always works.

| Task | Build | Done when |
| --- | --- | --- |
| T1 | Supabase tables, RLS, env vars in Vercel and .env.local | Tables exist and a query with the anon key returns nothing |
| T2 | Profile creation, passcode generation, login, lockout, session, role guard | Five wrong codes return 429; a correct code sets the cookie |
| T3 | Medications CRUD for the caretaker | Family and elder PATCH returns 403 |
| T4 | Dose generation, Today screen, Taken route | One tap marks taken; a second tap changes nothing |
| T5 | Appointments create and list | Upcoming appointments show for every role |
| T6 | Mail transport and generic templates | A test email arrives in the inbox, not spam |
| T7 | Cron tick steps 1 to 5 with GRACE_MINUTES | A dose 2 minutes ahead gets a reminder, then a missed email; a rerun sends nothing |
| T8 | Voice note record, upload, inbox, audio route, triage actions | A private note is absent from caretaker responses and appears after forward |
| T9 | Adherence table, security headers, README, tests | Counts match dose_logs; README states assumptions and the roadmap |
| T10 | Live test in incognito and on a phone; collect the three links | GitHub, live site and LinkedIn links all open while logged out |

After T10, if time remains and the must-haves work: Listen button, activity log, backup contact, then the digest.
