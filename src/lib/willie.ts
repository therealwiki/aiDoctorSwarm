// Willie — the coordinator hare.
//
// Willie is not a medical agent. He is the orchestrator: every task that needs to move between
// the swarm, a human, a calendar, an inbox or a phone goes through him. He decides which channel
// to use (per the patient's permissions), which agent should own the task, and when to hop back
// and ask "were we right?".
//
// Everything here is channel-agnostic and client-safe (no SDK, no DB). The channel adapters live
// in ./channels/*, the D1 queries in ./store.ts, the cron logic in ./dispatch.ts.

import type { Consensus, SwarmResult } from "./agents";

export type Channel = "app" | "email" | "sms" | "circle" | "calendar";
export type TaskKind =
  | "schedule"        // book / move a visit            → scheduling agent, calendar + email
  | "records"         // fetch / verify a record        → records agent, email
  | "followup"        // sanity check: "were we right?"  → Willie himself, app + email/sms
  | "digest"          // circle summary                 → Willie, email
  | "reminder"        // nudge                          → Willie, sms/app
  | "handoff";        // refer a question to the swarm  → swarm, app

export type PermissionMode = "off" | "ask" | "auto";

export interface Task {
  id: string;
  kind: TaskKind;
  owner: "willie" | "scheduling" | "records" | "swarm";
  title: string;
  detail?: string;
  dueAt: string;            // ISO
  channels: Channel[];      // where Willie will reach the patient, in order of preference
  approval: "none" | "ask" | "auto";
  relatedAskId?: string;
  status: "queued" | "waiting-approval" | "sent" | "done" | "cancelled";
}

export interface ChannelPrefs {
  email?: string;
  sms?: string;
  calendar?: "google" | "outlook" | null;
  quietHours?: { from: number; to: number }; // 0–23 local
  allow: Record<Channel, boolean>;
}

export const DEFAULT_PREFS: ChannelPrefs = {
  calendar: null,
  allow: { app: true, email: true, sms: false, circle: true, calendar: false },
};

/** Per-task-type permission defaults; the patient overrides these in /agents. */
export const DEFAULT_PERMISSIONS: Record<string, PermissionMode> = {
  schedule: "ask",
  records: "ask",
  refills: "off",
  digest: "auto",
  reminders: "auto",
};

const DAY = 86_400_000;

/** How long before Willie checks back, by urgency of the swarm's answer. */
export function followupDelay(urgency: Consensus["urgency"]): number {
  switch (urgency) {
    case "emergency": return 1 * DAY;
    case "today":     return 2 * DAY;
    case "this-week": return 10 * DAY;
    case "routine":   return 28 * DAY;
    default:          return 14 * DAY;
  }
}

export function daysUntil(iso: string, now = Date.now()): number {
  return Math.max(1, Math.round((new Date(iso).getTime() - now) / DAY));
}

function pickChannels(prefs: ChannelPrefs, wanted: Channel[]): Channel[] {
  const out = wanted.filter((c) => prefs.allow[c]);
  return out.length ? out : ["app"];
}

