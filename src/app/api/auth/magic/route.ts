import { NextRequest, NextResponse } from "next/server";
import { createMagicLink, isPlausibleEmail } from "@/lib/auth";
import { appUrl, getDB } from "@/lib/db";
import { emailAdapter } from "@/lib/channels/email";
import { SENDERS } from "@/lib/channels/types";
import { logEmail } from "@/lib/store";
import { T } from "@/lib/templates";
import { WILLIE_SAYS } from "@/lib/willie";

// Step 1 of sign-in: email a one-time link from hello@. Always redirects to /signin?sent=1 for a
// plausible address, whether or not the account exists, so the form can't be used to probe emails.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const email = String(form.get("email") ?? "");
  const next = String(form.get("next") ?? "");
  const back = (q: string) => NextResponse.redirect(new URL(`/signin?${q}`, req.url), 303);

  if (!isPlausibleEmail(email)) return back("error=email");
  const db = await getDB();
  if (!db) return back("error=unavailable");

  try {
    const { token } = await createMagicLink(db, email);
    const url = `${appUrl(req)}/api/auth/callback?token=${token}${next ? `&next=${encodeURIComponent(next)}` : ""}`;
    const subject = WILLIE_SAYS.subjects.magic;
    const { providerId } = await emailAdapter.send({ to: email.trim().toLowerCase(), subject, text: T.magicLink(url), from: SENDERS.hello });
    await logEmail(db, { to: email.trim().toLowerCase(), from: SENDERS.hello, kind: "magic_link", subject, providerId });
  } catch (e) {
    console.error("magic link", e);
    return back("error=send");
  }
  return back("sent=1");
}
