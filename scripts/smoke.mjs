const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const json = async (path, init = {}) => { const response = await fetch(`${base}${path}`, init); const body = await response.json(); return { response, body }; };
const cookieFrom = (response) => { const raw = response.headers.get("set-cookie") || ""; const match = raw.match(/carecircle_session=([^;]+)/); return match?.[1] || ""; };
const headers = (cookie) => cookie ? { Cookie: `carecircle_session=${cookie}` } : {};

const health = await json("/api/health");
assert(health.response.ok && health.body.ok, "health route failed");
const publicProfile = await json("/api/profiles/demo");
assert(publicProfile.response.ok && !publicProfile.body.members, "public profile exposed a member roster");
const invalidOrigin = await json("/api/auth", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://localhost.evil" }, body: JSON.stringify({ profileId: "demo", passcode: "CARE-ELDER" }) });
assert(invalidOrigin.response.status === 403, "crafted origin was accepted");

const elderLogin = await json("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: "demo", passcode: "CARE-ELDER" }) });
const elderCookie = cookieFrom(elderLogin.response);
assert(elderLogin.response.ok && elderCookie, "elder login failed");
const today = await json("/api/doses/today", { headers: headers(elderCookie) });
const dose = today.body.doses[0];
const firstTake = await json(`/api/doses/${dose.id}/take`, { method: "POST", headers: { ...headers(elderCookie), "Content-Type": "application/json" }, body: "{}" });
const secondTake = await json(`/api/doses/${dose.id}/take`, { method: "POST", headers: { ...headers(elderCookie), "Content-Type": "application/json" }, body: "{}" });
assert(firstTake.body.dose.status === "taken" && secondTake.body.dose.status === "taken", "Taken action was not idempotent");
const forbidden = await json("/api/meds/med-metformin", { method: "PATCH", headers: { ...headers(elderCookie), "Content-Type": "application/json" }, body: JSON.stringify({ active: false }) });
assert(forbidden.response.status === 403, "elder could edit medications");

const trustedLogin = await json("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId: "demo", passcode: "CARE-TRUSTED" }) });
const trustedCookie = cookieFrom(trustedLogin.response);
const audioGate = await json("/api/voice-notes/note-1/audio", { headers: headers(trustedCookie) });
const audio = await fetch(`${base}${audioGate.body.url}`);
assert(audio.ok && audio.status === 200, "signed audio URL failed");
const forwarded = await json("/api/voice-notes/note-1", { method: "PATCH", headers: { ...headers(trustedCookie), "Content-Type": "application/json" }, body: JSON.stringify({ action: "forward" }) });
assert(forwarded.response.ok && !forwarded.body.note.audioData, "note triage leaked raw audio");

console.log("CareCircle smoke checks passed");
