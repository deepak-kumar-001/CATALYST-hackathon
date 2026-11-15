import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

let transport: nodemailer.Transporter | null = null;
export function getMailTransport() {
  if (transport) return transport;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  transport = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD } });
  return transport;
}

export async function sendGenericMail(to: string, subject: string, text: string) {
  const mailer = getMailTransport();
  if (!mailer) return { sent: false, demo: true };
  await mailer.sendMail({ from: process.env.GMAIL_USER, to, subject, text });
  return { sent: true, demo: false };
}
