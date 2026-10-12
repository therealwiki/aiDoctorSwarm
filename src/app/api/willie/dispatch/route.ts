import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";
import { dispatchDue } from "@/lib/dispatch";

// Willie's cron. The Worker's `scheduled` export (worker.ts) calls this in-process every 15 minutes
// with `Authorization: Bearer <CRON_SECRET>`. You can also hit it by hand with the same header.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = await getDB();
  if (!db) return NextResponse.json({ error: "no database binding" }, { status: 503 });

  const report = await dispatchDue(db);
  console.log("[willie:dispatch]", JSON.stringify(report));
  return NextResponse.json(report);
}
