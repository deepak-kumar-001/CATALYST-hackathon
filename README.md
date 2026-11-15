# CareCircle

CareCircle is a privacy-first care relay for elders, caretakers and trusted family. The core experience is intentionally small: a caretaker creates a profile, the elder sees a large Today view, a missed dose becomes a generic attention signal, and a trusted contact can decide what happens to a private voice note.

## Run it

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`. The landing page creates a new care circle and displays each passcode once. The judge-ready demo is available at `/p/demo`, with these demo-only codes:

| Role | Code |
| --- | --- |
| Elder | `CARE-ELDER` |
| Caretaker | `CARE-CARETAKER` |
| Trusted contact | `CARE-TRUSTED` |

With no Supabase credentials, the demo uses a server-side in-memory fallback so the entire flow works immediately in a fresh project. When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are configured, the server uses the Supabase service-role repository and private `voice-notes` storage bucket for durable profiles, schedules, activity, auth attempts, and voice notes. Set `SUPABASE_AUDIO_BUCKET` to use a different private bucket. Browser code only calls the API; the service-role key never reaches the browser.

## Production configuration

Copy `.env.example` to `.env.local` and supply `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `CRON_SECRET`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GRACE_MINUTES`, and `APP_URL`. Never prefix a secret with `NEXT_PUBLIC_`. `docs/supabase.sql` contains the table definitions, indexes, RLS enablement and private storage bucket setup from the product spec. The cron endpoint is `/api/cron/tick` and accepts the secret in the `Authorization: Bearer ...` header.

The current checkpoint includes generic Nodemailer templates and a tick simulation. With Gmail credentials present, every missed dose notifies the caretaker and all trusted contacts with email addresses; an elder voice note immediately notifies trusted contacts and remains available in their private in-app inbox, where they can choose **Forward to caretaker**. The authenticated cron tick retries scheduled notifications. Email subjects and bodies deliberately never include medicine names, doses or note text.

## Security notes

Passcodes are a weaker identity than real accounts. The production fix is magic links plus device binding. The server hashes generated passcodes, tracks failed attempts per profile and IP, signs sessions in an httpOnly cookie, checks profile and role on every API route, validates state-changing JSON with strict schemas, applies an Origin check, limits audio uploads, generates storage paths server-side, and hides private notes from caretaker responses. Preview uses `SameSite=None; Secure` for the cross-site embedded session cookie; plain HTTP local development may need browser settings that allow secure cookies.

The voice channel is private but does not protect the elder if the trusted contact is the problem; a second trusted contact is the planned fix. CareCircle records what the elder or caretaker confirms and cannot verify that a dose was swallowed. Free tiers can pause an idle Supabase project, and browser voice playback across devices is untested, so open the app and try recording early on judging day. This is a reminder tool, not medical advice; in an emergency call 112.

## Roadmap

Prescription scan, AI summaries, conversational voice assistant, WhatsApp/SMS, dark mode, per-condition rules, regional-language screens beyond the Listen sentences, daily family digest and a second trusted contact remain follow-up work. The current build includes the optional Listen button as a fixed-sentence browser speech enhancement and a small caretaker activity timeline without ever mentioning the existence of a private note.
