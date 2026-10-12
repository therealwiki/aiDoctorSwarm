"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AskBox({ initial = "", big = false }: { initial?: string; big?: boolean }) {
  const [q, setQ] = useState(initial);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = q.trim();
    if (!t) return;
    router.push(`/ask?q=${encodeURIComponent(t)}`);
  }

  return (
    <form onSubmit={submit} className="w-full">
      <label htmlFor="ask" className="sr-only">Ask a health question</label>
      <div
        className={`flex items-center gap-2 card shadow-[0_8px_30px_rgba(30,27,75,0.08)] ${
          big ? "px-5 py-3 rounded-full" : "px-4 py-2 rounded-full"
        }`}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" className="text-ink-soft shrink-0">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <input
          id="ask"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="What's going on? Ask anything, even the embarrassing stuff."
          autoComplete="off"
          className={`flex-1 min-w-0 bg-transparent outline-none ${big ? "text-lg py-2" : "text-base py-1"}`}
        />
        <button type="submit" className="btn-sun text-sm shrink-0">Ask the swarm</button>
      </div>
    </form>
  );
}
