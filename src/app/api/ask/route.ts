import { NextRequest, NextResponse } from "next/server";
import { runSwarm } from "@/lib/swarm";
import { planAfterAsk } from "@/lib/willie";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { question?: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const question = (body.question ?? "").trim();
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });
  if (question.length > 2000) return NextResponse.json({ error: "question too long" }, { status: 413 });

  try {
    const result = await runSwarm(question, body.context);
    const askId = `ask_${Date.now().toString(36)}`;
    const plan = planAfterAsk(askId, result);
    // TODO: persist ask + plan to D1 (asks, tasks) once auth exists
    return NextResponse.json({ ...result, askId, plan });
  } catch (e) {
    console.error("swarm error", e);
    return NextResponse.json({ error: "The swarm could not answer right now." }, { status: 502 });
  }
}
