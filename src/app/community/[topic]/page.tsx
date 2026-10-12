import Link from "next/link";
import { notFound } from "next/navigation";
import { TOPICS, POSTS, FACT } from "@/lib/data";

export default async function TopicPage({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  const t = TOPICS.find((x) => x.slug === topic);
  if (!t) notFound();
  const posts = POSTS.filter((p) => p.topic === topic);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex flex-col gap-1">
        <Link href="/community" className="text-sm no-underline">← All topics</Link>
        <h1 className="text-3xl font-extrabold m-0">{t.name}</h1>
        <p className="m-0 text-ink-soft">{t.blurb} · {t.members.toLocaleString()} members · {t.scope}</p>
      </div>

      <form className="card p-4 flex flex-col gap-2" action="/signin">
        <label htmlFor="newpost" className="text-sm font-bold">Ask this community</label>
        <textarea id="newpost" rows={2} placeholder="What's on your mind? The swarm will fact-check replies, not you." className="bg-transparent outline-none resize-none text-[15px]" />
        <div className="flex justify-end">
          <button className="btn-sun text-sm" type="submit">Sign in to post</button>
        </div>
      </form>

      {posts.length === 0 && <p className="text-ink-soft">No posts yet. Be the first.</p>}
      {posts.map((p) => {
        const f = FACT[p.factCheck];
        return (
          <article key={p.id} id={p.id} className="card p-5 flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              <span>{p.author} · {p.ago}</span>
              <span className="pill ml-auto" style={{ background: f.bg, color: f.fg }}>{f.label}</span>
            </div>
            <h2 className="m-0 text-lg font-extrabold leading-snug">{p.title}</h2>
            <p className="m-0 text-[15px] text-ink-soft leading-relaxed">{p.body}</p>
            {p.factNote && <p className="m-0 text-sm bg-lavender rounded-xl px-3 py-2">{p.factNote}</p>}
            <div className="text-xs text-ink-soft">{p.replies} replies</div>
          </article>
        );
      })}
    </div>
  );
}
