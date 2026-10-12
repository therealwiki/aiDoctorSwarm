import { APPROVALS, TASK_TYPES } from "@/lib/data";
import { AGENTS } from "@/lib/agents";
import Willie from "@/components/Willie";

export default async function AgentsPage({ searchParams }: { searchParams?: Promise<{ task?: string; q?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-extrabold m-0">Agents</h1>
          <p className="m-0 text-ink-soft text-sm">Nothing happens without your say unless you set a task to Auto. Approvals also arrive by email so you can decide from your inbox.</p>
        </div>

        {sp?.task === "schedule" && (
          <div className="card p-4 bg-lavender flex flex-col gap-1">
            <p className="m-0 font-bold">Scheduling agent is drafting a booking request</p>
            <p className="m-0 text-sm text-ink-soft">From your question: “{sp.q}”. You’ll see it below and by email at your address once accounts are live.</p>
          </div>
        )}

        <h2 className="text-lg font-extrabold m-0">Inbox</h2>
        <ul className="list-none m-0 p-0 flex flex-col gap-3">
          {APPROVALS.map((a) => (
            <li key={a.id} className="card p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <span className="font-bold text-ink">{a.agent}</span><span>· {a.ago}</span>
                <span className={`pill ml-auto ${a.status === "pending" ? "bg-sun text-ink" : "bg-lavender-2 text-ink-soft"}`}>{a.status}</span>
              </div>
              <h3 className="m-0 text-base font-extrabold">{a.title}</h3>
              <p className="m-0 text-sm text-ink-soft">{a.detail}</p>
              {a.status === "pending" && (
                <form className="flex gap-2 mt-1" action="/api/approvals" method="post">
                  <input type="hidden" name="id" value={a.id} />
                  <button name="decision" value="approve" className="btn-sun text-sm">Approve</button>
                  <button name="decision" value="decline" className="btn-ghost text-sm">Decline</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="card p-4 flex flex-col gap-3">
          <h2 className="text-lg font-extrabold m-0">Permissions</h2>
          {TASK_TYPES.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-3 text-sm">
              <span>{t.label}</span>
              <span className="inline-flex rounded-full border border-line overflow-hidden text-xs font-bold">
                {(["off", "ask", "auto"] as const).map((m) => (
                  <span key={m} className={`px-2 py-1 ${t.mode === m ? "bg-ink text-white" : "text-ink-soft"}`}>{m === "ask" ? "ask me" : m}</span>
                ))}
              </span>
            </div>
          ))}
        </div>
        <div className="card p-4 flex gap-3 items-start">
          <Willie size={72} mood="listen" />
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold m-0">Willie</h2>
            <p className="m-0 text-sm text-ink-soft">The coordinator hare. Not a doctor — he carries tasks between the swarm, your calendar, inbox and phone, and hops back later for a sanity check on whether the swarm was right.</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {[["app", true], ["email", true], ["sms", false], ["calendar", false], ["circle", true]].map(([c, on]) => (
                <span key={String(c)} className={`pill ${on ? "bg-lavender-2 text-ink" : "border border-line text-ink-soft"}`}>{String(c)}{on ? "" : " · link"}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="card p-4 flex flex-col gap-2">
          <h2 className="text-lg font-extrabold m-0">The swarm</h2>
          {AGENTS.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-sm">
              <span className="w-7 h-7 rounded-full text-white text-[10px] font-extrabold flex items-center justify-center" style={{ background: a.color }}>{a.short}</span>
              <span className="font-bold">{a.name}</span>
            </div>
          ))}
          <p className="text-xs text-ink-soft m-0">Agents that aren’t relevant to a question stand down instead of padding the answer.</p>
        </div>
      </aside>
    </div>
  );
}
