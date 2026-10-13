"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AskBox from "@/components/AskBox";
import { AGENTS, type AgentAnswer, type AgentId, type Consensus } from "@/lib/agents";
import { WillieSays } from "@/components/Willie";
import { WILLIE_SAYS, daysUntil, type Task } from "@/lib/willie";
import { buildContext, loadProfile } from "@/lib/context";
import type { AskEvent } from "@/app/api/ask/route";
import type { AskResponse } from "@/lib/asks";

const URGENCY: Record<string, { label: string; bg: string; fg: string }> = {
  emergency: { label: "Call emergency services now", bg: "#FEE2E2", fg: "#991B1B" },
  today: { label: "See someone today", bg: "#FEF3C7", fg: "#92400E" },
  "this-week": { label: "Book a visit this week", bg: "#E0F2FE", fg: "#0C4A6E" },
  routine: { label: "Routine visit", bg: "#EDE9FE", fg: "#4C1D95" },
  none: { label: "No visit needed from this alone", bg: "#D1FAE5", fg: "#065F46" },
};

interface State {
  question: string;
  pending: AgentId[];                       // agents still thinking
  answers: Partial<Record<AgentId, AgentAnswer>>;
  consensus: Consensus | null;
  mocked: boolean;
  done: { askId: string; plan: Task[]; scheduled: boolean } | null;
  usedNotes: boolean;
  error: string | null;
}

const fresh = (question: string, usedNotes: boolean): State => ({
  question, pending: [], answers: {}, consensus: null, mocked: false, done: null, usedNotes, error: null,
});

