import Link from "next/link";
import AskBox from "@/components/AskBox";
import Logo from "@/components/Logo";

const examples = [
  "My CRP came back at 4.1 — should I worry?",
  "I've had a lump under my arm for two weeks and I'm scared to go in",
  "What does an immune-aging panel actually measure?",
];

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="flex items-center justify-end gap-3 px-5 py-4 text-sm font-bold">
        <Link href="/community" className="no-underline text-ink-soft hover:text-ink">Community</Link>
        <Link href="/agents" className="no-underline text-ink-soft hover:text-ink">Agents</Link>
        <Link href="/signin" className="btn-ghost text-sm no-underline">Sign in</Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-24">
        <div className="w-full max-w-2xl flex flex-col items-center gap-7 text-center">
          <Logo size={88} glow />
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">Ask the swarm.</h1>
            <p className="text-ink-soft text-lg">
              Several specialist AI agents answer at once. No judgment, no waiting room.
            </p>
          </div>
          <AskBox big />
          <ul className="flex flex-wrap justify-center gap-2 m-0 p-0 list-none">
            {examples.map((e) => (
              <li key={e}>
                <Link
                  href={`/ask?q=${encodeURIComponent(e)}`}
                  className="no-underline inline-block text-sm text-ink-soft border border-line rounded-full px-4 py-2 hover:bg-lavender"
                >
                  {e}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>

      <footer className="px-5 py-4 text-xs text-ink-soft flex flex-wrap gap-x-5 gap-y-1 justify-center">
        <span>Private by default. Your questions are never sold or used to train anything.</span>
        <Link href="/privacy">Privacy</Link>
        <span>Not for emergencies — call your local emergency number.</span>
      </footer>
    </div>
  );
}
