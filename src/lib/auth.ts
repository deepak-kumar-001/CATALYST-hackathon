import { SignJWT, jwtVerify } from "jose";
import { NextRequest } from "next/server";
import { getMember, getProfile } from "./memory-db";
import type { Role, SessionPayload } from "./types";

const COOKIE_NAME = "carecircle_session";
const secretValue = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "carecircle-demo-secret-change-me");
const secret = secretValue ? new TextEncoder().encode(secretValue) : null;

export async function createSession(payload: Omit<SessionPayload, "exp">) {
  if (!secret) throw new Error("JWT_SECRET is required in production");
  const hours = payload.role === "elder" ? 24 * 30 : 12;
  return new SignJWT({ memberId: payload.memberId, profileId: payload.profileId, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(`${hours}h`)
    .sign(secret);
}

export async function readSession(request: NextRequest): Promise<SessionPayload | null> {
  if (!secret) return null;
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (!payload.memberId || !payload.profileId || !payload.role || typeof payload.exp !== "number") return null;
    return { memberId: String(payload.memberId), profileId: String(payload.profileId), role: payload.role as Role, exp: payload.exp };
  } catch { return null; }
}

export async function requireRole(request: NextRequest, profileId: string, roles: Role[]) {
  const session = await readSession(request);
  if (!session || session.profileId !== profileId || !roles.includes(session.role)) return { ok: false as const, status: 403, error: "You do not have access to this care circle." };
  const member = await getMember(session.memberId);
  const profile = await getProfile(profileId);
  if (!member || !profile || member.profileId !== session.profileId || member.role !== session.role) return { ok: false as const, status: 401, error: "Your session is no longer valid." };
  return { ok: true as const, session, member, profile };
}

export { COOKIE_NAME };
