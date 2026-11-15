"use client";

import { FormEvent, useState } from "react";

const demoCodes = { elder: "CARE-ELDER", caretaker: "CARE-CARETAKER", trusted: "CARE-TRUSTED" };

export default function HomePage() {
  const [form, setForm] = useState({ elderName: "", language: "en-IN", caretakerName: "", caretakerEmail: "", trustedName: "", trustedEmail: "" });
  const [created, setCreated] = useState<any>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [existingProfile, setExistingProfile] = useState("");
  const [existingPasscode, setExistingPasscode] = useState("");
  const [existingError, setExistingError] = useState("");
  const [existingBusy, setExistingBusy] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const update = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const login = async (profileId: string, passcode: string) => {
    const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, passcode }) });
    const result = await response.json();
    if (!response.ok) return setError(result.error || "Could not sign in");
    window.location.href = result.redirect;
  };
  const copyProfileLink = async () => {
    const link = `${window.location.origin}/p/${created.profile.id}`;
    try { await navigator.clipboard.writeText(link); setCopiedLink(true); window.setTimeout(() => setCopiedLink(false), 3000); }
    catch { setError("Copy failed. Please save the profile link shown below."); }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/profiles", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) return setError(result.error || "Please check the details");
    setCreated(result);
  };
  const signInExisting = async (event: FormEvent) => {
    event.preventDefault(); setExistingBusy(true); setExistingError("");
    const linkMatch = existingProfile.trim().match(/\/p\/([^/?#]+)/);
    const profileId = linkMatch?.[1] || existingProfile.trim();
    const response = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ profileId, passcode: existingPasscode.trim() }) });
    const result = await response.json(); setExistingBusy(false);
    if (!response.ok) return setExistingError(result.error || "Could not sign in");
    window.location.href = result.redirect;
  };

  return <main className="page-shell">
    <div className="container">
      <header className="topbar"><a className="brand" href="/"><span className="brand-mark" />CareCircle</a><div className="topbar-actions"><a href="#existing" className="btn btn-secondary">Sign in</a><a href="#create" className="btn btn-secondary">Create a care circle</a><button className="btn btn-primary" onClick={() => login("demo", demoCodes.elder)}>Open demo</button></div></header>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow">A calmer way to care</div><h1 className="display">Keep the next caring step <span style={{ color: "var(--teal)" }}>close.</span></h1><p className="body-large">CareCircle gives elders a clear Today view, gives caretakers a gentle early signal, and gives trusted family a private line in.</p><div className="action-row" style={{ marginTop: 30 }}><a className="btn btn-primary btn-large" href="#create">Build a care circle <span aria-hidden="true">→</span></a><button className="btn btn-secondary btn-large" onClick={() => login("demo", demoCodes.elder)}>Try the demo</button></div><p className="muted" style={{ marginTop: 18, fontSize: 13 }}>No app install. No elder password. Just one clear tap at a time.</p></div>
        <div className="hero-panel" aria-label="Today preview"><div className="panel-topline"><div><div className="eyebrow">Today · Lakshmi</div><strong style={{ fontSize: 20 }}>Tuesday, 15 Nov</strong></div><span className="status-dot">On track</span></div><div className="mini-dose"><div className="mini-time">08:00 AM</div><div className="mini-icon">M</div><div><strong>Metformin</strong><span>500 mg · with food</span></div><span className="check-pill">Taken</span></div><div className="mini-dose"><div className="mini-time">01:00 PM</div><div className="mini-icon">D</div><div><strong>Vitamin D3</strong><span>1 tablet · after lunch</span></div><span className="check-pill" style={{ background: "var(--gold-soft)", color: "#896019" }}>Next</span></div><div className="mini-dose"><div className="mini-time">08:00 PM</div><div className="mini-icon">A</div><div><strong>Amlodipine</strong><span>5 mg · water nearby</span></div><span className="check-pill" style={{ background: "#f0f3f2", color: "var(--muted)" }}>Later</span></div></div>
      </section>
      <section className="feature-strip"><div className="feature"><span className="feature-number">01 · FOR ELDERS</span><h3>One tap is enough.</h3><p>Large dose cards, a clear Taken button, and a private voice note when words are hard.</p></div><div className="feature"><span className="feature-number">02 · FOR CARETAKERS</span><h3>See what needs care.</h3><p>Edit schedules, add appointments, and get one helpful signal when a dose slips past grace time.</p></div><div className="feature"><span className="feature-number">03 · FOR TRUSTED FAMILY</span><h3>Stay close, privately.</h3><p>Listen to a note, decide what to share, and keep the rest between the people who need to know.</p></div></section>
      <section id="existing" className="auth-card" style={{ margin: "0 auto 22px" }}>
        <div className="eyebrow">Already have a care circle?</div><h2 className="display" style={{ fontSize: 30, margin: "15px 0 8px" }}>Open your profile</h2><p className="muted" style={{ margin: 0 }}>Enter the profile ID from your private link and the passcode you were given.</p><form onSubmit={signInExisting}><div className="field-grid"><div className="field"><label>Profile ID or private link</label><input required value={existingProfile} onChange={(event) => setExistingProfile(event.target.value)} placeholder="p_… or /p/p_…" /></div><div className="field"><label>Passcode</label><input required value={existingPasscode} onChange={(event) => setExistingPasscode(event.target.value.toUpperCase())} placeholder="Your care code" autoComplete="one-time-code" /></div></div>{existingError && <div className="error">{existingError}</div>}<div className="auth-form-actions"><span className="muted" style={{ fontSize: 12 }}>Your role is determined by the server.</span><button className="btn btn-primary" disabled={existingBusy}>{existingBusy ? "Signing in…" : "Open profile"}</button></div></form>
      </section>
      <section id="create" className="auth-card" style={{ margin: "0 auto 90px" }}>
        {!created ? <><div className="eyebrow">Start small</div><h2 className="display" style={{ fontSize: 34, margin: "15px 0 8px" }}>Create your care circle</h2><p className="muted" style={{ margin: 0 }}>The first step takes less than a minute. Passcodes are shown once so you can hand each person the right one.</p><form onSubmit={submit}><div className="field-grid"><div className="field"><label>Elder name</label><input required value={form.elderName} onChange={(e) => update("elderName", e.target.value)} placeholder="Lakshmi Rao" /></div><div className="field"><label>Language</label><select value={form.language} onChange={(e) => update("language", e.target.value)}><option value="en-IN">English · India</option><option value="hi-IN">हिन्दी · India</option><option value="ta-IN">தமிழ் · India</option></select></div><div className="field"><label>Caretaker name</label><input required value={form.caretakerName} onChange={(e) => update("caretakerName", e.target.value)} placeholder="Anika" /></div><div className="field"><label>Caretaker email</label><input type="email" value={form.caretakerEmail} onChange={(e) => update("caretakerEmail", e.target.value)} placeholder="Optional for reminders" /></div><div className="field"><label>Trusted contact</label><input value={form.trustedName} onChange={(e) => update("trustedName", e.target.value)} placeholder="Ravi (optional)" /></div><div className="field"><label>Trusted email</label><input type="email" value={form.trustedEmail} onChange={(e) => update("trustedEmail", e.target.value)} placeholder="Optional for reminders" /></div></div>{error && <div className="error">{error}</div>}<div className="auth-form-actions"><span className="muted" style={{ fontSize: 12 }}>Server-side access checks are always on.</span><button className="btn btn-primary" disabled={busy}>{busy ? "Creating…" : "Create care circle"}</button></div></form></> : <><div className="eyebrow">Circle created</div><h2 className="display" style={{ fontSize: 34, margin: "15px 0 8px" }}>Keep these passcodes safe.</h2><p className="muted">They are displayed once. In production, only a bcrypt hash is stored on the server.</p><div className="code-list"><div className="code-row"><span>{created.profile.elderName} · elder</span><code>{created.passcodes.elder}</code></div><div className="code-row"><span>{created.members.find((m: any) => m.role === "caretaker")?.name} · caretaker</span><code>{created.passcodes.caretaker}</code></div>{created.passcodes.trusted && <div className="code-row"><span>Trusted contact</span><code>{created.passcodes.trusted}</code></div>}</div><div className="code-row" style={{ marginTop: 18 }}><span>Profile ID</span><code>{created.profile.id}</code></div><p className="muted" style={{ fontSize: 12, overflowWrap: "anywhere" }}>Private link: {window.location.origin}/p/{created.profile.id}</p><div className="action-row"><button className="btn btn-primary" onClick={() => login(created.profile.id, created.passcodes.elder)}>Open Today as elder</button><button className="btn btn-secondary" onClick={copyProfileLink}>{copiedLink ? "Profile link copied" : "Copy profile link"}</button><a className="btn btn-ghost" href={`/p/${created.profile.id}`}>Use profile link</a></div></>}
      </section>
    </div>
  </main>;
}
