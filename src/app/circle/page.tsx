import { CIRCLE, CIRCLE_THREAD } from "@/lib/data";

export default function CirclePage() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-extrabold m-0">Care circle</h1>
          <p className="m-0 text-ink-soft text-sm">One shared thread for the people helping you. Your private chat stays private until you share it.</p>
        </div>
        <div className="card p-4 flex flex-col gap-3">
          {CIRCLE_THREAD.map((m, i) => (
            <div key={i} className={`flex flex-col gap-1 max-w-[85%] ${m.from === "You" ? "self-end items-end" : ""}`}>
              <span className="text-xs text-ink-soft">{m.from} · {m.ago}</span>
              <p
                className={`m-0 text-[15px] leading-relaxed px-4 py-2 rounded-2xl ${
                  m.from === "You" ? "bg-violet text-white" : m.kind === "agent" ? "bg-lavender border border-line" : "bg-lavender-2"
                }`}
              >
                {m.text}
              </p>
            </div>
          ))}
        </div>
        <form className="card p-3 flex gap-2" action="/signin">
          <label htmlFor="msg" className="sr-only">Message your circle</label>
          <input id="msg" placeholder="Message the circle…" className="flex-1 bg-transparent outline-none px-2" />
          <button className="btn-sun text-sm" type="submit">Send</button>
        </form>
      </section>

      <aside className="flex flex-col gap-3">
        <h2 className="text-lg font-extrabold m-0">Members &amp; permissions</h2>
        <div className="card overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-lavender text-xs text-ink-soft">
              <tr><th className="text-left px-3 py-2 font-bold">Member</th><th className="px-2 py-2 font-bold">Logs</th><th className="px-2 py-2 font-bold">Chat</th><th className="px-2 py-2 font-bold">Act</th></tr>
            </thead>
            <tbody>
              {CIRCLE.map((m) => (
                <tr key={m.name} className="border-t border-line">
                  <td className="px-3 py-2">
                    <div className="font-bold">{m.name}</div>
                    <div className="text-xs text-ink-soft">{m.role}{m.kind === "agent" ? " · agent" : ""}</div>
                  </td>
                  <td className="text-center">{m.logs ? "on" : <span className="text-ink-soft">off</span>}</td>
                  <td className="text-center">{m.chat ? "on" : <span className="text-ink-soft">off</span>}</td>
                  <td className="text-center font-bold" style={{ color: m.act === "off" ? undefined : "#0369A1" }}>{m.act === "ask" ? "ask me" : m.act}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn-ghost text-sm">Invite someone</button>
        <p className="text-xs text-ink-soft m-0">Members without the app get a signed email digest scoped to what you allow. Revoke anyone in one tap.</p>
      </aside>
    </div>
  );
}
