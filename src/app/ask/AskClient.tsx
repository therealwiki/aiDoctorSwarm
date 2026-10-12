"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AskBox from "@/components/AskBox";
import { AGENTS, type SwarmResult } from "@/lib/agents";
import { WillieSays } from "@/components/Willie";
import { WILLIE_SAYS, type Task } from "@/lib/willie";

type AskResponse = SwarmResult & { askId: string; plan: Task[] };

const URGENCY: Record<string, { label: string; bg: string; fg: string }> = {
  emergency: { label: "Call emergency services now", bg: "#FEE2E2", fg: "#991B1B" },
  today: { label: "See someone today", bg: "#FEF3C7", fg: "#92400E" },
  "this-week": { label: "Book a visit this week", bg: "#E0F2FE", fg: "#0C4A6E" },
  routine: { label: "Routine visit", bg: "#EDE9FE", fg: "#4C1D95" },
  none: { label: "No visit needed from this alone", bg: "#D1FAE5", fg: "#065F46" },
};

export default function AskClient() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [res, setRes] = useState<AskResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q) return;
    let alive = true;
    setRes(null);
    setErr(null);
    setLoading(true);
    fetch("/api/ask", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q }) })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Failed");
        return j as AskResponse;
      })
      .then((j) => alive && setRes(j))
      .catch((e) => alive && setErr(e.message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [q]);

  const active = res?.answers.filter((a) => !a.standsDown) ?? [];
  const quiet = res?.answers.filter((a) => a.standsDown) ?? [];
  const u = res ? URGENCY[res.consensus.urgency] ?? URGENCY.none : null;

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <AskBox initial={q} />

      {loading && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="text-ink-soft text-sm">The swarm is reading your question…</p>
          {AGENTS.slice(0, 3).map((a) => (
            <div key={a.id} className="card p-5 animate-pulse h-24" />
          ))}
        </div>
      )}

      {err && (
        <div className="card p-5 border-red-300">
          <p className="font-bold">Something went wrong.</p>
          <p className="text-ink-soft text-sm">{err}</p>
        </div>
      )}

      {res && u && (
        <>
          <section className="card p-5 flex flex-col gap-3" aria-label="Summary">
            <div className="flex flex-wrap items-center gap-2">
              <span className="pill" style={{ background: u.bg, color: u.fg }}>{u.label}</span>
              <span className="pill bg-lavender-2 text-ink">
                {res.consensus.agree ? `${active.length} agents agree` : "Agents differ"}
              </span>
              {res.mocked && <span className="pill border border-line text-ink-soft">demo answers</span>}
            </div>
            <p className="text-lg font-bold leading-snug m-0">{res.consensus.summary}</p>
            {res.consensus.nextStep && (
              <div className="flex flex-wrap items-center gap-3">
                <p className="m-0 text-ink-soft">{res.consensus.nextStep}</p>
                <Link href={`/agents?task=schedule&q=${encodeURIComponent(q)}`} className="btn-sun text-sm no-underline ml-auto">
                  Ask an agent to book it
                </Link>
              </div>
            )}
          </section>

          <section className="grid gap-4 sm:grid-cols-2" aria-label="Specialist answers">
            {active.map((a) => {
              const meta = AGENTS.find((x) => x.id === a.agent)!;
              return (
                <article key={a.agent} className="card p-5 flex flex-col gap-2">
                  <header className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full text-white text-xs font-extrabold flex items-center justify-center" style={{ background: meta.color }}>
                      {meta.short}
                    </span>
                    <h2 className="m-0 text-base font-extrabold">{meta.name} agent</h2>
                  </header>
                  <p className="m-0 text-[15px] leading-relaxed whitespace-pre-line">{a.text}</p>
                </article>
              );
            })}
          </section>

          {quiet.length > 0 && (
            <p className="text-xs text-ink-soft m-0">
              Stood down for this question: {quiet.map((a) => AGENTS.find((x) => x.id === a.agent)!.name).join(", ")}.
            </p>
          )}

          {(() => {
            const fu = res.plan?.find((t) => t.kind === "followup");
            if (!fu) return null;
            const days = Math.max(1, Math.round((new Date(fu.dueAt).getTime() - Date.now()) / 86400000));
            return (
              <WillieSays
                mood="hop"
                action={<Link href="/sanity-checks" className="btn-ghost text-sm no-underline whitespace-nowrap">Sanity checks</Link>}
              >
                {WILLIE_SAYS.planned(days)} <span className="text-ink-soft">By {fu.channels.join(" or ")}.</span>
              </WillieSays>
            );
          })()}

          <section className="card p-5 flex flex-wrap gap-3 items-center bg-lavender">
            <p className="m-0 font-bold flex-1 min-w-[200px]">Want a human to weigh in?</p>
            <Link href="/circle" className="btn-ghost text-sm no-underline">Share with my care circle</Link>
            <Link href={`/community?q=${encodeURIComponent(q)}`} className="btn-ghost text-sm no-underline">See what others asked</Link>
          </section>

          <p className="text-xs text-ink-soft">
            Answers are generated by AI agents and are not medical advice. Your question is private and is not used for training.
          </p>
        </>
      )}
    </div>
  );
}
