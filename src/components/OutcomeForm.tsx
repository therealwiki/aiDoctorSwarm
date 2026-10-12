"use client";

import { useState } from "react";
import { WillieSays } from "./Willie";
import { WILLIE_SAYS, type Outcome } from "@/lib/willie";
import { AGENTS } from "@/lib/agents";

const VERDICTS: { v: Outcome["verdict"]; label: string; bg: string; fg: string }[] = [
  { v: "right", label: "Yes, they were right", bg: "#D1FAE5", fg: "#065F46" },
  { v: "partly", label: "Partly", bg: "#FEF3C7", fg: "#92400E" },
  { v: "wrong", label: "No, they were wrong", bg: "#FEE2E2", fg: "#991B1B" },
  { v: "unknown", label: "Don't know yet", bg: "#EDE9FE", fg: "#4C1D95" },
];

export default function OutcomeForm({ askId, question, agents }: { askId: string; question: string; agents: string[] }) {
  const [verdict, setVerdict] = useState<Outcome["verdict"] | null>(null);
  const [what, setWhat] = useState("");
  const [saw, setSaw] = useState(false);
  const [per, setPer] = useState<Record<string, "right" | "wrong">>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!verdict) return;
    setBusy(true);
    await fetch("/api/outcomes", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ askId, verdict, whatHappened: what, sawClinician: saw, agentVerdicts: per }),
    });
    setBusy(false);
    setDone(true);
  }

  if (done) return <WillieSays mood="hop">{WILLIE_SAYS.thanks}</WillieSays>;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <WillieSays mood="listen">
        {WILLIE_SAYS.followup} <span className="text-ink-soft">You asked: “{question}”</span>
      </WillieSays>

      <fieldset className="border-0 m-0 p-0 flex flex-wrap gap-2">
        <legend className="sr-only">Sanity check: was the swarm right?</legend>
        {VERDICTS.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => setVerdict(o.v)}
            aria-pressed={verdict === o.v}
            className="pill text-sm px-4 py-2 border-2"
            style={{ background: o.bg, color: o.fg, borderColor: verdict === o.v ? o.fg : "transparent" }}
          >
            {o.label}
          </button>
        ))}
      </fieldset>

      {verdict && verdict !== "unknown" && (
        <>
          <label className="flex flex-col gap-1 text-sm font-bold">
            What actually happened?
            <textarea
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              rows={3}
              placeholder="e.g. It was a cyst — drained in clinic, all fine. / CRP was back to 1.9 at the recheck."
              className="card p-3 font-normal text-[15px] resize-none bg-transparent"
            />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={saw} onChange={(e) => setSaw(e.target.checked)} className="w-4 h-4" />
            I saw a clinician about this
          </label>
          {agents.length > 1 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-bold">Optional: who got it right?</span>
              <div className="flex flex-wrap gap-2">
                {agents.map((id) => {
                  const a = AGENTS.find((x) => x.id === id)!;
                  const v = per[id];
                  return (
                    <span key={id} className="inline-flex items-center gap-1 border border-line rounded-full pl-1 pr-2 py-1 text-xs">
                      <span className="w-6 h-6 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center" style={{ background: a.color }}>{a.short}</span>
                      <button type="button" aria-pressed={v === "right"} onClick={() => setPer({ ...per, [id]: "right" })} className={`px-2 py-0.5 rounded-full font-bold ${v === "right" ? "bg-ink text-white" : "text-ink-soft"}`}>right</button>
                      <button type="button" aria-pressed={v === "wrong"} onClick={() => setPer({ ...per, [id]: "wrong" })} className={`px-2 py-0.5 rounded-full font-bold ${v === "wrong" ? "bg-ink text-white" : "text-ink-soft"}`}>wrong</button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={!verdict || busy} className="btn-sun text-sm disabled:opacity-50">Send to the swarm</button>
        <span className="text-xs text-ink-soft self-center">Only you and the swarm see this. It is never shown to other patients.</span>
      </div>
    </form>
  );
}
