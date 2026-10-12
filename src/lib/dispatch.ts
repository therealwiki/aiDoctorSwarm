// Willie's cron body: send every due task over the first channel the patient allows, mark it sent.
// Called by POST /api/willie/dispatch (which the Worker's `scheduled` export hits every 15 min).

import { getUserById, createMagicLink } from "./auth";
import { appUrl, type DB } from "./db";
import { emailAdapter } from "./channels/email";
import { smsAdapter } from "./channels/sms";
import { SENDERS } from "./channels/types";
import { dueTasks, loadContact, logEmail, markTask, type TaskRow } from "./store";
import { T } from "./templates";
import { WILLIE_SAYS } from "./willie";

export interface DispatchReport {
  checked: number;
  sent: { id: string; kind: string; channel: string }[];
  skipped: { id: string; reason: string }[];
  errors: { id: string; error: string }[];
}

const WEEK = 7 * 86_400_000;

export async function dispatchDue(db: DB, now = new Date()): Promise<DispatchReport> {
  const tasks = await dueTasks(db, now.toISOString());
  const report: DispatchReport = { checked: tasks.length, sent: [], skipped: [], errors: [] };

  for (const t of tasks) {
    try {
      const channel = await sendTask(db, t);
      if (channel) {
        await markTask(db, t.id, "sent");
        report.sent.push({ id: t.id, kind: t.kind, channel });
      } else {
        report.skipped.push({ id: t.id, reason: "no allowed channel with an address" });
      }
    } catch (e) {
      report.errors.push({ id: t.id, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return report;
}

/**
 * Returns the channel used, or null if none was possible. The app is always-on and passive (the task
 * shows on /sanity-checks or /agents), so Willie reaches out on the first allowed outbound channel
 * and falls back to app-only when there is none.
 */
async function sendTask(db: DB, t: TaskRow): Promise<string | null> {
  const user = await getUserById(db, t.userId);
  if (!user) return null;
  const contact = await loadContact(db, user.id, user.email);

  for (const ch of t.channels.filter((c) => c !== "app")) {
    if (ch === "email" && contact.email) {
      const { subject, text } = await emailFor(db, t, user.id);
      const { providerId } = await emailAdapter.send({ to: contact.email, subject, text, from: SENDERS.willie, replyToken: t.id });
      await logEmail(db, { to: contact.email, from: SENDERS.willie, kind: t.kind, subject, providerId });
      return "email";
    }
    if (ch === "sms" && contact.sms) {
      await smsAdapter.send({ to: contact.sms, text: await smsFor(db, t, user.id), replyToken: t.id });
      return "sms";
    }
    // circle / calendar: no executor yet — try the next channel
  }
  return t.channels.includes("app") ? "app" : null;
}

/** A link that signs the patient in and lands on `path`. Health detail lives behind it, never in the message. */
async function signedLink(db: DB, userId: string, path: string, ttlMs: number): Promise<string> {
  const user = await getUserById(db, userId);
  if (!user) throw new Error("no user");
  const { token } = await createMagicLink(db, user.email, ttlMs);
  return `${appUrl()}/api/auth/callback?token=${token}&next=${encodeURIComponent(path)}`;
}

async function emailFor(db: DB, t: TaskRow, userId: string): Promise<{ subject: string; text: string }> {
  switch (t.kind) {
    case "followup":
      return { subject: WILLIE_SAYS.subjects.followup, text: T.sanityCheck(await signedLink(db, userId, "/sanity-checks", WEEK)) };
    case "reminder":
      return { subject: WILLIE_SAYS.subjects.reminder, text: T.reminder(t.title) };
    default:
      return { subject: "A note from Willie", text: T.reminder(t.title) };
  }
}

async function smsFor(db: DB, t: TaskRow, userId: string): Promise<string> {
  switch (t.kind) {
    case "followup":
      return T.sanityCheckSms(await signedLink(db, userId, "/sanity-checks", WEEK));
    default:
      return WILLIE_SAYS.reminder(t.title);
  }
}
