import { NextRequest, NextResponse } from "next/server";
import { addActivity, addAppointment, addMedication, addVoiceNote, createAudioToken, createProfile, getActivity, getAdherence, getAppointments, getDemoPasscodes, getDose, getMember, getMedication, getMedications, getProfile, getRecentVoiceNoteCount, getTodayDoses, getTrustedMembers, getVoiceNote, getVoiceNotes, isLockedOut, publicMember, readVoiceAudio, recordAuthAttempt, takeDose, updateMedication, updateVoiceNote, verifyAudioToken } from "@/lib/memory-db";
import { createSession, requireRole, readSession, COOKIE_NAME } from "@/lib/auth";
import { appointmentSchema, authSchema, medicationSchema, noteActionSchema, profileSchema } from "@/lib/validators";
import { runTickAll } from "@/lib/schedule";
import { sendGenericMail } from "@/lib/server-services";

export const dynamic = "force-dynamic";

type Context = { params: { path?: string[] } };
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const pathOf = (context: Context) => context.params.path ?? [];
function originAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    const requestOrigin = new URL(request.url);
    if (parsed.origin === requestOrigin.origin) return true;
    if (parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")) return true;
    return parsed.protocol === "https:" && (parsed.hostname === "manus.computer" || parsed.hostname.endsWith(".manus.computer"));
  } catch { return false; }
}

function cronAuthorized(request: NextRequest) { const configured = process.env.CRON_SECRET; return configured ? request.headers.get("authorization") === `Bearer ${configured}` : process.env.NODE_ENV !== "production" && request.headers.get("x-demo-cron") === "demo"; }
async function dispatchEvents(events: { recipient: string; subject: string; message: string }[]) {
  for (const event of events) await sendGenericMail(event.recipient, event.subject, event.message);
}
async function bodyJson(request: NextRequest) {
  try { return await request.json(); } catch { return null; }
}

function sessionView(request: NextRequest) {
  return readSession(request);
}

