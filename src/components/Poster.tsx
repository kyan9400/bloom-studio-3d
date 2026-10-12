/*
  Designed fallback for the 3D stage: shown on the server render (LCP-safe, no image request),
  while the 3D warms up, and permanently when WebGL is missing or the context is lost.
  It follows the chosen shade through the --shade CSS custom property.
*/

const ALMOND = "M-30 0 C-35 -42 -33 -86 0 -132 C33 -86 35 -42 30 0 Q0 11 -30 0 Z";
const FAN = [-34, -16, 2, 20, 38];

export default function Poster() {
  return (
    <svg className="poster" viewBox="0 0 600 600" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="pg-halo" cx="50%" cy="46%" r="52%">
          <stop offset="0" stopColor="#fff8f3" />
          <stop offset="0.6" stopColor="#f4e2dc" />
          <stop offset="1" stopColor="#f4e2dc" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pg-polish" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" style={{ stopColor: "var(--shade)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--shade)" }} stopOpacity="0.85" />
          <stop offset="1" style={{ stopColor: "var(--shade)" }} />
        </linearGradient>
        <linearGradient id="pg-film" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#ffd1e8" stopOpacity="0.55" />
          <stop offset="0.35" stopColor="#c9b6ff" stopOpacity="0.2" />
          <stop offset="0.65" stopColor="#9fe6dc" stopOpacity="0.35" />
          <stop offset="1" stopColor="#ffe3a8" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id="pg-cap" x1="0" x2="1">
          <stop offset="0" stopColor="#3a2840" />
          <stop offset="0.3" stopColor="#1d1220" />
          <stop offset="0.75" stopColor="#120a14" />
          <stop offset="1" stopColor="#2c1d31" />
        </linearGradient>
        <radialGradient id="pg-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#3a1f35" stopOpacity="0.35" />
          <stop offset="1" stopColor="#3a1f35" stopOpacity="0" />
        </radialGradient>
      </defs>

      <circle cx="300" cy="300" r="290" fill="url(#pg-halo)" />
      <ellipse cx="300" cy="540" rx="250" ry="34" fill="url(#pg-shadow)" />

      {/* bottle */}
      <g>
        <path
          d="M168 516 Q168 542 194 542 L286 542 Q312 542 312 516 L312 336 Q312 292 262 284 L262 250 L218 250 L218 284 Q168 292 168 336 Z"
          fill="#ffffff"
          fillOpacity="0.35"
          stroke="#2a1b2d"
          strokeOpacity="0.18"
          strokeWidth="2"
        />
        <path
          d="M180 512 Q180 530 198 530 L282 530 Q300 530 300 512 L300 342 Q300 306 262 300 L218 300 Q180 306 180 342 Z"
          fill="url(#pg-polish)"
        />
        <path
          d="M180 512 Q180 530 198 530 L282 530 Q300 530 300 512 L300 342 Q300 306 262 300 L218 300 Q180 306 180 342 Z"
          fill="url(#pg-film)"
        />
        <rect x="190" y="330" width="12" height="170" rx="6" fill="#ffffff" fillOpacity="0.55" />
        <rect x="282" y="350" width="5" height="120" rx="2.5" fill="#ffffff" fillOpacity="0.35" />
        {/* the cap lifts in the uncapped state (.stage[data-uncap]), like the 3D scroll moment */}
        <g className="poster-cap">
          <rect x="211" y="118" width="58" height="140" rx="16" fill="url(#pg-cap)" />
          <rect x="222" y="132" width="7" height="110" rx="3.5" fill="#ffffff" fillOpacity="0.22" />
        </g>
      </g>

      {/* swatch fan */}
      <g transform="translate(418 506)">
        {FAN.map((deg, i) => (
          <g key={deg} transform={`rotate(${deg}) translate(0 -26)`}>
            <path d={ALMOND} style={{ fill: "var(--shade)" }} />
            <path d={ALMOND} fill={i < 2 ? "#ffffff" : "#1a0d1a"} fillOpacity={[0.32, 0.16, 0, 0.18, 0.34][i]} />
            <path d={ALMOND} fill="url(#pg-film)" />
            <path d="M-14 -20 C-17 -50 -14 -80 -2 -108" stroke="#ffffff" strokeOpacity="0.5" strokeWidth="4" fill="none" strokeLinecap="round" />
          </g>
        ))}
        <circle r="9" fill="#1d1220" />
        <circle r="3.5" fill="#f4e4de" />
      </g>
    </svg>
  );
}
