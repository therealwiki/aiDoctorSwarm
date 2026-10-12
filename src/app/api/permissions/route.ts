import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { setPermission } from "@/lib/store";
import { TASK_TYPES } from "@/lib/data";

// Per-task-type permission: off / ask me / auto. Nothing executes without approval unless Auto.
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const key = String(form.get("task_key") ?? "");
  const mode = String(form.get("mode") ?? "");
  const back = (q = "") => NextResponse.redirect(new URL(`/agents${q}`, req.url), 303);
  if (!TASK_TYPES.some((t) => t.key === key) || !["off", "ask", "auto"].includes(mode)) return back("?error=permission");

  const [user, db] = await Promise.all([getSessionUser(), getDB()]);
  if (!user || !db) return NextResponse.redirect(new URL("/signin?next=/agents", req.url), 303);
  await setPermission(db, user.id, key, mode as "off" | "ask" | "auto");
  return back();
}
