"use client";

// Willie, the coordinator hare. Pure SVG + CSS so he works everywhere (app, email fallback PNG later).
// mood: "idle" (ears twitch), "hop" (bounces once), "listen" (ears up, leans in).

export default function Willie({ size = 72, mood = "idle" }: { size?: number; mood?: "idle" | "hop" | "listen" }) {
  return (
    <span className={`willie willie-${mood}`} style={{ display: "inline-block", width: size, height: size }}>
      <svg viewBox="0 0 80 80" width={size} height={size} role="img" aria-label="Willie the hare">
        {/* ears */}
        <g className="ear ear-l">
          <ellipse cx="29" cy="22" rx="6" ry="17" fill="#C4B5FD" />
          <ellipse cx="29" cy="23" rx="3" ry="12" fill="#FDE047" />
        </g>
        <g className="ear ear-r">
          <ellipse cx="51" cy="22" rx="6" ry="17" fill="#C4B5FD" />
          <ellipse cx="51" cy="23" rx="3" ry="12" fill="#FDE047" />
        </g>
        {/* body + head */}
        <ellipse cx="40" cy="62" rx="20" ry="14" fill="#A78BFA" />
        <circle cx="40" cy="44" r="17" fill="#C4B5FD" />
        {/* cheeks */}
        <circle cx="30" cy="49" r="4" fill="#DDD6FE" />
        <circle cx="50" cy="49" r="4" fill="#DDD6FE" />
        {/* eyes */}
        <g className="eyes">
          <circle cx="34" cy="42" r="2.6" fill="#1E1B4B" />
          <circle cx="46" cy="42" r="2.6" fill="#1E1B4B" />
          <circle cx="35" cy="41" r="0.8" fill="#fff" />
          <circle cx="47" cy="41" r="0.8" fill="#fff" />
        </g>
        {/* nose + mouth */}
        <path d="M38 48 h4 l-2 2.5z" fill="#6D28D9" />
        <path d="M40 50.5 q-2 3 -4 1 M40 50.5 q2 3 4 1" stroke="#6D28D9" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        {/* whiskers */}
        <g stroke="#6D28D9" strokeWidth="0.9" strokeLinecap="round" opacity="0.7">
          <line x1="26" y1="47" x2="18" y2="45" /><line x1="26" y1="50" x2="18" y2="51" />
          <line x1="54" y1="47" x2="62" y2="45" /><line x1="54" y1="50" x2="62" y2="51" />
        </g>
        {/* satchel: he carries messages */}
        <rect x="46" y="58" width="12" height="9" rx="2" fill="#1E1B4B" />
        <rect x="46" y="58" width="12" height="3" rx="1.5" fill="#FDE047" />
        {/* feet */}
        <ellipse cx="30" cy="75" rx="7" ry="3" fill="#A78BFA" />
        <ellipse cx="50" cy="75" rx="7" ry="3" fill="#A78BFA" />
      </svg>
      <style>{`
        .willie svg { overflow: visible; transform-origin: 50% 100%; }
        .willie .ear { transform-origin: 50% 90%; transform-box: fill-box; }
        .willie-idle .ear-l { animation: willie-twitch 4s ease-in-out infinite; }
        .willie-idle .ear-r { animation: willie-twitch 4s ease-in-out 2.1s infinite; }
        .willie-idle svg { animation: willie-breathe 3s ease-in-out infinite; }
        .willie-hop svg { animation: willie-hop 0.9s cubic-bezier(.3,1.4,.5,1) 1; }
        .willie-listen .ear { transform: rotate(0deg) scaleY(1.08); }
        .willie-listen svg { transform: rotate(-4deg); }
        .willie .eyes { animation: willie-blink 5s steps(1) infinite; }
        @keyframes willie-twitch { 0%,88%,100% { transform: rotate(0); } 92% { transform: rotate(-12deg); } 96% { transform: rotate(6deg); } }
        @keyframes willie-breathe { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.025); } }
        @keyframes willie-hop { 0% { transform: translateY(0); } 35% { transform: translateY(-14px) scaleY(1.05); } 70% { transform: translateY(0) scaleY(0.94); } 100% { transform: translateY(0); } }
        @keyframes willie-blink { 0%,96%,100% { transform: scaleY(1); } 97%,99% { transform: scaleY(0.1); } }
        .willie .eyes { transform-origin: 40px 42px; }
        @media (prefers-reduced-motion: reduce) { .willie * { animation: none !important; } }
      `}</style>
    </span>
  );
}

/** Willie speaking: a small card with the hare and a line of text. */
export function WillieSays({ children, mood = "idle", action }: { children: React.ReactNode; mood?: "idle" | "hop" | "listen"; action?: React.ReactNode }) {
  return (
    <div className="card p-4 flex items-center gap-4 bg-lavender">
      <Willie size={64} mood={mood} />
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="text-xs font-extrabold text-ink-soft uppercase tracking-wide">Willie · coordinator</span>
        <p className="m-0 text-[15px] leading-snug">{children}</p>
      </div>
      {action}
    </div>
  );
}
