import { NextRequest, NextResponse } from "next/server";
import { runSwarmStream } from "@/lib/swarm";
import { getSessionUser } from "@/lib/auth";
import { appUrl, getDB, newId } from "@/lib/db";
import { getAsk } from "@/lib/store";
import { persistAsk, type AskResponse } from "@/lib/asks";
import { AGENTS, type AgentAnswer, type Consensus } from "@/lib/agents";
import type { Task } from "@/lib/willie";

export const runtime = "nodejs";
export const maxDuration = 60;

/** One JSON object per line (application/x-ndjson), in this order. */
export type AskEvent =
  | { type: "start"; agents: string[] }
  | { type: "answer"; answer: AgentAnswer }
  | { type: "consensus"; consensus: Consensus; mocked: boolean }
  | { type: "done"; askId: string; plan: Task[]; scheduled: boolean }
  | { type: "error"; error: string };

const MAX_CONTEXT = 4000;

/**
 * POST {question, context?} → NDJSON stream of AskEvent. Cards fill as each agent finishes.
 * `context` is the patient's own health notes, sent from their browser; it is used for this answer
 * and never stored (only the question and the agents' answers are saved).
 */
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
  const context = (body.context ?? "").trim().slice(0, MAX_CONTEXT) || undefined;

  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AskEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        send({ type: "start", agents: AGENTS.map((a) => a.id) });
        const [result, user, db] = await Promise.all([
          runSwarmStream(question, context, (answer) => send({ type: "answer", answer })),
          getSessionUser(),
          getDB(),
        ]);
        send({ type: "consensus", consensus: result.consensus, mocked: result.mocked });
        const askId = newId("ask");
        const { plan, scheduled } = await persistAsk(db, user, askId, result, appUrl(req));
        send({ type: "done", askId, plan, scheduled });
      } catch (e) {
        console.error("swarm error", e);
        send({ type: "error", error: "The swarm could not answer right now." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}

/** Re-open a saved answer: GET /api/ask?id=ask_… — only the asker can read it. Plain JSON. */
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  const db = await getDB();
  if (!db || !/^ask_[a-f0-9]+$/.test(id)) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [ask, user] = await Promise.all([getAsk(db, id), getSessionUser()]);
  if (!ask || !ask.userId || ask.userId !== user?.id) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ ...ask.result, askId: ask.id, plan: [], scheduled: true } satisfies AskResponse);
}
