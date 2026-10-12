import { NextRequest, NextResponse } from "next/server";
import { runSwarm } from "@/lib/swarm";
import { getSessionUser } from "@/lib/auth";
import { appUrl, getDB, newId } from "@/lib/db";
import { getAsk } from "@/lib/store";
import { persistAsk, type AskResponse } from "@/lib/asks";

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
    const [result, user, db] = await Promise.all([runSwarm(question, body.context), getSessionUser(), getDB()]);
    const askId = newId("ask");
    const { plan, scheduled } = await persistAsk(db, user, askId, result, appUrl(req));
    return NextResponse.json({ ...result, askId, plan, scheduled } satisfies AskResponse);
  } catch (e) {
    console.error("swarm error", e);
    return NextResponse.json({ error: "The swarm could not answer right now." }, { status: 502 });
  }
}

/** Re-open a saved answer: GET /api/ask?id=ask_… — only the asker can read it. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const db = await getDB();
  if (!db || !/^ask_[a-f0-9]+$/.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [ask, user] = await Promise.all([getAsk(db, id), getSessionUser()]);
  if (!ask || !ask.userId || ask.userId !== user?.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ...ask.result, askId: ask.id, plan: [], scheduled: true } satisfies AskResponse);
}
