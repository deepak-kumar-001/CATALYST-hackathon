# CareCircle implementation plan

## Product approach

CareCircle will be a responsive web app that lets a caretaker create an elder profile, issue one-time passcodes, manage medicine schedules and appointments, and stay informed about missed doses. The elder experience is intentionally simple: large touch targets, today's doses first, a single Taken action, and a single voice-note record/send action. Trusted contacts get a private inbox with explicit triage actions.

The first working checkpoint will be demo-ready without requiring external credentials: a server-side in-memory repository seeds a realistic demo profile and exposes the same API boundaries the production Supabase implementation needs. The README and `docs/supabase.sql` will make the production migration explicit. When Supabase/SMTP environment variables are added, the domain layer is the intended replacement point; browser code remains API-only.

## Implementation shape

- **Frontend:** Next.js App Router, TypeScript, responsive CSS, server-rendered route entry points with client-side interaction islands.
- **Server boundary:** a single optional catch-all API route dispatches the documented endpoint paths, applies role/profile checks, validates JSON/multipart inputs, signs an httpOnly session cookie, and exposes a protected cron tick.
- **Domain layer:** `src/lib/memory-db.ts` models profiles, members, medications, doses, appointments, voice notes, auth attempts and activity records; `src/lib/auth.ts` owns passcodes, lockout and sessions; `src/lib/schedule.ts` owns idempotent dose generation, reminders and escalations.
- **Production handoff:** `docs/supabase.sql` enables RLS on every table with no anon policies, and `.env.example` lists the required server-only values from the brief.
- **Pages:** landing/profile creation, passcode gate, Today, medications, appointments, adherence, and voice-note inbox. Navigation is role-aware but authorization is enforced in route handlers.

## Design direction

### Three possible styles

- **Quiet care dashboard** — warm clinic neutrals and teal confidence, probability 0.06.
- **Civic signal board** — high-contrast navy, orange alerts, and structured utility panels, probability 0.07.
- **Soft editorial companion** — cream paper, coral accents, and conversational cards, probability 0.05.

### Chosen style: quiet care dashboard

- **Design Movement:** accessible public-service digital design blended with calm editorial healthcare dashboards.
- **Core Principles:** reduce cognitive load, make urgency unmistakable, keep actions reversible and explicit, and treat privacy as part of the interface.
- **Color Philosophy:** warm ivory surfaces make the experience feel domestic rather than clinical; deep ink preserves contrast; CareCircle teal signals trust and completed care; coral is reserved for missed or critical moments.
- **Layout Paradigm:** a left rail anchors context on desktop while the content column reads like a daily care brief; mobile collapses into a top bar and stacked action cards instead of a dense grid.
- **Signature Elements:** a teal “care ring” brand mark, oversized dose cards with clear status bands, and a thin coral “attention line” used only for exceptions.
- **Interaction Philosophy:** every high-value action is one obvious tap, with visible confirmation and a short explanation of what changed.
- **Animation:** use quick 160–220ms fades and gentle slide-ins for status updates; avoid continuous motion and never animate critical alerts in a distracting loop.
- **Typography System:** system sans for predictable legibility; bold 700–800 headings, 16–18px body copy, 20px+ elder controls, and monospace only for one-time passcodes.
- **Brand Essence:** a calm care relay for elders and the people who watch out for them; steady, private, human.
- **Brand Voice:** direct, reassuring, never clinical. Example lines: “Today is easier when the next step is clear.” and “Only the people you choose can hear this note.”
- **Wordmark & Logo:** the wordmark pairs “Care” in a sturdy weight with “Circle” in a softer rounded weight, preceded by a hand-drawn circular ring with a small break that suggests an open line of care.
- **Signature Brand Color:** Care Teal `#0F766E`.

## Build workflow

1. Create the Next.js shell, route manifest, headers, server helpers, and local seeded repository.
2. Implement public profile creation and passcode login with demo shortcuts.
3. Implement Today, medications, appointments, adherence, voice notes, and the cron simulation controls.
4. Add Supabase schema, security documentation, environment template, and focused tests/validation.
5. Run diagnostics, typecheck/build, start Preview, verify key routes and route manifest, then checkpoint to the canonical main branch.

## Scope decisions

The must-have flows FR1–FR12 are included. FR13 Listen is included as a small progressive enhancement using browser speech synthesis. Activity log is visible only as a lightweight caretaker timeline; daily digest, prescription scan, AI summaries, SMS/WhatsApp, dark mode, and per-condition rules remain roadmap items.
