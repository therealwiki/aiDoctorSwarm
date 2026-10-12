import Link from "next/link";
import OutcomeForm from "@/components/OutcomeForm";
import Willie from "@/components/Willie";
import { getSessionUser } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { listSanityChecks, type SanityChecks } from "@/lib/store";
import { daysUntil } from "@/lib/willie";

// Demo content shown when signed out. Real data comes from `tasks` (kind = followup) joined to `asks`.
const DEMO: SanityChecks = {
  due: [{ askId: "ask_demo1", question: "I've had a lump under my arm for two weeks and I'm scared to go in", askedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(), agents: ["primary", "mental"] }],
  upcoming: [{ askId: "ask_demo2", question: "My CRP came back at 4.1 — should I worry?", dueAt: new Date(Date.now() + 18 * 86_400_000).toISOString(), channels: ["email"] }],
  score: { right: 7, partly: 2, wrong: 1 },
};

const daysAgo = (iso: string) => {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : `${d} days ago`;
};

export default async function SanityChecksPage() {
  const [user, db] = await Promise.all([getSessionUser(), getDB()]);
  const live = !!(user && db);
  const data = live ? await listSanityChecks(db, user.id) : DEMO;
  const total = data.score.right + data.score.partly + data.score.wrong;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <section className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-extrabold m-0">Sanity checks</h1>
          <p className="m-0 text-ink-soft text-sm">After every answer, Willie comes back later to sanity-check it against what really happened. What you tell him is how the swarm learns.</p>
        </div>
        {!live && (
          <p className="m-0 text-sm card p-4 bg-lavender">This is a demo. <Link href="/signin?next=/sanity-checks">Sign in</Link> and Willie will track your own questions.</p>
        )}
        {live && data.due.length === 0 && (
          <div className="card p-5 flex items-center gap-3 text-sm">
            <Willie size={48} />
            <span className="text-ink-soft">Nothing to check yet. Ask the swarm something and Willie will come back when it’s time.</span>
          </div>
        )}
        {data.due.map((d) => (
          <div key={d.askId} className="card p-5 flex flex-col gap-3">
            <span className="text-xs text-ink-soft">Asked {daysAgo(d.askedAt)}</span>
            <OutcomeForm askId={d.askId} question={d.question} agents={d.agents} />
          </div>
        ))}
        {data.upcoming.length > 0 && <h2 className="text-lg font-extrabold m-0">Upcoming sanity checks</h2>}
        {data.upcoming.map((u) => (
          <div key={u.askId} className="card p-4 flex items-center gap-3 text-sm">
            <Willie size={40} />
            <div className="flex-1">
              <div className="font-bold">“{u.question}”</div>
              <div className="text-ink-soft text-xs">Sanity check in {daysUntil(u.dueAt)} days by {u.channels.join(" or ")}. <Link href="/agents">Change channels</Link></div>
            </div>
          </div>
        ))}
      </section>
      <aside className="flex flex-col gap-3">
        <div className="card p-4 flex flex-col gap-2">
          <h2 className="text-base font-extrabold m-0">Your swarm&rsquo;s record</h2>
          {total > 0 ? (
            <>
              <div className="flex gap-1 h-3 rounded-full overflow-hidden">
                <span style={{ flex: data.score.right, background: "#059669" }} />
                <span style={{ flex: data.score.partly, background: "#D97706" }} />
                <span style={{ flex: data.score.wrong, background: "#DC2626" }} />
              </div>
              <p className="m-0 text-xs text-ink-soft">{data.score.right} right · {data.score.partly} partly · {data.score.wrong} wrong, by your own reports.{live ? "" : " Demo numbers."}</p>
            </>
          ) : (
            <p className="m-0 text-xs text-ink-soft">No reports yet. The record builds from your own sanity checks.</p>
          )}
        </div>
        <p className="text-xs text-ink-soft m-0">Reports stay private to you. Aggregated, anonymised verdicts are used to grade and retune each agent.</p>
      </aside>
    </div>
  );
}
