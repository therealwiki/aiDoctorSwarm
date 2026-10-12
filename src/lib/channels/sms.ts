import type { ChannelAdapter, Outbound } from "./types";

// Twilio. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM. Inbound: Twilio webhook →
// POST /api/willie/inbound. SMS has no reply token, so Willie matches on the most recent open
// task for that phone number.
export const smsAdapter: ChannelAdapter = {
  name: "sms",
  async send(msg: Outbound) {
    const sid = process.env.TWILIO_ACCOUNT_SID, tok = process.env.TWILIO_AUTH_TOKEN, from = process.env.TWILIO_FROM;
    if (!sid || !tok || !from) {
      console.log("[sms:dry-run]", { to: msg.to, text: msg.text.slice(0, 60) });
      return { providerId: "dry-run" };
    }
    const body = new URLSearchParams({ To: msg.to, From: from, Body: msg.text });
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: { authorization: "Basic " + btoa(`${sid}:${tok}`), "content-type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) throw new Error(`twilio ${r.status}`);
    const j = (await r.json()) as { sid: string };
    return { providerId: j.sid };
  },
};
