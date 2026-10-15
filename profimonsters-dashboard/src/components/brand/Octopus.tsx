'use client';
import { useEffect, useId, useRef } from 'react';

/**
 * Маскот Profimonsters — фиолетовый осьминог.
 * Восемь щупалец = восемь цветов проектов на графике: кончик каждого светится цветом своего проекта.
 * Зрачки следят за курсором, щупальца плавно покачиваются (отключается при «уменьшить движение»).
 */
const ARMS = [
  'M100 176 C70 200 40 200 30 236 C24 258 44 270 56 256',
  'M116 182 C100 214 70 226 72 252 C74 270 92 274 96 262',
  'M134 186 C128 220 112 244 118 274',
  'M152 188 C150 228 140 254 146 286',
  'M168 188 C170 228 180 254 174 286',
  'M186 186 C192 220 208 244 202 274',
  'M204 182 C220 214 250 226 248 252 C246 270 228 274 224 262',
  'M220 176 C250 200 280 200 290 236 C296 258 276 270 264 256',
];
const TIPS: [number, number][] = [
  [56, 256],
  [96, 262],
  [118, 274],
  [146, 286],
  [174, 286],
  [202, 274],
  [224, 262],
  [264, 256],
];
const BASES: [number, number][] = [
  [100, 176],
  [116, 182],
  [134, 186],
  [152, 188],
  [168, 188],
  [186, 186],
  [204, 182],
  [220, 176],
];

export function Octopus({
  size = 300,
  tipColors,
  tipLabels,
  animated = true,
  followCursor = true,
  className,
}: {
  size?: number;
  tipColors?: string[];
  tipLabels?: string[];
  animated?: boolean;
  followCursor?: boolean;
  className?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const svgRef = useRef<SVGSVGElement>(null);
  const pupils = useRef<(SVGGElement | null)[]>([]);

  useEffect(() => {
    if (!followCursor) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    let target = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      const svg = svgRef.current;
      if (!svg) return;
      const r = svg.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height * 0.4;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 260);
      target = { x: (dx / d) * 5.5 * k, y: (dy / d) * 5 * k };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        for (const p of pupils.current) p?.setAttribute('transform', `translate(${target.x.toFixed(2)} ${target.y.toFixed(2)})`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('pointermove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [followCursor]);

  const tips = tipColors?.length ? tipColors : ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#22a33a', '#9085e9', '#e66767'];

  return (
    <svg ref={svgRef} viewBox="0 0 320 304" width={size} height={(size * 304) / 320} className={className} role="img" aria-label="Осьминог Profimonsters">
      <defs>
        <radialGradient id={`m-${uid}`} cx="40%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#c7b4ff" />
          <stop offset="38%" stopColor="#8a62ff" />
          <stop offset="78%" stopColor="#5b2be0" />
          <stop offset="100%" stopColor="#3a1699" />
        </radialGradient>
        <linearGradient id={`a-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6d3cf0" />
          <stop offset="100%" stopColor="#4a1fbf" />
        </linearGradient>
        <filter id={`g-${uid}`} x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
        <radialGradient id={`h-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7b55ff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7b55ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* мягкое свечение позади */}
      <ellipse cx="160" cy="140" rx="160" ry="140" fill={`url(#h-${uid})`} />

      <g className={animated ? 'octo-bob' : undefined}>
        {/* щупальца */}
        {ARMS.map((d, i) => (
          <g
            key={i}
            className={animated ? 'octo-arm' : undefined}
            style={animated ? { transformOrigin: `${BASES[i][0]}px ${BASES[i][1]}px`, animationDuration: `${3.4 + (i % 4) * 0.45}s`, animationDelay: `${-i * 0.55}s` } : undefined}
          >
            <path d={d} fill="none" stroke={`url(#a-${uid})`} strokeWidth={i === 3 || i === 4 ? 15 : 17} strokeLinecap="round" />
            <path d={d} fill="none" stroke="#d9ccff" strokeOpacity="0.35" strokeWidth="5" strokeLinecap="round" strokeDasharray="0.1 10" />
            <circle cx={TIPS[i][0]} cy={TIPS[i][1]} r="9" fill={tips[i % tips.length]} filter={`url(#g-${uid})`} className={animated ? 'octo-tip' : undefined} style={{ animationDelay: `${-i * 0.3}s` }} />
            <circle cx={TIPS[i][0]} cy={TIPS[i][1]} r="5" fill={tips[i % tips.length]}>
              {tipLabels?.[i] && <title>{tipLabels[i]}</title>}
            </circle>
          </g>
        ))}

        {/* голова */}
        <path d="M72 128 C72 58 112 20 160 20 C208 20 248 58 248 128 C248 162 230 182 206 190 L114 190 C90 182 72 162 72 128Z" fill={`url(#m-${uid})`} />
        <ellipse cx="128" cy="58" rx="30" ry="16" fill="#fff" opacity="0.16" transform="rotate(-24 128 58)" />
        <circle cx="206" cy="66" r="5" fill="#fff" opacity="0.12" />
        <circle cx="222" cy="92" r="3.5" fill="#fff" opacity="0.1" />

        {/* глаза */}
        {[128, 192].map((x, i) => (
          <g key={x} className={animated ? 'octo-eye' : undefined} style={{ animationDelay: `${i * 0.06}s` }}>
            <ellipse cx={x} cy="120" rx="23" ry="25" fill="#fbfaff" />
            <g ref={(el) => { pupils.current[i] = el; }}>
              <circle cx={x} cy="122" r="13" fill="#bef254" />
              <circle cx={x} cy="122" r="7.5" fill="#12082a" />
              <circle cx={x + 4} cy="117" r="3" fill="#fff" />
            </g>
          </g>
        ))}
        {/* щёки и улыбка */}
        <ellipse cx="104" cy="152" rx="10" ry="6" fill="#ff8fd0" opacity="0.28" />
        <ellipse cx="216" cy="152" rx="10" ry="6" fill="#ff8fd0" opacity="0.28" />
        <path d="M146 158 Q160 170 174 158" fill="none" stroke="#1d0b4a" strokeWidth="4" strokeLinecap="round" />
      </g>
    </svg>
  );
}

/** Мини-голова для логотипа. */
export function OctopusMark({ size = 30 }: { size?: number }) {
  return <Octopus size={size} animated={false} followCursor={false} />;
}
