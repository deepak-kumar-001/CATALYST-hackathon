# CareCircle — PRD (Product Requirements Document)

Nov 15, 2026 · @hoolahoo

## Scope

The eight must-haves total 315 minutes against 345 available, so they fit only if your agents write most of the code. Adherence moved up from "if ahead" because the brief asks for it. This supersedes the cut order in the Final Project Definition doc.

| Tier | Item | Minutes |
| --- | --- | --- |
| Must | Setup: Supabase SQL, RLS, env vars | 20 |
| Must | Profiles, members, passcode login, lockout, role guard | 45 |
| Must | Medications CRUD, Today screen, Taken button | 60 |
| Must | Appointments | 20 |
| Must | Reminder engine and emails (dose due, missed, appointment) | 55 |
| Must | Voice note, trusted-contact triage, forward | 55 |
| Must | Adherence table (taken of due, last 7 days) | 15 |
| Must | Security pass, README, live tests | 45 |
| If ahead | Listen button (read aloud) | 20 |
| If ahead | Activity log | 15 |
| If ahead | Backup trusted contact | 10 |
| Only if spare | Daily family digest | 20 |

Available time is 10:00 am to 4:15 pm minus 30 minutes of lunch. Minutes are planning estimates for agent-assisted work, not measurements. If the must-haves are not working by 2:30 pm, skip every "if ahead" item.

**Cut (README roadmap only):** prescription scan, AI summaries, conversational voice assistant, WhatsApp and SMS, dark mode, per-condition rules, regional-language screens beyond the Listen sentences.

## PRD: problem and users

Elderly people miss medicines and appointments, and their families usually learn about it only after something goes wrong.

The apps I reviewed (from search summaries, not independently verified) assume the elder installs and manages an app, give caregivers either view-only or full control with nothing in between, and alert on fixed timings. CareCircle targets those gaps: no install, no typing, no password for the elder, and a private route to a trusted person.

| Role | Who | Primary need |
| --- | --- | --- |
| Elder | Mrs. Lakshmi, 72, five daily medicines | Know what to take, confirm with one tap, speak up privately |
| Caretaker | Daughter-in-law who helps in person | Edit schedules, learn quickly when a dose is missed |
| Trusted contact | Son in another city | Hear private voice notes and decide what to share |
| Other family | Relatives | View the schedule and adherence |

**Goals**

1. The elder uses the app with no install, typing or password.
2. A missed dose reaches the caretaker after a configurable grace period.
3. The elder has a private route to a trusted person.
4. Access is enforced on the server, not in the UI.

**Non-goals:** medical advice, drug-interaction checks, real user accounts, a native app, SMS or WhatsApp, and verifying that a dose was actually swallowed.

## PRD: requirements

FR1 to FR12 are must-haves; FR13 and FR14 are built only if ahead.

| ID | Requirement | Accepted when |
| --- | --- | --- |
| FR1 | A caretaker creates a profile (elder name, language) and adds members. One random passcode is generated per member. | Each passcode is shown once and only a bcrypt hash is stored. |
| FR2 | Anyone logs in with the profile link and their passcode. | Five wrong attempts in 15 minutes lock that profile and IP; a correct passcode sets a session cookie. |
| FR3 | The caretaker adds, edits and deactivates medicines with name, dosage, times, notes and a critical flag. | Elder and family get a 403 on every edit route. |
| FR4 | The elder sees today's doses as large cards and taps Taken. | The dose becomes taken with a timestamp; a double tap changes nothing further. |
| FR5 | The caretaker adds appointments (doctor, place, time, notes); every role can view upcoming ones. | Past appointments are hidden from the default view. |
| FR6 | A reminder email goes out when a dose is due, to the elder if they have an email, otherwise to the caretaker. | One email per dose, never repeated. |
| FR7 | A pending dose past the grace period (GRACE_MINUTES, default 30) becomes missed and the caretaker is emailed; for critical medicines trusted contacts are emailed too. | One escalation per dose; a rerun of the tick sends nothing new. |
| FR8 | Appointments trigger emails 24 hours and 2 hours before. | Each reminder is sent once and then flagged. |
| FR9 | The elder records a voice note with one tap to start and one tap to send, stopping automatically at 60 seconds. | The screen then shows "Sent to [name]". |
| FR10 | The trusted contact gets a generic email, listens, tags the note (pain, concern, other) and chooses forward, keep private or resolve. | New notes default to private. |
| FR11 | A caretaker sees only notes that were forwarded to them. | A private note never appears for a caretaker in any API response, email or page. |
| FR12 | An adherence table shows taken of due doses per medicine for the last 7 days. | Counts match the dose_logs rows. |
| FR13 | If ahead: a Listen button reads today's status aloud in the elder's language. | Falls back to English when no voice is installed. |
| FR14 | If ahead: an activity log records who changed what and when. | It never mentions that a private note exists. |

## PRD: success criteria, assumptions and limits

The build succeeds if a judge can create a profile and see Today in under 60 seconds, and watch a missed-dose email arrive without waiting 30 minutes.

**Success criteria**

- With GRACE_MINUTES set to 1, a missed-dose email arrives within one cron cycle of the grace period ending. For the demo, trigger the tick by hand with the secret header.
- A voice note marked private is invisible from the caretaker's screen.
- No secret is committed, and every table has RLS on.

**Assumptions and known limits (state these in the README)**

- Passcodes are a weaker identity than real accounts. The production fix is magic links plus device binding.
- A private channel does not protect the elder if the trusted contact is the problem. A backup trusted contact is the planned fix.
- The app records what the elder or caretaker confirms; it cannot verify that a dose was taken.
- Free tiers have limits and a Supabase free project may pause when idle, so open it the morning of judging.
- Voice playback across browsers is untested; record on one device and play on another early.
- A reminder tool, not medical advice. In an emergency, call 112.
