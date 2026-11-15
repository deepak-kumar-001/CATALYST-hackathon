import { addActivity, ensureDoseLogs, getAllAppointments, getCaretaker, getDoseLogs, getMembers, getMedications, getProfiles, getTrustedMembers, getVoiceNotes, updateAppointment, updateDose, updateVoiceNote } from "./memory-db";
const graceMinutes = Number(process.env.GRACE_MINUTES || 30);
export type TickEvent = { kind: "dose-reminder" | "dose-missed" | "appointment-reminder" | "voice-note"; recipient: string; message: string; subject: string };
export async function runTick(profileId = "demo"): Promise<{ events: TickEvent[]; summary: string }> {
  await ensureDoseLogs(profileId);
  const events: TickEvent[] = [];
  const now = Date.now();
  const meds = await getMedications(profileId);
  const medById = new Map(meds.map((med) => [med.id, med]));
  const members = await getMembers(profileId);
  const caretaker = await getCaretaker(profileId);
  const trusted = await getTrustedMembers(profileId);
  const elderEmail = members.find((member) => member.role === "elder" && member.email)?.email;
  for (const dose of (await getDoseLogs(profileId)).filter((item) => item.status === "pending")) {
    const med = medById.get(dose.medicationId);
    if (!med) continue;
    const scheduled = new Date(dose.scheduledFor).getTime();
    if (!dose.reminderSentAt && scheduled <= now + 10 * 60 * 1000 && scheduled >= now - graceMinutes * 60 * 1000) {
      await updateDose(dose.id, { reminderSentAt: new Date().toISOString() });
      const recipient = elderEmail || caretaker?.email || "caretaker@demo.local";
      events.push({ kind: "dose-reminder", recipient, subject: "CareCircle needs your attention", message: "A scheduled care action is due. Open CareCircle to check in." });
    }
    if (!dose.escalatedAt && scheduled < now - graceMinutes * 60 * 1000) {
      await updateDose(dose.id, { status: "missed", escalatedAt: new Date().toISOString() });
      const recipients = [caretaker?.email || "caretaker@demo.local", ...trusted.map((member) => member.email).filter(Boolean) as string[]];
      for (const recipient of Array.from(new Set(recipients))) events.push({ kind: "dose-missed", recipient, subject: "CareCircle needs your attention", message: "A scheduled care action was missed. Open CareCircle to check in." });
    }
  }
  const recipients = members.filter((member) => member.email).map((member) => member.email as string);
  for (const appointment of await getAllAppointments(profileId)) {
    const delta = new Date(appointment.startsAt).getTime() - now;
    if (delta <= 24 * 60 * 60 * 1000 && delta > 2 * 60 * 60 * 1000 && !appointment.reminded24hAt) {
      await updateAppointment(appointment.id, { reminded24hAt: new Date().toISOString() });
      for (const recipient of recipients) events.push({ kind: "appointment-reminder", recipient, subject: "CareCircle appointment reminder", message: "An appointment is coming up. Open CareCircle for the details." });
    }
    if (delta <= 2 * 60 * 60 * 1000 && delta > 0 && !appointment.reminded2hAt) {
      await updateAppointment(appointment.id, { reminded2hAt: new Date().toISOString() });
      for (const recipient of recipients) events.push({ kind: "appointment-reminder", recipient, subject: "CareCircle appointment reminder", message: "An appointment is coming up soon. Open CareCircle for the details." });
    }
  }
  for (const note of await getVoiceNotes(profileId, "family")) {
    if (note.notifiedAt) continue;
    await updateVoiceNote(note.id, { notifiedAt: new Date().toISOString() });
    for (const recipient of trusted.map((member) => member.email).filter(Boolean) as string[]) events.push({ kind: "voice-note", recipient, subject: "CareCircle needs your attention", message: "A trusted person left a private voice note. Open CareCircle to listen." });
  }
  if (caretaker && events.some((event) => event.kind === "dose-missed")) await addActivity(profileId, caretaker.id, "Reminder engine ran", "missed dose escalation");
  return { events, summary: events.length ? `${events.length} private notification${events.length === 1 ? "" : "s"} queued.` : "Everything is up to date. No new notifications." };
}
export async function runTickAll() {
  const events: TickEvent[] = [];
  for (const profile of await getProfiles()) events.push(...(await runTick(profile.id)).events);
  return { events, summary: events.length ? `${events.length} private notification${events.length === 1 ? "" : "s"} queued.` : "Everything is up to date. No new notifications." };
}
