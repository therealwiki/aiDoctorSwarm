import type { ChannelAdapter, Outbound } from "./types";

// Resend. Set RESEND_API_KEY + EMAIL_FROM. Inbound replies: point Resend/Cloudflare Email Routing
// at POST /api/willie/inbound; the reply token travels in the Reply-To address
// (willie+<token>@mail.aidoctorswarm.com) so replies route without parsing the body.
export const emailAdapter: ChannelAdapter = {
  name: "email",
  async send(msg: Outbound) {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM ?? "Willie <willie@mail.aidoctorswarm.com>";
    if (!key) {
      console.log("[email:dry-run]", { to: msg.to, subject: msg.subject, replyToken: msg.replyToken });
      return { providerId: "dry-run" };
    }
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [msg.to],
        subject: msg.subject ?? "A note from Willie",   // never a diagnosis in a subject line
        text: msg.text,
        reply_to: `willie+${msg.replyToken}@mail.aidoctorswarm.com`,
      }),
    });
    if (!r.ok) throw new Error(`resend ${r.status}`);
    const j = (await r.json()) as { id: string };
    return { providerId: j.id };
  },
};
