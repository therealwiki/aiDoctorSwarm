import { NextRequest, NextResponse } from "next/server";
import { routeInbound, WILLIE_SAYS, type Channel, type Routed } from "@/lib/willie";
import { appUrl, getDB, newId, type DB } from "@/lib/db";
import { createMagicLink, getUserByEmail, normalizeEmail } from "@/lib/auth";
import { decideApproval, getTask, insertOutcome, latestSentTaskForPhone, logEmail, recordInbound, userByPhone } from "@/lib/store";
import { emailAdapter } from "@/lib/channels/email";
import { SENDERS } from "@/lib/channels/types";
import { runSwarm } from "@/lib/swarm";
import { persistAsk } from "@/lib/asks";
import { T } from "@/lib/templates";

// One webhook for every channel. Resend/Cloudflare email → JSON; Twilio → form-encoded.
// Reply tokens: email carries the task id in the To address (willie+<token>@…); SMS has none, so
// Willie matches the newest task he wrote to that phone about.
//
// Guards: INBOUND_SECRET must match ?key= when set; Twilio requests are signature-checked when
// TWILIO_AUTH_TOKEN is set. Willie only acts for senders linked to an account.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.INBOUND_SECRET;
  if (secret && req.nextUrl.searchParams.get("key") !== secret) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ct = req.headers.get("content-type") ?? "";
  let channel: Channel = "email", from = "", text = "", inReplyTo: string | undefined;

  if (ct.includes("application/json")) {
    const j = (await req.json()) as Record<string, unknown>;
    from = extractEmail(String(j.from ?? j.sender ?? ""));
    text = String(j.text ?? j.body ?? "");
    const to = Array.isArray(j.to) ? String(j.to[0] ?? "") : String(j.to ?? "");
    inReplyTo = /willie\+([a-z0-9_]+)@/i.exec(to)?.[1];
  } else {
    const f = await req.formData();
    channel = "sms";
    const params: Record<string, string> = {};
    f.forEach((v, k) => (params[k] = String(v)));
    const tok = process.env.TWILIO_AUTH_TOKEN;
    if (tok && !(await verifyTwilio(req.url, params, req.headers.get("x-twilio-signature") ?? "", tok))) {
      return NextResponse.json({ error: "bad signature" }, { status: 403 });
    }
    from = params.From ?? "";
    text = params.Body ?? "";
  }

  const db = await getDB();
  if (!db) {
    const routed = routeInbound({ channel, from, text, inReplyTo });
    console.log("[willie:inbound:no-db]", { channel, from, routed });
    return respond(channel, null);
  }

  if (channel === "sms" && !inReplyTo && from) inReplyTo = (await latestSentTaskForPhone(db, from))?.id;
  const routed = routeInbound({ channel, from, text, inReplyTo });
  await recordInbound(db, { channel, from, body: text, replyToken: inReplyTo, routed });

  const reply = await act(db, channel, from, routed, appUrl(req));
  console.log("[willie:inbound]", { channel, action: routed.action, replied: !!reply });

  if (reply && channel === "email" && from) {
    await emailAdapter.send({ to: from, subject: reply.subject, text: reply.text, from: SENDERS.willie, replyToken: reply.replyToken });
    await logEmail(db, { to: from, from: SENDERS.willie, kind: "inbound-reply", subject: reply.subject });
  }
  return respond(channel, reply?.sms ?? null);
}

type Reply = { subject: string; text: string; sms: string; replyToken?: string };

async function act(db: DB, channel: Channel, from: string, routed: Routed, base: string): Promise<Reply | null> {
  const sender = await identify(db, channel, from);

  switch (routed.action) {
    case "approve":
    case "decline": {
      const task = await getTask(db, routed.taskId);
      if (!task || !sender || sender.id !== task.userId) return null;
      const ap = await decideApproval(db, { taskId: task.id }, routed.action);
      if (!ap || (ap.status !== "approved" && ap.status !== "declined")) return null;
      const line = ap.status === "approved" ? WILLIE_SAYS.approved(task.title) : WILLIE_SAYS.declined(task.title);
      return { subject: WILLIE_SAYS.subjects.approval, text: `${line}\n\n— Willie`, sms: line };
    }
    case "outcome": {
      const task = await getTask(db, routed.taskId);
      if (!task?.relatedAskId || !sender || sender.id !== task.userId) return null;
      await insertOutcome(
        db,
        sender.id,
        { askId: task.relatedAskId, verdict: routed.verdict, whatHappened: routed.note.slice(0, 2000), sawClinician: false, reportedAt: new Date().toISOString() },
        channel === "sms" ? "sms" : "email",
      );
      return { subject: WILLIE_SAYS.subjects.followup, text: T.thanks(), sms: WILLIE_SAYS.thanks };
    }
    case "ask": {
      if (!sender) return null; // never answer strangers; the message is logged in `inbound`
      const result = await runSwarm(routed.question);
      const askId = newId("ask");
      await persistAsk(db, sender, askId, result, base);
      const { token } = await createMagicLink(db, sender.email, 7 * 86_400_000);
      const url = `${base}/api/auth/callback?token=${token}&next=${encodeURIComponent(`/ask?id=${askId}`)}`;
      return { subject: WILLIE_SAYS.subjects.answer, text: T.answerReady(url), sms: `${WILLIE_SAYS.answered} ${url}` };
    }
    default:
      return null;
  }
}

async function identify(db: DB, channel: Channel, from: string): Promise<{ id: string; email: string } | null> {
  if (!from) return null;
  if (channel === "sms") return userByPhone(db, from);
  const u = await getUserByEmail(db, normalizeEmail(from));
  return u ? { id: u.id, email: u.email } : null;
}

function extractEmail(s: string): string {
  return (/<([^>]+)>/.exec(s)?.[1] ?? s).trim().toLowerCase();
}

/** Twilio: 200 with TwiML (optionally a <Message> reply). Email providers: JSON. */
function respond(channel: Channel, sms: string | null) {
  if (channel !== "sms") return NextResponse.json({ ok: true });
  const body = sms ? `<Response><Message>${escapeXml(sms)}</Message></Response>` : "<Response></Response>";
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?>${body}`, { headers: { "content-type": "text/xml" } });
}

const escapeXml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** X-Twilio-Signature = base64(HMAC-SHA1(authToken, url + concat(sorted key+value))). */
async function verifyTwilio(url: string, params: Record<string, string>, signature: string, token: string): Promise<boolean> {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(token), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data)))));
  return sig.length === signature.length && sig === signature;
}

