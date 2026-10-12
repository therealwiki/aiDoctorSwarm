import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { decideApproval } from "@/lib/store";

// In-app approve/decline (the form on /agents). Email one-tap lives at /api/approvals/email.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const id = String(form.get("id") ?? "");
  const decision = String(form.get("decision") ?? "");
  const back = (q: string) => NextResponse.redirect(new URL(`/agents?${q}`, req.url), 303);
  if (decision !== "approve" && decision !== "decline") return back("error=decision");

  const [user, db] = await Promise.all([getSessionUser(), getDB()]);
  if (!user || !db) return NextResponse.redirect(new URL("/signin?next=/agents", req.url), 303);

  const ap = await decideApproval(db, { id, userId: user.id }, decision);
  if (!ap) return back("error=notfound");
  return back(`decided=${encodeURIComponent(ap.id)}:${ap.status}`);
}
