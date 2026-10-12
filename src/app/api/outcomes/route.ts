import { NextRequest, NextResponse } from "next/server";
import type { Outcome } from "@/lib/willie";
import { getSessionUser } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { getAsk, insertOutcome } from "@/lib/store";

// Patient reports, later in time, whether the swarm was right. This is the training signal.
// Private to the patient; only aggregated, anonymised verdicts ever feed agent grading.
export async function POST(req: NextRequest) {
  const j = (await req.json()) as Partial<Outcome>;
  if (!j.askId || !j.verdict) return NextResponse.json({ error: "askId and verdict required" }, { status: 400 });
  if (!["right", "partly", "wrong", "unknown"].includes(j.verdict)) return NextResponse.json({ error: "bad verdict" }, { status: 400 });
  const outcome: Outcome = {
    askId: j.askId,
    verdict: j.verdict,
    whatHappened: (j.whatHappened ?? "").slice(0, 2000),
    agentVerdicts: j.agentVerdicts,
    sawClinician: !!j.sawClinician,
    reportedAt: new Date().toISOString(),
  };

  const [user, db] = await Promise.all([getSessionUser(), getDB()]);
  if (!db) {
    console.log("[outcome:no-db]", outcome);
    return NextResponse.json({ ok: true, stored: false });
  }
  if (!user) return NextResponse.json({ error: "sign in to report an outcome" }, { status: 401 });
  const ask = await getAsk(db, outcome.askId);
  if (!ask || ask.userId !== user.id) return NextResponse.json({ error: "not found" }, { status: 404 });

  await insertOutcome(db, user.id, outcome, "app");
  return NextResponse.json({ ok: true, stored: true });
}
