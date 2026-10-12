import type { Task } from "../willie";

export interface Outbound {
  to: string;
  subject?: string;
  text: string;
  replyToken: string; // task id; inbound replies carry it back so Willie can route them
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
