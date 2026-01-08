// KryptCash Logo Component - Shared across the app
export function KryptCashLogo({ size = 44 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="rounded-xl"
    >
      {/* Background */}
      <rect width="100" height="100" rx="16" fill="#0d1117" />
      
      {/* Center hexagon */}
      <path
        d="M50 25L68 37V63L50 75L32 63V37L50 25Z"
        stroke="white"
        strokeWidth="2.5"
        fill="none"
      />
      
      {/* Top left hexagon (gray) */}
      <path
        d="M35 20L45 26V38L35 44L25 38V26L35 20Z"
        stroke="#4a5568"
        strokeWidth="2"
        fill="none"
      />
      
      {/* Bottom left hexagon (gray) */}
      <path
        d="M35 56L45 62V74L35 80L25 74V62L35 56Z"
        stroke="#4a5568"
        strokeWidth="2"
        fill="none"
      />
      
      {/* Green accent node (top right) */}
      <circle cx="68" cy="30" r="6" fill="#00ff88" />
      
      {/* Blue accent node (bottom right) */}
      <circle cx="68" cy="70" r="6" fill="#00b4d8" />
      
      {/* Connection lines */}
      <line x1="50" y1="25" x2="68" y2="30" stroke="#00ff88" strokeWidth="1.5" opacity="0.6" />
      <line x1="50" y1="75" x2="68" y2="70" stroke="#00b4d8" strokeWidth="1.5" opacity="0.6" />
    </svg>
  );
}