function newId(prefix: string): string {
  const b = new Uint8Array(8);
  crypto.getRandomValues(b);
  return `${prefix}_${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * After a swarm answer, Willie plans what happens next:
 *  - a follow-up to ask whether the swarm was right
 *  - a scheduling task if the consensus says a visit is needed — unless the patient set
 *    "Book and reschedule visits" to Off; Auto skips the approval step.
 */
export function planAfterAsk(
  askId: string,
  result: SwarmResult,
  prefs: ChannelPrefs = DEFAULT_PREFS,
  perms: Record<string, PermissionMode> = DEFAULT_PERMISSIONS,
  now = Date.now(),
): Task[] {
  const tasks: Task[] = [];
  const u = result.consensus.urgency;

  tasks.push({
    id: newId("fu"),
    kind: "followup",
    owner: "willie",
    title: "Sanity check: was the swarm right?",
    detail: `About: "${result.question.slice(0, 80)}"`,
    dueAt: new Date(now + followupDelay(u)).toISOString(),
    channels: pickChannels(prefs, ["app", "email", "sms"]),
    approval: "none",
    relatedAskId: askId,
    status: "queued",
  });

  const scheduleMode = perms.schedule ?? DEFAULT_PERMISSIONS.schedule;
  if ((u === "today" || u === "this-week" || u === "routine") && scheduleMode !== "off") {
    tasks.push({
      id: newId("sch"),
      kind: "schedule",
      owner: "scheduling",
      title: u === "today" ? "Find a same-day visit" : u === "this-week" ? "Book a visit this week" : "Book a routine visit",
      detail: result.consensus.nextStep,
      dueAt: new Date(now + (u === "today" ? 0 : u === "this-week" ? 2 * DAY : 7 * DAY)).toISOString(),
      channels: pickChannels(prefs, ["calendar", "email", "app"]),
      approval: scheduleMode,
      relatedAskId: askId,
      status: scheduleMode === "auto" ? "queued" : "waiting-approval",
    });
  }
  return tasks;
}

/**
 * Inbound message from any channel (email reply, SMS, circle chat). Willie classifies it and
 * either answers a task, or refers the text to the swarm as a new question.
 * `inReplyTo` is a task id (the reply token). Resolving it to an ask/user happens in the route.
 */
export type Inbound = { channel: Channel; from: string; text: string; inReplyTo?: string };
export type Routed =
  | { action: "approve" | "decline"; taskId: string }
  | { action: "outcome"; taskId: string; verdict: Outcome["verdict"]; note: string }
  | { action: "ask"; question: string }
  | { action: "ignore"; reason: string };

export function routeInbound(msg: Inbound): Routed {
  const t = stripQuoted(msg.text);
  const low = t.toLowerCase();
  if (msg.inReplyTo?.startsWith("sch_") || msg.inReplyTo?.startsWith("rec_")) {
    if (/^(yes|y|yep|approve|ok|okay|book it|go ahead)\b/.test(low)) return { action: "approve", taskId: msg.inReplyTo };
    if (/^(no|n|nope|decline|cancel|don'?t|stop)\b/.test(low)) return { action: "decline", taskId: msg.inReplyTo };
  }
  if (msg.inReplyTo?.startsWith("fu_")) {
    const taskId = msg.inReplyTo;
    if (/^(yes|yep|right|correct|spot on)\b/.test(low)) return { action: "outcome", taskId, verdict: "right", note: t };
    if (/^(partly|sort of|kind of|mostly|half)\b/.test(low)) return { action: "outcome", taskId, verdict: "partly", note: t };
    if (/^(no|nope|wrong)\b/.test(low)) return { action: "outcome", taskId, verdict: "wrong", note: t };
    if (/^(not yet|still waiting|haven'?t|don'?t know)\b/.test(low)) return { action: "outcome", taskId, verdict: "unknown", note: t };
  }
  if (t.length < 3) return { action: "ignore", reason: "empty" };
  return { action: "ask", question: t };
}

/** Drop quoted history and signatures from an email reply so routing sees only the new text. */
export function stripQuoted(text: string): string {
  const lines = text.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  for (const l of lines) {
    if (/^>/.test(l)) break;
    if (/^On .+wrote:\s*$/.test(l)) break;
    if (/^-- ?$/.test(l)) break;
    if (/^(From|Sent|To|Subject):\s/.test(l)) break;
    out.push(l);
  }
  return out.join("\n").trim();
}

/** What the patient tells us later. This is the ground truth the swarm learns from. */
export interface Outcome {
  askId: string;
  verdict: "right" | "partly" | "wrong" | "unknown";
  whatHappened: string;           // free text, e.g. "it was a cyst, drained in clinic"
  agentVerdicts?: Partial<Record<string, "right" | "wrong">>; // per-agent, optional
  sawClinician: boolean;
  reportedAt: string;
}

/**
 * Willie's lines, so he sounds like one character everywhere — app, email, SMS.
 * Email subjects never carry a diagnosis or the question; health detail stays behind a signed link.
 */
export const WILLIE_SAYS = {
  planned: (days: number) => `I'll hop back in ${days} day${days === 1 ? "" : "s"} for a sanity check — did this turn out right?`,
  plannedSignedOut: (days: number) =>
    `Sign in and I'll hop back in ${days} day${days === 1 ? "" : "s"} for a sanity check — did this turn out right?`,
  followup: "Hey — it's Willie, here for a sanity check. A while ago you asked the swarm something. Were they right?",
  followupShort: "Willie here for a sanity check: was the swarm right about what you asked? Reply YES, PARTLY, NO or NOT YET.",
  thanks: "Thanks. That goes straight back to the swarm so they do better next time.",
  approvalEmail: (title: string) => `${title}? Reply YES to go ahead or NO to skip. Nothing happens until you say.`,
  approved: (title: string) => `Got it — "${title}" is a go. I'll let you know when it's done.`,
  declined: (title: string) => `No problem — "${title}" is off the list.`,
  reminder: (title: string) => `Quick nudge from Willie: ${title}.`,
  answered: "The swarm has read your question and answered. Your answer is behind the link below — it's private to you.",
  signIn: "Here's your one-time sign-in link. It works once and expires in 15 minutes. If you didn't ask for it, ignore this email.",
  unknownSender: "I only act on messages from an address or number linked to an account, so I've set this one aside. Sign in at aidoctorswarm.com to link it.",
  subjects: {
    followup: "Quick sanity check from Willie",
    approval: "One thing needs your OK",
    magic: "Your sign-in link",
    answer: "The swarm has answered",
    digest: "Your care circle this week",
    reminder: "A nudge from Willie",
  },
} as const;
