import type { Task } from "../willie";

export interface Outbound {
  to: string;
  subject?: string;
  text: string;
  /** Sender identity. Defaults to Willie. Use SENDERS.* so each acting agent writes from its own address. */
  from?: string;
  /** Task id. When set, email replies carry it back in the Reply-To (willie+<token>@…) so Willie can route them. */
  replyToken?: string;
}

export interface ChannelAdapter {
  name: "email" | "sms" | "calendar";
  send(msg: Outbound): Promise<{ providerId: string }>;
}

export interface CalendarAdapter {
  name: "google" | "outlook";
  freeSlots(from: Date, to: Date, minutes: number): Promise<{ start: string; end: string }[]>;
  hold(task: Task, slot: { start: string; end: string }): Promise<{ eventId: string }>;
  confirm(eventId: string): Promise<void>;
  release(eventId: string): Promise<void>;
}

/** One address per acting identity. Humans read hello@, support@, privacy@, clinics@. */
export const SENDERS = {
  willie: "Willie <willie@mail.aidoctorswarm.com>",
  hello: "AI Doctor Swarm <hello@aidoctorswarm.com>",
  scheduling: "Scheduling agent <scheduling@aidoctorswarm.com>",
  records: "Records agent <records@aidoctorswarm.com>",
  circle: "Care circle <circle@aidoctorswarm.com>",
} as const;

export const REPLY_DOMAIN = "mail.aidoctorswarm.com";
