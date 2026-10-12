import { NextRequest, NextResponse } from "next/server";
import type { Outcome } from "@/lib/willie";

// Patient reports, later in time, whether the swarm was right. This is the training signal.
export async function POST(req: NextRequest) {
  const j = (await req.json()) as Partial<Outcome>;
  if (!j.askId || !j.verdict) return NextResponse.json({ error: "askId and verdict required" }, { status: 400 });
  const outcome: Outcome = {
    askId: j.askId,
    verdict: j.verdict,
    whatHappened: (j.whatHappened ?? "").slice(0, 2000),
    agentVerdicts: j.agentVerdicts,
    sawClinician: !!j.sawClinician,
    reportedAt: new Date().toISOString(),
  };
  console.log("[outcome]", outcome);
  // TODO: INSERT INTO outcomes …; mark the followup task done; feed eval set.
  return NextResponse.json({ ok: true, outcome });
}
