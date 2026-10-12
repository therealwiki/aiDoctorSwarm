import { NextRequest, NextResponse } from "next/server";
import { consumeMagicLink, safeNext, SESSION_COOKIE, sessionCookieOptions, sessionCookieValue } from "@/lib/auth";
import { getDB } from "@/lib/db";

// Step 2 of sign-in: burn the token, set the session cookie, land on `next`.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const fail = (why: string) => NextResponse.redirect(new URL(`/signin?error=${why}`, req.url), 303);

  const db = await getDB();
  if (!db) return fail("unavailable");
  const user = await consumeMagicLink(db, token);
  if (!user) return fail("expired");
  const cookie = await sessionCookieValue(user.id);
  if (!cookie) return fail("unavailable");

  const res = NextResponse.redirect(new URL(next, req.url), 303);
  res.cookies.set(SESSION_COOKIE, cookie.value, sessionCookieOptions(cookie.expires));
  return res;
}
