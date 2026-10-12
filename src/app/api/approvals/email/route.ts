import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { decideApproval } from "@/lib/store";

// One-tap approve/decline from an email. The token is the credential (unguessable, expires with the
// approval), so no session is needed; the landing page shows the result without any health detail.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const decision = req.nextUrl.searchParams.get("decision");
  const back = (q: string) => NextResponse.redirect(new URL(`/agents?${q}`, req.url), 303);
  if ((decision !== "approve" && decision !== "decline") || !/^[a-f0-9]{48}$/.test(token)) return back("error=link");

  const db = await getDB();
  if (!db) return back("error=unavailable");
  const ap = await decideApproval(db, { emailToken: token }, decision);
  if (!ap) return back("error=notfound");
  return back(`decided=${encodeURIComponent(ap.id)}:${ap.status}`);
}
