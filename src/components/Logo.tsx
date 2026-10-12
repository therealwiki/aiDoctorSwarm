export default function Logo({ size = 32, glow = false }: { size?: number; glow?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" role="img" aria-label="AI Doctor Swarm">
      {glow && (
        <>
          <defs>
            <radialGradient id="ads-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#FDE047" stopOpacity="0.9" />
              <stop offset="1" stopColor="#6D28D9" stopOpacity="0" />
            </radialGradient>
          </defs>
          <circle cx="18" cy="18" r="18" fill="url(#ads-glow)" />
        </>
      )}
      <circle cx="18" cy="18" r="12" fill="#C4B5FD" />
      <g fill="#F5F3FF">
        <rect x="10" y="10" width="4" height="4" />
        <rect x="16" y="10" width="4" height="4" />
        <rect x="22" y="10" width="4" height="4" />
        <rect x="7" y="16" width="4" height="4" />
        <rect x="13" y="16" width="4" height="4" fill="#FDE047" />
        <rect x="19" y="16" width="4" height="4" />
        <rect x="25" y="16" width="4" height="4" />
        <rect x="10" y="22" width="4" height="4" />
        <rect x="16" y="22" width="4" height="4" fill="#7DD3FC" />
        <rect x="22" y="22" width="4" height="4" />
      </g>
      <g stroke="#FDE047" strokeWidth="1.5" strokeLinecap="round">
        <line x1="18" y1="2" x2="18" y2="5" />
        <line x1="31" y1="7" x2="29" y2="9" />
        <line x1="5" y1="7" x2="7" y2="9" />
      </g>
    </svg>
  );
}
