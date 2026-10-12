// Willie — the coordinator hare.
//
// Willie is not a medical agent. He is the orchestrator: every task that needs to move between
// the swarm, a human, a calendar, an inbox or a phone goes through him. He decides which channel
// to use (per the patient's permissions), which agent should own the task, and when to hop back
// and ask "were we right?".
//
// Everything here is channel-agnostic. The channel adapters live in ./channels/*.

import type { Consensus, SwarmResult } from "./agents";

export type Channel = "app" | "email" | "sms" | "circle" | "calendar";
export type TaskKind =
  | "schedule"        // book / move a visit            → scheduling agent, calendar + email
  | "records"         // fetch / verify a record        → records agent, email
  | "followup"        // sanity check: "were we right?"  → Willie himself, app + email/sms
  | "digest"          // circle summary                 → Willie, email
  | "reminder"        // nudge                          → Willie, sms/app
  | "handoff";        // refer a question to the swarm  → swarm, app

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

function pickChannels(prefs: ChannelPrefs, wanted: Channel[]): Channel[] {
  const out = wanted.filter((c) => prefs.allow[c]);
  return out.length ? out : ["app"];
}

let seq = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

/**
 * After a swarm answer, Willie plans what happens next:
 *  - a follow-up to ask whether the swarm was right
 *  - a scheduling task if the consensus says a visit is needed
 */
export function planAfterAsk(askId: string, result: SwarmResult, prefs: ChannelPrefs = DEFAULT_PREFS, now = Date.now()): Task[] {
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

  if (u === "today" || u === "this-week" || u === "routine") {
    tasks.push({
      id: newId("sch"),
      kind: "schedule",
      owner: "scheduling",
      title: u === "today" ? "Find a same-day visit" : u === "this-week" ? "Book a visit this week" : "Book a routine visit",
      detail: result.consensus.nextStep,
      dueAt: new Date(now + (u === "today" ? 0 : u === "this-week" ? 2 * DAY : 7 * DAY)).toISOString(),
      channels: pickChannels(prefs, ["calendar", "email", "app"]),
      approval: "ask",
      relatedAskId: askId,
      status: "waiting-approval",
    });
  }
  return tasks;
}

/**
 * Inbound message from any channel (email reply, SMS, circle chat). Willie classifies it and
 * either answers a task, or refers the text to the swarm as a new question.
 */
export type Inbound = { channel: Channel; from: string; text: string; inReplyTo?: string };
export type Routed =
  | { action: "approve" | "decline"; taskId: string }
  | { action: "outcome"; askId: string; verdict: Outcome["verdict"]; note: string }
  | { action: "ask"; question: string }
  | { action: "ignore"; reason: string };

export function routeInbound(msg: Inbound): Routed {
  const t = msg.text.trim();
  const low = t.toLowerCase();
  if (msg.inReplyTo?.startsWith("sch_") || msg.inReplyTo?.startsWith("rec_")) {
    if (/^(yes|y|approve|ok|book it|go ahead)\b/.test(low)) return { action: "approve", taskId: msg.inReplyTo };
    if (/^(no|n|decline|cancel|don'?t)\b/.test(low)) return { action: "decline", taskId: msg.inReplyTo };
  }
  if (msg.inReplyTo?.startsWith("fu_")) {
    const askId = msg.inReplyTo.replace(/^fu_/, "ask_");
    if (/^(yes|right|correct|spot on)\b/.test(low)) return { action: "outcome", askId, verdict: "right", note: t };
    if (/^(partly|sort of|kind of|mostly)\b/.test(low)) return { action: "outcome", askId, verdict: "partly", note: t };
    if (/^(no|wrong|nope)\b/.test(low)) return { action: "outcome", askId, verdict: "wrong", note: t };
    if (/^(not yet|still waiting|haven'?t)\b/.test(low)) return { action: "outcome", askId, verdict: "unknown", note: t };
  }
  if (t.length < 3) return { action: "ignore", reason: "empty" };
  return { action: "ask", question: t };
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

/** Willie's lines, so he sounds like one character everywhere. */
export const WILLIE_SAYS = {
  planned: (days: number) => `I'll hop back in ${days} day${days === 1 ? "" : "s"} for a sanity check — did this turn out right?`,
  followup: "Hey — it's Willie, here for a sanity check. A while ago you asked the swarm something. Were they right?",
  thanks: "Thanks. That goes straight back to the swarm so they do better next time.",
  approvalEmail: (title: string) => `${title}? Reply YES to go ahead or NO to skip. Nothing happens until you say.`,
};