export async function GET(request: NextRequest, context: Context) {
  const path = pathOf(context);
  if (path[0] === "session") {
    const session = await sessionView(request);
    if (!session) return json({ session: null });
    const member = await getMember(session.memberId);
    const profile = await getProfile(session.profileId);
    return json({ session, member: member ? publicMember(member) : null, profile, demoPasscodes: getDemoPasscodes(session.profileId) });
  }
  if (path[0] === "profiles" && path[1]) {
    const profile = await getProfile(path[1]);
    if (!profile) return json({ error: "Profile not found" }, 404);
    return json({ profile, demoPasscodes: path[1] === "demo" ? getDemoPasscodes(profile.id) : null });
  }
  if (path[0] === "cron" && path[1] === "tick") {
    if (!cronAuthorized(request)) return json({ error: "Unauthorized" }, 401);
    const result = await runTickAll();
    if (request.headers.has("authorization")) await dispatchEvents(result.events);
    return json({ ...result, ranAt: new Date().toISOString() });
  }
  if (path[0] === "health") return json({ ok: true, service: "carecircle" });
  if (path[0] === "voice-notes" && path[1] && path[2] === "audio") {
    const token = request.nextUrl.searchParams.get("token");
    if (token) {
      const verified = verifyAudioToken(token); const note = verified ? await getVoiceNote(verified.noteId) : null;
      if (!note) return json({ error: "This audio link has expired" }, 410);
      const audio = await readVoiceAudio(note);
      return new Response(audio.bytes, { headers: { "Content-Type": audio.contentType, "Cache-Control": "private, no-store" } });
    }
  }

  const session = await sessionView(request);
  if (!session) return json({ error: "Sign in to continue" }, 401);
  const profileId = session.profileId;
  if (path[0] === "meds") {
    const guard = await requireRole(request, profileId, ["elder", "caretaker", "family"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    return json({ medications: await getMedications(profileId), doses: await getTodayDoses(profileId) });
  }
  if (path[0] === "doses" && path[1] === "today") {
    const guard = await requireRole(request, profileId, ["elder", "caretaker", "family"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    return json({ doses: await getTodayDoses(profileId), medications: await getMedications(profileId) });
  }
  if (path[0] === "appointments") {
    const guard = await requireRole(request, profileId, ["elder", "caretaker", "family"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    return json({ appointments: await getAppointments(profileId) });
  }
  if (path[0] === "adherence") {
    const guard = await requireRole(request, profileId, ["elder", "caretaker", "family"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    return json({ adherence: await getAdherence(profileId) });
  }
  if (path[0] === "voice-notes") {
    if (path[1] && path[2] === "audio") {
      const note = await getVoiceNote(path[1]);
      if (!note || note.profileId !== profileId) return json({ error: "Note not found" }, 404);
      const guard = await requireRole(request, profileId, ["family", "caretaker"]);
      if (!guard.ok) return json({ error: guard.error }, guard.status);
      if (guard.member.role === "family" && !guard.member.isTrusted) return json({ error: "Trusted contact access required" }, 403);
      if (guard.member.role === "caretaker" && note.status !== "forwarded") return json({ error: "This note is private" }, 403);
      if (note.status === "new") await updateVoiceNote(note.id, { status: "heard" });
      return json({ url: `/api/voice-notes/${note.id}/audio?token=${encodeURIComponent(createAudioToken(note.id))}`, expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
    }
    const guard = await requireRole(request, profileId, ["elder", "family", "caretaker"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    if (guard.member.role === "family" && !guard.member.isTrusted) return json({ error: "Trusted contact access required" }, 403);
    return json({ notes: await getVoiceNotes(profileId, guard.member.role) });
  }
  if (path[0] === "activity") {
    const guard = await requireRole(request, profileId, ["caretaker"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    return json({ activity: await getActivity(profileId) });
  }
  return json({ error: "Not found" }, 404);
}

export async function POST(request: NextRequest, context: Context) {
  if (!originAllowed(request)) return json({ error: "Invalid request origin" }, 403);
  const path = pathOf(context);
  if (path[0] === "profiles") {
    const body = await bodyJson(request);
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Please check the profile details", fields: parsed.error.flatten().fieldErrors }, 400);
    const created = await createProfile(parsed.data);
    return json({ ...created, message: "Passcodes are shown once. Save them somewhere safe." }, 201);
  }
  if (path[0] === "auth") {
    const body = await bodyJson(request);
    const parsed = authSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Enter a valid passcode" }, 400);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "demo-ip";
    if (await isLockedOut(parsed.data.profileId, ip)) return json({ error: "Too many attempts. Try again in 15 minutes." }, 429);
    const member = await (await import("@/lib/memory-db")).verifyPasscode(parsed.data.profileId, parsed.data.passcode);
    await recordAuthAttempt(parsed.data.profileId, ip, Boolean(member));
    if (!member) return (await isLockedOut(parsed.data.profileId, ip))
      ? json({ error: "Too many attempts. Try again in 15 minutes." }, 429)
      : json({ error: "That passcode does not match this care circle." }, 401);
    const token = await createSession({ memberId: member.id, profileId: member.profileId, role: member.role });
    const response = json({ profile: await getProfile(member.profileId), member: publicMember(member), redirect: `/p/${member.profileId}/today` });
    response.cookies.set(COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: member.role === "elder" ? 60 * 60 * 24 * 30 : 60 * 60 * 12 });
    return response;
  }
  const session = await sessionView(request);
  if (!session) return json({ error: "Sign in to continue" }, 401);
  const profileId = session.profileId;
  if (path[0] === "meds" && !path[1]) {
    const guard = await requireRole(request, profileId, ["caretaker"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    const body = await bodyJson(request);
    const parsed = medicationSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Please check the medication details", fields: parsed.error.flatten().fieldErrors }, 400);
    const medication = await addMedication({ ...parsed.data, profileId, active: true });
    await addActivity(profileId, session.memberId, "Added medication", medication.name);
    return json({ medication }, 201);
  }
  if (path[0] === "appointments") {
    const guard = await requireRole(request, profileId, ["caretaker"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    const body = await bodyJson(request);
    const parsed = appointmentSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Please check the appointment details", fields: parsed.error.flatten().fieldErrors }, 400);
    const appointment = await addAppointment({ ...parsed.data, profileId });
    await addActivity(profileId, session.memberId, "Added appointment", appointment.doctor);
    return json({ appointment }, 201);
  }
  if (path[0] === "doses" && path[2] === "take") {
    const guard = await requireRole(request, profileId, ["elder", "caretaker"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    const dose = await getDose(path[1]);
    if (dose && dose.profileId !== profileId) return json({ error: "Dose not found" }, 404);
    if (!dose) return json({ error: "Dose not found" }, 404);
    if (dose.status === "missed" || dose.status === "skipped") return json({ error: "This dose is already closed." }, 409);
    return json({ dose: await takeDose(dose.id, session.memberId), message: "Marked as taken" });
  }
  if (path[0] === "cron" && path[1] === "tick") {
    if (!cronAuthorized(request)) return json({ error: "Unauthorized" }, 401);
    const result = await runTickAll();
    await dispatchEvents(result.events);
    return json({ ...result, ranAt: new Date().toISOString() });
  }
  if (path[0] === "voice-notes") {
    const guard = await requireRole(request, profileId, ["elder"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    const form = await request.formData();
    const file = form.get("audio");
    if (!(file instanceof File)) return json({ error: "Audio file is required" }, 400);
    const allowed = ["audio/webm", "audio/mp4", "audio/ogg", "audio/wav"];
    const contentType = file.type.split(";", 1)[0].trim().toLowerCase();
    if (!allowed.includes(contentType) || file.size > 2 * 1024 * 1024) return json({ error: "Audio must be webm, mp4, ogg or wav and 2 MB or smaller" }, 400);
    const recent = await getRecentVoiceNoteCount(profileId);
    if (recent >= 10) return json({ error: "Please wait before sending another note" }, 429);
    const bytes = Buffer.from(await file.arrayBuffer()).toString("base64");
    const ext = contentType.split("/")[1] || "webm";
    const durationS = Number(form.get("durationS") || 1);
    if (!Number.isInteger(durationS) || durationS < 1 || durationS > 60) return json({ error: "Voice note duration must be between 1 and 60 seconds" }, 400);
    const note = await addVoiceNote({ profileId, audioPath: `${profileId}/${crypto.randomUUID()}.${ext}`, audioData: bytes, contentType, durationS });
    const trustedRecipients = (await getTrustedMembers(profileId)).map((member) => member.email).filter(Boolean) as string[];
    if (trustedRecipients.length) {
      try {
        const results = await Promise.all(trustedRecipients.map((recipient) => sendGenericMail(recipient, "CareCircle needs your attention", "A trusted person left a private voice note. Open CareCircle to listen and decide whether to forward it.")));
        if (results.every((result) => result.sent)) await updateVoiceNote(note.id, { notifiedAt: new Date().toISOString() });
      } catch {
        // Keep the note saved; the authenticated cron tick can retry notification delivery.
      }
    }
    return json({ note: { ...note, audioData: null }, message: "Sent to your trusted contact" }, 201);
  }
  return json({ error: "Not found" }, 404);
}

export async function PATCH(request: NextRequest, context: Context) {
  if (!originAllowed(request)) return json({ error: "Invalid request origin" }, 403);
  const path = pathOf(context);
  const session = await sessionView(request);
  if (!session) return json({ error: "Sign in to continue" }, 401);
  const profileId = session.profileId;
  if (path[0] === "meds" && path[1]) {
    const guard = await requireRole(request, profileId, ["caretaker"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    const medication = await getMedication(path[1]);
    if (!medication || medication.profileId !== profileId) return json({ error: "Medication not found" }, 404);
    const body = await bodyJson(request);
    const parsed = medicationSchema.partial().strict().safeParse(body);
    if (!parsed.success) return json({ error: "Please check the medication details" }, 400);
    const updated = await updateMedication(path[1], parsed.data);
    await addActivity(profileId, session.memberId, "Updated medication", medication.name);
    return json({ medication: updated });
  }
  if (path[0] === "voice-notes" && path[1]) {
    const guard = await requireRole(request, profileId, ["family"]);
    if (!guard.ok) return json({ error: guard.error }, guard.status);
    if (!guard.member.isTrusted) return json({ error: "Trusted contact access required" }, 403);
    const note = await getVoiceNote(path[1]);
    if (!note || note.profileId !== profileId) return json({ error: "Note not found" }, 404);
    const body = await bodyJson(request);
    const parsed = noteActionSchema.safeParse(body);
    if (!parsed.success) return json({ error: "Choose a valid note action" }, 400);
    if (parsed.data.action === "tag") await updateVoiceNote(note.id, { tag: parsed.data.tag, status: "heard", handledBy: session.memberId });
    if (parsed.data.action === "forward") await updateVoiceNote(note.id, { status: "forwarded", forwardedAt: new Date().toISOString(), handledBy: session.memberId });
    if (parsed.data.action === "private") await updateVoiceNote(note.id, { status: "private", handledBy: session.memberId });
    if (parsed.data.action === "resolve") await updateVoiceNote(note.id, { status: "resolved", handledBy: session.memberId });
    const updated = await getVoiceNote(note.id);
    return json({ note: updated ? { id: updated.id, status: updated.status, tag: updated.tag } : null, message: parsed.data.action === "forward" ? "Forwarded to the caretaker" : "Private note updated" });
  }
  return json({ error: "Not found" }, 404);
}