export default function AskClient() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const id = params.get("id") ?? "";
  const [s, setS] = useState<State | null>(null);

  useEffect(() => {
    if (!q && !id) return;
    const ctl = new AbortController();
    const patch = (f: (x: State) => State) => setS((x) => (x ? f(x) : x));

    (async () => {
      if (id) {
        setS(fresh("", false));
        const r = await fetch(`/api/ask?id=${encodeURIComponent(id)}`, { signal: ctl.signal });
        if (!r.ok) return patch((x) => ({ ...x, error: "We couldn’t find that answer. It may belong to another account." }));
        const j = (await r.json()) as AskResponse;
        setS({
          question: j.question,
          pending: [],
          answers: Object.fromEntries(j.answers.map((a) => [a.agent, a])),
          consensus: j.consensus,
          mocked: j.mocked,
          done: { askId: j.askId, plan: j.plan, scheduled: j.scheduled },
          usedNotes: false,
          error: null,
        });
        return;
      }

      const context = buildContext(loadProfile());
      setS({ ...fresh(q, !!context), pending: AGENTS.map((a) => a.id) });
      try {
        const r = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ question: q, context }),
          signal: ctl.signal,
        });
        if (!r.ok || !r.body) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? "The swarm could not answer right now.");
        }
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) if (line.trim()) apply(JSON.parse(line) as AskEvent);
        }
        if (buf.trim()) apply(JSON.parse(buf) as AskEvent);
      } catch (e) {
        if ((e as Error).name !== "AbortError") patch((x) => ({ ...x, pending: [], error: (e as Error).message }));
      }

      function apply(ev: AskEvent) {
        patch((x) => {
          switch (ev.type) {
            case "start": return { ...x, pending: ev.agents as AgentId[] };
            case "answer": return { ...x, pending: x.pending.filter((p) => p !== ev.answer.agent), answers: { ...x.answers, [ev.answer.agent]: ev.answer } };
            case "consensus": return { ...x, consensus: ev.consensus, mocked: ev.mocked };
            case "done": return { ...x, pending: [], done: { askId: ev.askId, plan: ev.plan, scheduled: ev.scheduled } };
            case "error": return { ...x, pending: [], error: ev.error };
          }
        });
      }
    })();
    return () => ctl.abort();
  }, [q, id]);

  const all = s ? AGENTS.map((a) => s.answers[a.id]).filter((a): a is AgentAnswer => !!a) : [];
  const active = all.filter((a) => !a.standsDown);
  const quiet = all.filter((a) => a.standsDown);
  const thinking = s?.pending ?? [];
  const u = s?.consensus ? URGENCY[s.consensus.urgency] ?? URGENCY.none : null;
  const fu = s?.done?.plan.find((t) => t.kind === "followup");

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <AskBox initial={q || s?.question || ""} />

      {s?.error && (
        <div className="card p-5 border-red-300">
          <p className="font-bold">Something went wrong.</p>
          <p className="text-ink-soft text-sm">{s.error}</p>
        </div>
      )}

      {s && !s.error && (
        <>
          <section className="card p-5 flex flex-col gap-3" aria-label="Summary" aria-live="polite">
            {s.consensus && u ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="pill" style={{ background: u.bg, color: u.fg }}>{u.label}</span>
                  <span className="pill bg-lavender-2 text-ink">{s.consensus.agree ? `${active.length} agents agree` : "Agents differ"}</span>
                  {s.usedNotes && <span className="pill border border-line text-ink-soft">used your health notes</span>}
                  {s.mocked && <span className="pill border border-line text-ink-soft">demo answers</span>}
                </div>
                <p className="text-lg font-bold leading-snug m-0">{s.consensus.summary}</p>
                {s.consensus.nextStep && (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="m-0 text-ink-soft">{s.consensus.nextStep}</p>
                    <Link href={`/agents?task=schedule&q=${encodeURIComponent(s.question)}`} className="btn-sun text-sm no-underline ml-auto">
                      Ask an agent to book it
                    </Link>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 text-sm text-ink-soft">
                <span className="w-2.5 h-2.5 rounded-full bg-violet animate-pulse" aria-hidden="true" />
                {thinking.length ? `${thinking.length} agent${thinking.length === 1 ? "" : "s"} still thinking…` : "The moderator is comparing the answers…"}
                {s.usedNotes && <span className="pill border border-line text-ink-soft ml-auto">using your health notes</span>}
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2" aria-label="Specialist answers">
            {active.map((a) => {
              const meta = AGENTS.find((x) => x.id === a.agent)!;
              return (
                <article key={a.agent} className="card p-5 flex flex-col gap-2">
                  <header className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full text-white text-xs font-extrabold flex items-center justify-center" style={{ background: meta.color }}>{meta.short}</span>
                    <h2 className="m-0 text-base font-extrabold">{meta.name} agent</h2>
                  </header>
                  <p className="m-0 text-[15px] leading-relaxed whitespace-pre-line">{a.text}</p>
                </article>
              );
            })}
            {thinking.map((idn) => {
              const meta = AGENTS.find((x) => x.id === idn)!;
              return (
                <article key={idn} className="card p-5 flex flex-col gap-3" aria-busy="true">
                  <header className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full text-white text-xs font-extrabold flex items-center justify-center opacity-60" style={{ background: meta.color }}>{meta.short}</span>
                    <h2 className="m-0 text-base font-extrabold text-ink-soft">{meta.name} agent is reading…</h2>
                  </header>
                  <div className="h-3 rounded bg-lavender-2 animate-pulse w-11/12" />
                  <div className="h-3 rounded bg-lavender-2 animate-pulse w-4/5" />
                </article>
              );
            })}
          </section>

          {quiet.length > 0 && (
            <p className="text-xs text-ink-soft m-0">
              Stood down for this question: {quiet.map((a) => AGENTS.find((x) => x.id === a.agent)!.name).join(", ")}.
            </p>
          )}

          {fu && s.done && (
            s.done.scheduled ? (
              <WillieSays mood="hop" action={<Link href="/sanity-checks" className="btn-ghost text-sm no-underline whitespace-nowrap">Sanity checks</Link>}>
                {WILLIE_SAYS.planned(daysUntil(fu.dueAt))} <span className="text-ink-soft">By {fu.channels.join(" or ")}.</span>
              </WillieSays>
            ) : (
              <WillieSays mood="listen" action={<Link href="/signin?next=/sanity-checks" className="btn-sun text-sm no-underline whitespace-nowrap">Sign in</Link>}>
                {WILLIE_SAYS.plannedSignedOut(daysUntil(fu.dueAt))}
              </WillieSays>
            )
          )}

          {s.consensus && (
            <>
              <section className="card p-5 flex flex-wrap gap-3 items-center bg-lavender">
                <p className="m-0 font-bold flex-1 min-w-[200px]">Want a human to weigh in?</p>
                <Link href="/circle" className="btn-ghost text-sm no-underline">Share with my care circle</Link>
                <Link href={`/community?q=${encodeURIComponent(s.question)}`} className="btn-ghost text-sm no-underline">See what others asked</Link>
              </section>
              <p className="text-xs text-ink-soft">
                Answers are generated by AI agents and are not medical advice. Your question is private and is not used for training.
                {s.usedNotes && " Your health notes were sent with this question and were not stored."}
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}
