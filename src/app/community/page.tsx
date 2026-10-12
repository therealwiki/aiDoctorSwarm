import Link from "next/link";
import { TOPICS, POSTS, FACT } from "@/lib/data";

export default async function Community({ searchParams }: { searchParams?: Promise<{ q?: string }> }) {
  const q = (await searchParams)?.q;
  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <aside className="flex flex-col gap-3">
        <h1 className="text-2xl font-extrabold m-0">Community</h1>
        <p className="text-ink-soft text-sm m-0">Every post carries a swarm fact-check. Browse without an account; posting needs one.</p>
        <ul className="list-none m-0 p-0 flex flex-col gap-1">
          {TOPICS.map((t) => (
            <li key={t.slug}>
              <Link href={`/community/${t.slug}`} className="no-underline flex items-center justify-between px-3 py-2 rounded-xl hover:bg-lavender text-ink">
                <span className="font-bold">{t.name}</span>
                <span className="text-xs text-ink-soft">{t.scope === "local" ? "near you" : t.members.toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className="flex flex-col gap-4">
        {q && (
          <p className="m-0 text-sm text-ink-soft">
            Showing posts related to <span className="font-bold text-ink">“{q}”</span>
          </p>
        )}
        {POSTS.map((p) => {
          const f = FACT[p.factCheck];
          const t = TOPICS.find((x) => x.slug === p.topic)!;
          return (
            <article key={p.id} className="card p-5 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                <Link href={`/community/${t.slug}`} className="font-bold">{t.name}</Link>
                <span>· {p.author} · {p.ago}</span>
                <span className="pill ml-auto" style={{ background: f.bg, color: f.fg }}>{f.label}</span>
              </div>
              <h2 className="m-0 text-lg font-extrabold leading-snug">
                <Link href={`/community/${t.slug}#${p.id}`} className="no-underline text-ink">{p.title}</Link>
              </h2>
              <p className="m-0 text-[15px] text-ink-soft leading-relaxed">{p.body}</p>
              {p.factNote && <p className="m-0 text-sm bg-lavender rounded-xl px-3 py-2">{p.factNote}</p>}
              <div className="text-xs text-ink-soft">{p.replies} replies</div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
