// Seed data used until the D1 tables are wired up (see db/schema.sql).

export interface Topic {
  slug: string;
  name: string;
  blurb: string;
  members: number;
  scope: "local" | "regional" | "global";
}

export const TOPICS: Topic[] = [
  { slug: "immune-aging", name: "Immune aging", blurb: "Panels, biomarkers, what the numbers mean", members: 1240, scope: "global" },
  { slug: "diet", name: "Diet", blurb: "Food, fasting, what actually has evidence", members: 8810, scope: "global" },
  { slug: "fitness", name: "Fitness", blurb: "Training with a condition, recovery, wearables", members: 5120, scope: "global" },
  { slug: "mental-health", name: "Mental health", blurb: "Anxiety about health, burnout, getting help", members: 6730, scope: "global" },
  { slug: "fertility", name: "Fertility", blurb: "Trying, testing, treatment, timelines", members: 2910, scope: "global" },
  { slug: "caregivers", name: "Caregivers", blurb: "Looking after a parent or partner", members: 3340, scope: "global" },
  { slug: "bay-area", name: "Bay Area", blurb: "Clinics, trials and meetups near you", members: 410, scope: "local" },
];

export type FactCheck = "supported" | "mixed" | "unsupported" | "pending";

export interface Post {
  id: string;
  topic: string;
  author: string;
  title: string;
  body: string;
  ago: string;
  replies: number;
  factCheck: FactCheck;
  factNote: string;
}

export const POSTS: Post[] = [
  {
    id: "p1", topic: "immune-aging", author: "mara_k", title: "CRP 4.1 after a cold — how long before a recheck?",
    body: "Got my panel back and CRP went from 2.8 to 4.1. I had a cold 10 days before the draw. Clinic says recheck in a month. Anyone had this come back down?",
    ago: "3h", replies: 12, factCheck: "supported", factNote: "Swarm: transient CRP rises after viral infection are well documented; a 4–6 week recheck is standard.",
  },
  {
    id: "p2", topic: "immune-aging", author: "dev_t", title: "Does fasting lower IL-6? Clinic sells a protocol",
    body: "A longevity clinic offered me a 5-day fasting-mimicking protocol to bring IL-6 down before my next panel. $800. Is there real evidence?",
    ago: "9h", replies: 31, factCheck: "mixed", factNote: "Swarm: small trials show short-term IL-6 reductions; effect on long-term immune-aging markers is not established. Evidence grade C.",
  },
  {
    id: "p3", topic: "mental-health", author: "anon_42", title: "I've cancelled the same appointment three times",
    body: "Every time the day comes I find a reason. It's a lump. I know what I'm doing. How do people actually get themselves through the door?",
    ago: "1d", replies: 58, factCheck: "pending", factNote: "",
  },
  {
    id: "p4", topic: "diet", author: "sunny_p", title: "Seed oils cause inflammation — myth or not?",
    body: "My feed is full of this. My immunology agent said the evidence is weak. Who's right?",
    ago: "2d", replies: 74, factCheck: "unsupported", factNote: "Swarm: controlled trials do not show linoleic acid raising CRP or IL-6 at typical intakes.",
  },
];

export interface CircleMember {
  name: string;
  role: string;
  kind: "human" | "agent";
  logs: boolean;
  chat: boolean;
  act: "off" | "ask" | "auto";
}

export const CIRCLE: CircleMember[] = [
  { name: "Maya", role: "daughter", kind: "human", logs: true, chat: true, act: "off" },
  { name: "Dr. Elena Ramos", role: "rheumatology", kind: "human", logs: true, chat: true, act: "off" },
  { name: "Sam Okafor", role: "patient advocate (legal)", kind: "human", logs: true, chat: false, act: "off" },
  { name: "Records agent", role: "fetches & verifies records", kind: "agent", logs: true, chat: false, act: "ask" },
  { name: "Scheduling agent", role: "books & reschedules", kind: "agent", logs: false, chat: true, act: "auto" },
];

export interface CircleMessage {
  from: string;
  kind: "human" | "agent" | "system";
  text: string;
  ago: string;
}

export const CIRCLE_THREAD: CircleMessage[] = [
  { from: "You", kind: "human", text: "Sharing yesterday's swarm answer about my CRP so everyone's on the same page.", ago: "Yesterday" },
  { from: "Immunology agent", kind: "agent", text: "Summary for the circle: CRP 4.1 mg/L, up from 2.8. Mild, single reading, recheck in ~4 weeks unless symptoms change.", ago: "Yesterday" },
  { from: "Maya", kind: "human", text: "Do you want me to come to the Ramos visit? I can drive.", ago: "Yesterday" },
  { from: "Scheduling agent", kind: "agent", text: "Held Thu Oct 16, 10:30 with Dr. Ramos for 24h. Approval pending in Agents.", ago: "2h" },
  { from: "Dr. Elena Ramos", kind: "human", text: "That slot works. Bring both results and your med list.", ago: "1h" },
];

export interface Approval {
  id: string;
  agent: string;
  title: string;
  detail: string;
  ago: string;
  status: "pending" | "approved" | "declined";
}

export const APPROVALS: Approval[] = [
  { id: "a1", agent: "Scheduling agent", title: "Book Dr. Ramos — Thu Oct 16, 10:30", detail: "Rheumatology follow-up, Bayview Clinic Suite 210 or video. Agenda note will be shared; chat and labs stay private.", ago: "2h", status: "pending" },
  { id: "a2", agent: "Records agent", title: "Request June panel from Quest", detail: "Needed to show the CRP trend. Will be verified against the lab's attestation before it counts.", ago: "5h", status: "pending" },
  { id: "a3", agent: "Records agent", title: "Verified: Sept immune-aging panel", detail: "Lab attestation matched; hash anchored.", ago: "2d", status: "approved" },
];

export const TASK_TYPES = [
  { key: "schedule", label: "Book and reschedule visits", mode: "ask" },
  { key: "records", label: "Request and verify records", mode: "ask" },
  { key: "refills", label: "Request prescription refills", mode: "off" },
  { key: "digest", label: "Email circle digests", mode: "auto" },
  { key: "reminders", label: "Send me reminders", mode: "auto" },
] as const;

export const FACT: Record<FactCheck, { label: string; bg: string; fg: string }> = {
  supported: { label: "Swarm: supported", bg: "#D1FAE5", fg: "#065F46" },
  mixed: { label: "Swarm: mixed evidence", bg: "#FEF3C7", fg: "#92400E" },
  unsupported: { label: "Swarm: not supported", bg: "#FEE2E2", fg: "#991B1B" },
  pending: { label: "Fact-check pending", bg: "#EDE9FE", fg: "#4C1D95" },
};

