export type Role = "elder" | "caretaker" | "family";
export type DoseStatus = "pending" | "taken" | "skipped" | "missed";
export type NoteStatus = "new" | "heard" | "private" | "forwarded" | "resolved";
export type NoteTag = "pain" | "concern" | "other" | null;

export interface Profile {
  id: string;
  elderName: string;
  language: string;
  timezone: string;
  createdAt: string;
}

export interface Member {
  id: string;
  profileId: string;
  role: Role;
  name: string;
  email: string | null;
  passcodeHash: string;
  isTrusted: boolean;
  trustOrder: number | null;
}

export interface Medication {
  id: string;
  profileId: string;
  name: string;
  dosage: string;
  times: string[];
  notes: string;
  isCritical: boolean;
  active: boolean;
}

export interface DoseLog {
  id: string;
  medicationId: string;
  profileId: string;
  scheduledFor: string;
  status: DoseStatus;
  confirmedBy: string | null;
  takenAt: string | null;
  reminderSentAt: string | null;
  escalatedAt: string | null;
}

export interface Appointment {
  id: string;
  profileId: string;
  doctor: string;
  location: string;
  startsAt: string;
  notes: string;
  reminded24hAt: string | null;
  reminded2hAt: string | null;
}

export interface VoiceNote {
  id: string;
  profileId: string;
  audioPath: string;
  audioData: string | null;
  contentType: string;
  durationS: number;
  status: NoteStatus;
  tag: NoteTag;
  handledBy: string | null;
  forwardedAt: string | null;
  notifiedAt: string | null;
  createdAt: string;
}

export interface Activity {
  id: string;
  profileId: string;
  memberId: string;
  action: string;
  target: string;
  createdAt: string;
}

export interface SessionPayload {
  memberId: string;
  profileId: string;
  role: Role;
  exp: number;
}
