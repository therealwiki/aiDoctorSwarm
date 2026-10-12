import Link from "next/link";
import { APPROVALS, TASK_TYPES } from "@/lib/data";
import { AGENTS } from "@/lib/agents";
import Willie from "@/components/Willie";
import { getSessionUser } from "@/lib/auth";
import { getDB } from "@/lib/db";
import { agentLabel, listApprovals, loadContact, loadPermissions } from "@/lib/store";
import { DEFAULT_PERMISSIONS, type PermissionMode } from "@/lib/willie";

type Item = { id: string; agent: string; title: string; detail: string; when: string; status: string };

function ago(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export default async function AgentsPage({ searchParams }: { searchParams?: Promise<{ task?: string; q?: string; decided?: string; error?: string }> }) {
  const sp = (await searchParams) ?? {};
  const [user, db] = await Promise.all([getSessionUser(), getDB()]);
  const live = !!(user && db);

  let items: Item[];
  let perms: Record<string, PermissionMode> = DEFAULT_PERMISSIONS;
  let channels: [string, boolean][] = [["app", true], ["email", true], ["sms", false], ["calendar", false], ["circle", true]];

  if (live) {
    const [rows, p, contact] = await Promise.all([listApprovals(db, user.id), loadPermissions(db, user.id), loadContact(db, user.id, user.email)]);
    items = rows.map((r) => ({ id: r.id, agent: agentLabel(r.agentKey), title: r.title, detail: r.detail ?? "", when: ago(r.createdAt), status: r.status }));
    perms = p;
    channels = [["app", true], ["email", !!contact.email], ["sms", !!contact.sms], ["calendar", false], ["circle", true]];
  } else {
    items = APPROVALS.map((a) => ({ id: a.id, agent: a.agent, title: a.title, detail: a.detail, when: a.ago, status: a.status }));
  }

  const decided = sp.decided?.split(":")[1];

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-extrabold m-0">Agents</h1>
          <p className="m-0 text-ink-soft text-sm">Nothing happens without your say unless you set a task to Auto. Approvals also arrive by email so you can decide from your inbox.</p>
        </div>

        {!live && (
          <div className="card p-4 bg-lavender flex flex-wrap items-center gap-3 text-sm">
            <span className="flex-1 min-w-[200px]">This is a demo inbox. <Link href="/signin?next=/agents">Sign in</Link> to see your own approvals and set permissions.</span>
          </div>
        )}
        {decided && (
          <p className="m-0 text-sm card p-3" role="status">
            {decided === "approved" ? "Approved. Willie will get it moving." : decided === "declined" ? "Declined. Nothing will happen." : decided === "expired" ? "That request had already expired." : "Already decided."}
          </p>
        )}
        {sp.error && <p className="m-0 text-sm text-red-700" role="alert">That didn’t work: {sp.error === "notfound" ? "we couldn’t find that request." : sp.error === "link" ? "that link isn’t valid." : "please try again."}</p>}

        {sp.task === "schedule" && (
          <div className="card p-4 bg-lavender flex flex-col gap-1">
            <p className="m-0 font-bold">Scheduling agent is drafting a booking request</p>
            <p className="m-0 text-sm text-ink-soft">From your question: “{sp.q}”. {live ? "It appears below and in your email once the swarm’s answer calls for a visit." : "Sign in and it will appear below and in your email."}</p>
          </div>
        )}

        <h2 className="text-lg font-extrabold m-0">Inbox</h2>
        {items.length === 0 && <p className="m-0 text-sm text-ink-soft">Nothing waiting. When the swarm’s answer calls for a visit, the scheduling agent asks here first.</p>}
        <ul className="list-none m-0 p-0 flex flex-col gap-3">
          {items.map((a) => (
            <li key={a.id} className="card p-5 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-xs text-ink-soft">
                <span className="font-bold text-ink">{a.agent}</span><span>· {a.when}</span>
                <span className={`pill ml-auto ${a.status === "pending" ? "bg-sun text-ink" : "bg-lavender-2 text-ink-soft"}`}>{a.status}</span>
              </div>
              <h3 className="m-0 text-base font-extrabold">{a.title}</h3>
              {a.detail && <p className="m-0 text-sm text-ink-soft">{a.detail}</p>}
              {a.status === "pending" && (
                <form className="flex gap-2 mt-1" action="/api/approvals" method="post">
                  <input type="hidden" name="id" value={a.id} />
                  <button name="decision" value="approve" className="btn-sun text-sm" disabled={!live}>Approve</button>
                  <button name="decision" value="decline" className="btn-ghost text-sm" disabled={!live}>Decline</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <aside className="flex flex-col gap-4">
        <div className="card p-4 flex flex-col gap-3">
          <h2 className="text-lg font-extrabold m-0">Permissions</h2>
          {TASK_TYPES.map((t) => {
            const mode = perms[t.key] ?? t.mode;
            return (
              <div key={t.key} className="flex items-center justify-between gap-3 text-sm">
                <span>{t.label}</span>
                {live ? (
                  <form action="/api/permissions" method="post" className="inline-flex rounded-full border border-line overflow-hidden text-xs font-bold">
                    <input type="hidden" name="task_key" value={t.key} />
                    {(["off", "ask", "auto"] as const).map((m) => (
                      <button key={m} name="mode" value={m} aria-pressed={mode === m} className={`px-2 py-1 ${mode === m ? "bg-ink text-white" : "text-ink-soft hover:bg-lavender"}`}>
                        {m === "ask" ? "ask me" : m}
                      </button>
                    ))}
                  </form>
                ) : (
                  <span className="inline-flex rounded-full border border-line overflow-hidden text-xs font-bold">
                    {(["off", "ask", "auto"] as const).map((m) => (
                      <span key={m} className={`px-2 py-1 ${mode === m ? "bg-ink text-white" : "text-ink-soft"}`}>{m === "ask" ? "ask me" : m}</span>
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
        <div className="card p-4 flex gap-3 items-start">
          <Willie size={72} mood="listen" />
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-extrabold m-0">Willie</h2>
            <p className="m-0 text-sm text-ink-soft">The coordinator hare. Not a doctor — he carries tasks between the swarm, your calendar, inbox and phone, and hops back later for a sanity check on whether the swarm was right.</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {channels.map(([c, on]) => (
                <span key={c} className={`pill ${on ? "bg-lavender-2 text-ink" : "border border-line text-ink-soft"}`}>{c}{on ? "" : " · link"}</span>
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
