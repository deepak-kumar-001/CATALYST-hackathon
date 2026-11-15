# AGENTS.md — rules for coding agents working on CareCircle

Read **docs/PRD.md** and **docs/SPEC.md** completely before writing any code.
They contain the data model, auth matrix, tick steps, and the cut order.

## Workflow

- One task at a time. The build order (T1–T10) is in `docs/SPEC.md` at the end.
- Do **only** the task named. Do not implement future tasks ahead of time.
- After each task: commit and push so the live link always works.
- List the files you changed in your final message.

## Cut order (from docs/PRD.md)

Must-haves (FR1–FR12, T1–T10) come first. If the must-haves are not working
by 2:30 pm, skip every "if ahead" item (FR13, FR14). Cut entirely (README
roadmap only): prescription scan, AI summaries, conversational voice
assistant, WhatsApp and SMS, dark mode, per-condition rules, regional-language
screens beyond the Listen sentences.

## Non-negotiable rules

1. **Browser never calls Supabase directly.** No anon key in client code, no
   service-role key in client code. Every DB and Storage call is in server
   code (route handlers, server components, `lib/`). The browser only talks
   to Next.js routes.

2. **RLS on every table, zero policies.** The server uses the service-role
   key and bypasses RLS. The anon key therefore reads nothing.

3. **Every route follows the same shape:**
   1. Read the session JWT from the httpOnly cookie.
   2. Check the role is allowed for this route (see auth table in SPEC).
   3. Check the profile in the session matches the profile in the URL.
   4. zod-validate the body, rejecting unknown fields.
   5. For state-changing routes: check the `Origin` header.
   6. Act.

   The UI hiding a button is **not** enforcement.

4. **Idempotent tick.** Mark the row (`reminder_sent_at`, `escalated_at`,
   `reminded_24h_at`, `reminded_2h_at`, `notified_at`) **before or in the
   same step** as sending the email. A rerun of the tick sends nothing new.
   The unique constraint `dose_logs(medication_id, scheduled_for)` makes
   today's dose insertion safe with `ON CONFLICT DO NOTHING`.

5. **Emails are generic.** Subjects and bodies say only that something needs
   attention, with a link to the profile page. **No medicine names, dosages,
   appointment details, or note text in any email.**

6. **Private voice notes are invisible to caretakers everywhere** — API
   responses, emails, the activity log, the adherence view, and pages. Only
   `status = 'forwarded'` notes ever reach a caretaker.

7. **Passcodes:** 8 random chars from an alphabet without look-alikes
   (no `0`, `O`, `1`, `I`, `l`), generated server-side with `crypto`,
   shown once, stored as a bcrypt hash. Login compares against members of
   the profile in the URL **only**.

8. **Lockout:** 5 failed attempts in 15 minutes for the same
   `(profile_id, ip)` → return 429 and write nothing else.

9. **Session:** signed JWT (`memberId`, `profileId`, `role`) in an
   `httpOnly`, `Secure`, `SameSite=Lax` cookie. Elder session = 30 days,
   other roles = 12 hours.

10. **Audio:** private Storage bucket, server-generated path
    (`profile_id/uuid.ext`, never the client filename), type allowlist +
    ≤ 2 MB, 5-minute signed URLs to play. Delete files + rows older than
    30 days from the tick.

11. **No secrets in the repo.** `.env.local` is gitignored. No variable
    holding a secret starts with `NEXT_PUBLIC_`. The cron secret goes in
    the `Authorization` header, never the URL. No health data in logs.

12. **Validation:** zod on every body, rejecting unknown fields.

13. **Efficiency:** idempotent tick on flag columns + unique constraint,
    fixed number of batched queries per tick (no query inside a loop),
    server components for data pages, 50-row limit on lists, one Nodemailer
    transport per process.

## Folder layout

```
src/
  app/
    page.tsx                  landing, create profile
    p/[id]/page.tsx           passcode gate
    p/[id]/today/             elder screen
    p/[id]/meds/              caretaker schedule editor
    p/[id]/appointments/
    p/[id]/adherence/
    p/[id]/notes/             voice-note inbox (trusted contacts, caretaker)
    api/                      route handlers (see auth table in SPEC)
  lib/
    db.ts                     Supabase server client
    auth.ts                   passcodes, session, role guard
    mail.ts                   Nodemailer and templates
    schedule.ts               dose generation and tick logic
    validators.ts             zod schemas
docs/                         PRD.md, SPEC.md
supabase/migrations/          SQL migrations
AGENTS.md                     this file
```

## Verification before declaring a task done

Re-read the "Done when" column for the task in `docs/SPEC.md` and prove it
with a test or a manual check, not just by reading your own code.
