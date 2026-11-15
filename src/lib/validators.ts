import { z } from "zod";

export const profileSchema = z.object({ elderName: z.string().trim().min(2).max(80), language: z.enum(["en-IN", "hi-IN", "ta-IN"]), caretakerName: z.string().trim().min(2).max(80), caretakerEmail: z.string().email().optional().or(z.literal("")), trustedName: z.string().trim().max(80).optional().or(z.literal("")), trustedEmail: z.string().email().optional().or(z.literal("")) }).strict();
export const authSchema = z.object({ profileId: z.string().min(2).max(80), passcode: z.string().min(4).max(32) }).strict();
export const medicationSchema = z.object({ name: z.string().trim().min(2).max(80), dosage: z.string().trim().min(1).max(80), times: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(6), notes: z.string().max(240), isCritical: z.boolean() }).strict();
export const appointmentSchema = z.object({ doctor: z.string().trim().min(2).max(100), location: z.string().trim().min(2).max(120), startsAt: z.string().datetime(), notes: z.string().max(240) }).strict();
export const noteActionSchema = z.object({ action: z.enum(["tag", "forward", "private", "resolve"]), tag: z.enum(["pain", "concern", "other"]).optional() }).strict();
