'use client';
import { useEffect, useState } from 'react';

/** Печатает фразы по очереди, как в примере. При «уменьшить движение» показывает первую фразу целиком. */
export function Typewriter({ lines, speed = 32, hold = 3800 }: { lines: string[]; speed?: number; hold?: number }) {
  const [idx, setIdx] = useState(0);
  const [text, setText] = useState('');
  const key = lines.join('\u0001');

  useEffect(() => {
    setIdx(0);
    setText('');
  }, [key]);

  useEffect(() => {
    if (!lines.length) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setText(lines[0]);
      return;
    }
    const full = lines[idx % lines.length];
    let i = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      i++;
      setText(full.slice(0, i));
      if (i < full.length) t = setTimeout(tick, speed);
      else if (lines.length > 1) t = setTimeout(() => setIdx((n) => n + 1), hold);
    };
    t = setTimeout(tick, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, key]);

  return (
    <span aria-live="polite">
      {text}
      <span className="caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-accent align-baseline" aria-hidden="true" />
    </span>
  );
}
