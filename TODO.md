# CareCircle delivery outcomes

## Profile creation, passcodes, login and role guards
- [x] A caretaker can create a profile with elder name and language, add members, and receive one random passcode per member; each passcode is shown once and only a bcrypt hash is stored.
- [x] Anyone can log in through the profile link and passcode; five wrong attempts in 15 minutes lock the profile and IP, and a correct passcode sets an httpOnly session cookie.
- [x] Every route checks the session, the role, and that the profile in the session matches the profile in the request; access is enforced on the server rather than only by hiding UI buttons.

## Medication schedules, Today and idempotent Taken action
- [x] A caretaker can add, edit and deactivate medicines with name, dosage, times, notes and a critical flag; elder and family edit attempts return 403.
- [x] The elder sees today's doses as large cards and can tap Taken; the dose gets a timestamp and a second tap changes nothing further.
- [x] The local reminder tick creates dose logs with a unique medication/time constraint and is safe to run twice.

## Appointments
- [x] A caretaker can add appointments with doctor, place, time and notes; every role can view upcoming appointments and past appointments are hidden from the default view.

## Reminder engine and email-safe escalation
- [x] A due-dose reminder is emitted once per dose to the elder when they have email, otherwise to the caretaker.
- [x] A pending dose beyond `GRACE_MINUTES` becomes missed once, emails the caretaker, and emails trusted contacts too when the medication is critical; rerunning the tick sends nothing new.
- [x] Appointments trigger one reminder 24 hours before and one reminder 2 hours before.
- [x] Voice-note notifications are generic and contain no medicine names, dosages or note text.

## Private voice-note channel
- [x] The elder can start recording with one tap, stop/send with a second tap, and auto-stop at 60 seconds; success shows “Sent to your trusted contact”.
- [x] Voice-note uploads require the elder role, a server-generated storage path, an allowlisted type, a 2 MB limit and a 10-notes-per-hour profile limit.
- [x] Trusted contacts can listen through a signed five-minute URL, tag a note as pain/concern/other, and choose forward, keep private or resolve; new notes default to private.
- [x] A caretaker sees only forwarded notes; private notes never appear in caretaker API responses, email, pages or activity log.

## Adherence, accessibility and progressive enhancement
- [x] Adherence shows taken of due doses per medicine for the last 7 days, matching dose log rows.
- [x] The optional Listen button reads fixed status sentences in the elder language when a matching browser voice is installed and falls back to English otherwise.
- [x] The interface uses large type and controls, high contrast, responsive layout, and clear status messaging for elders.

## Security, schema, documentation and delivery
- [x] RLS is enabled on every Supabase table with no anon policies in `docs/supabase.sql`; the service-role key is documented as server-only.
- [x] Strict zod validation, signed httpOnly sessions, exact Origin checks, role/profile guards, private audio handling, security headers and a no-PII public profile response are implemented.
- [x] No secrets are committed; README states passcode limitations, private-channel limits, dose-confirmation limits, free-tier/idle limits, cross-browser voice limits, and emergency guidance.
- [x] The app serves a synchronized `/manus-routes.json`, passes `pnpm typecheck`, `pnpm build`, and the committed `pnpm smoke` runtime checks.
- [ ] Production persistence and storage are still the explicit adapter boundary: the current checkpoint is a fully working server-side demo using `src/lib/memory-db.ts`; connect the documented Supabase service-role adapter and private bucket when deploying with real credentials.
