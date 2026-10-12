import type { CalendarAdapter } from "./types";

// Google Calendar via OAuth. Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and a per-user refresh
// token stored in D1 `channel_links`. Until OAuth exists this returns synthetic slots so the
// scheduling flow can be exercised end to end.
export function googleCalendar(accessToken?: string): CalendarAdapter {
  return {
    name: "google",
    async freeSlots(from, to, minutes) {
      if (!accessToken) {
        const out = [] as { start: string; end: string }[];
        const d = new Date(from);
        d.setHours(10, 30, 0, 0);
        for (let i = 0; i < 3 && d < to; i++) {
          d.setDate(d.getDate() + (i === 0 ? 2 : 1));
          out.push({ start: d.toISOString(), end: new Date(d.getTime() + minutes * 60000).toISOString() });
        }
        return out;
      }
      const r = await fetch("https://www.googleapis.com/calendar/v3/freeBusy", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ timeMin: from.toISOString(), timeMax: to.toISOString(), items: [{ id: "primary" }] }),
      });
      if (!r.ok) throw new Error(`gcal ${r.status}`);
      // TODO: invert busy blocks into free slots of `minutes`
      return [];
    },
    async hold(task, slot) {
      if (!accessToken) return { eventId: `hold_${task.id}` };
      const r = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ summary: `[Hold] ${task.title}`, start: { dateTime: slot.start }, end: { dateTime: slot.end }, transparency: "transparent" }),
      });
      const j = (await r.json()) as { id: string };
      return { eventId: j.id };
    },
    async confirm() { /* PATCH summary to drop [Hold], set transparency opaque */ },
    async release(eventId) { if (accessToken) await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, { method: "DELETE", headers: { authorization: `Bearer ${accessToken}` } }); },
  };
}
