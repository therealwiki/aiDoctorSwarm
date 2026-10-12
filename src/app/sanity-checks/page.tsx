import Link from "next/link";
import OutcomeForm from "@/components/OutcomeForm";
import Willie from "@/components/Willie";

// Seed: asks whose sanity check is due. Real version reads `tasks` (kind = followup) joined to `asks` from D1.
const DUE = [
  { askId: "ask_demo1", question: "I've had a lump under my arm for two weeks and I'm scared to go in", askedAgo: "10 days ago", agents: ["primary", "mental"] },
];
const UPCOMING = [
  { askId: "ask_demo2", question: "My CRP came back at 4.1 — should I worry?", dueIn: "18 days", channel: "email" },
];
const SCORE = { right: 7, partly: 2, wrong: 1 };

export default function SanityChecksPage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-extrabold m-0">Sanity checks</h1>
          <p className="m-0 text-ink-soft text-sm">After every answer, Willie comes back later to sanity-check it against what really happened. What you tell him is how the swarm learns.</p>
        </div>
        {DUE.map((d) => (
          <div key={d.askId} className="card p-5 flex flex-col gap-3">
            <span className="text-xs text-ink-soft">Asked {d.askedAgo}</span>
            <OutcomeForm askId={d.askId} question={d.question} agents={d.agents} />
          </div>
        ))}
        <h2 className="text-lg font-extrabold m-0">Upcoming sanity checks</h2>
        {UPCOMING.map((u) => (
          <div key={u.askId} className="card p-4 flex items-center gap-3 text-sm">
            <Willie size={40} />
            <div className="flex-1">
              <div className="font-bold">“{u.question}”</div>
              <div className="text-ink-soft text-xs">Sanity check in {u.dueIn} by {u.channel}. <Link href="/agents">Change channels</Link></div>
            </div>
          </div>
        ))}
      </section>
      <aside className="flex flex-col gap-3">
        <div className="card p-4 flex flex-col gap-2">
          <h2 className="text-base font-extrabold m-0">Your swarm&rsquo;s record</h2>
          <div className="flex gap-1 h-3 rounded-full overflow-hidden">
            <span style={{ flex: SCORE.right, background: "#059669" }} />
            <span style={{ flex: SCORE.partly, background: "#D97706" }} />
            <span style={{ flex: SCORE.wrong, background: "#DC2626" }} />
          </div>
          <p className="m-0 text-xs text-ink-soft">{SCORE.right} right · {SCORE.partly} partly · {SCORE.wrong} wrong, by your own reports. Demo numbers.</p>
        </div>
        <p className="text-xs text-ink-soft m-0">Reports stay private to you. Aggregated, anonymised verdicts are used to grade and retune each agent.</p>
      </aside>
    </div>
  );
}
