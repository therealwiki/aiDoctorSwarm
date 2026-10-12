"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "./Logo";

const nav = [
  { href: "/", label: "Ask" },
  { href: "/me", label: "My health" },
  { href: "/circle", label: "Care circle" },
  { href: "/community", label: "Community" },
  { href: "/atlas", label: "Atlas" },
  { href: "/sanity-checks", label: "Sanity checks" },
  { href: "/agents", label: "Agents" },
];

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const home = path === "/";

  if (home) return <>{children}</>;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-[var(--bg)]/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-extrabold no-underline text-ink">
            <Logo size={28} />
            <span className="hidden sm:inline">AI Doctor Swarm</span>
          </Link>
          <nav aria-label="Primary" className="ml-auto flex gap-1 overflow-x-auto">
            {nav.map((n) => {
              const active = n.href === "/" ? false : path.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`no-underline text-sm font-bold px-3 py-2 rounded-full whitespace-nowrap ${
                    active ? "bg-lavender-2 text-ink" : "text-ink-soft hover:bg-lavender"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
      <footer className="border-t border-line text-xs text-ink-soft">
        <div className="mx-auto max-w-6xl px-4 py-4 flex flex-wrap gap-x-6 gap-y-1">
          <span>Not a substitute for emergency care. In danger? Call your local emergency number.</span>
          <a href="mailto:hello@aidoctorswarm.com">hello@aidoctorswarm.com</a>
        </div>
      </footer>
    </div>
  );
}
