import { NextRequest, NextResponse } from "next/server";
import { routeInbound, type Channel } from "@/lib/willie";

// One webhook for every channel. Resend/Cloudflare email → JSON; Twilio → form-encoded.
// Reply tokens: email carries it in the To address (willie+<token>@…); SMS has none (matched by phone).
export async function POST(req: NextRequest) {
  const ct = req.headers.get("content-type") ?? "";
  let channel: Channel = "email", from = "", text = "", inReplyTo: string | undefined;

  if (ct.includes("application/json")) {
    const j = await req.json();
    from = j.from ?? j.sender ?? "";
    text = j.text ?? j.body ?? "";
    const to: string = Array.isArray(j.to) ? j.to[0] : j.to ?? "";
    inReplyTo = /willie\+([a-z0-9_]+)@/i.exec(to)?.[1];
  } else {
    const f = await req.formData();
    channel = "sms";
    from = String(f.get("From") ?? "");
    text = String(f.get("Body") ?? "");
    // TODO: look up the most recent open task for `from` in D1 and set inReplyTo
  }

  const routed = routeInbound({ channel, from, text, inReplyTo });
  console.log("[willie:inbound]", { channel, from, routed });
  // TODO: persist to D1 (approvals / outcomes / asks) and dispatch to the owning agent.
  return NextResponse.json({ ok: true, routed });
}
