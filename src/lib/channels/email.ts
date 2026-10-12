import { REPLY_DOMAIN, SENDERS, type ChannelAdapter, type Outbound } from "./types";

// Resend. Set RESEND_API_KEY. Inbound replies: point Resend/Cloudflare Email Routing for
// *@mail.aidoctorswarm.com at POST /api/willie/inbound?key=<INBOUND_SECRET>; the reply token
// travels in the Reply-To address (willie+<token>@mail.aidoctorswarm.com) so replies route
// without parsing the body. Plain-text only, no diagnosis in a subject line.
export const emailAdapter: ChannelAdapter = {
  name: "email",
  async send(msg: Outbound) {
    const key = process.env.RESEND_API_KEY;
    const from = msg.from ?? process.env.EMAIL_FROM ?? SENDERS.willie;
    const subject = msg.subject ?? "A note from Willie";
    const reply_to = msg.replyToken ? `willie+${msg.replyToken}@${REPLY_DOMAIN}` : undefined;
    if (!key) {
      // Dry run: print the whole message so a developer can follow the link from the terminal.
      console.log(`[email:dry-run] from=${from} to=${msg.to} reply_to=${reply_to ?? "-"}\nsubject: ${subject}\n${msg.text}\n`);
      return { providerId: "dry-run" };
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from, to: [msg.to], subject, text: msg.text, ...(reply_to ? { reply_to } : {}) }),
    });
    if (!r.ok) throw new Error(`resend ${r.status}`);
    const j = (await r.json()) as { id: string };
    return { providerId: j.id };
  },
};
