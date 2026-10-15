'use client';
import { useEffect, useRef } from 'react';

/**
 * Живой фон вместо видео: глубина, планктон и огромные полупрозрачные щупальца,
 * которые медленно колышутся у краёв экрана. Рисуется на canvas ~30 кадров/с,
 * останавливается на скрытой вкладке и замирает при «уменьшить движение».
 */
interface Tentacle {
  /** Основание в долях экрана. */
  bx: number;
  by: number;
  angle: number; // начальное направление, рад
  curl: number; // закрутка к кончику
  len: number; // длина в долях высоты
  width: number; // толщина у основания в px
  phase: number;
  speed: number;
  hue: [number, number, number];
}

const TENTACLES: Tentacle[] = [
  { bx: -0.04, by: 1.06, angle: -1.05, curl: 2.3, len: 0.95, width: 70, phase: 0, speed: 0.32, hue: [124, 86, 255] },
  { bx: 0.18, by: 1.12, angle: -1.35, curl: 1.6, len: 0.62, width: 44, phase: 2.1, speed: 0.4, hue: [91, 43, 224] },
  { bx: 1.05, by: 1.04, angle: -2.05, curl: -2.4, len: 1.0, width: 76, phase: 1.2, speed: 0.28, hue: [124, 86, 255] },
  { bx: 0.86, by: 1.14, angle: -1.75, curl: -1.5, len: 0.55, width: 40, phase: 3.4, speed: 0.36, hue: [150, 110, 255] },
  { bx: 1.06, by: 0.28, angle: -2.9, curl: -1.9, len: 0.5, width: 42, phase: 4.2, speed: 0.3, hue: [91, 43, 224] },
];

interface Mote {
  x: number;
  y: number;
  r: number;
  a: number;
  vy: number;
  tw: number;
}

export function DeepSea() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let motes: Mote[] = [];
    let raf = 0;
    let last = 0;
    let running = true;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(90, (w * h) / 16000));
      motes = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 0.5 + Math.random() * 1.6,
        a: 0.12 + Math.random() * 0.45,
        vy: 4 + Math.random() * 10,
        tw: Math.random() * Math.PI * 2,
      }));
    };

    const drawTentacle = (t: Tentacle, time: number) => {
      const N = 46;
      const L = t.len * h;
      const step = L / N;
      let x = t.bx * w;
      let y = t.by * h;
      const left: [number, number][] = [];
      const right: [number, number][] = [];
      const centers: [number, number, number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const theta = t.angle + t.curl * u * u + Math.sin(time * t.speed + u * 3.2 + t.phase) * 0.32 * u + Math.sin(time * t.speed * 0.6 + t.phase) * 0.08;
        const wd = t.width * Math.pow(1 - u, 0.85) + 1.2;
        const nx = -Math.sin(theta);
        const ny = Math.cos(theta);
        left.push([x + nx * wd * 0.5, y + ny * wd * 0.5]);
        right.push([x - nx * wd * 0.5, y - ny * wd * 0.5]);
        centers.push([x, y, nx, wd]);
        x += Math.cos(theta) * step;
        y += Math.sin(theta) * step;
      }
      const g = ctx.createLinearGradient(t.bx * w, t.by * h, x, y);
      const [r, gg, b] = t.hue;
      g.addColorStop(0, `rgba(${r},${gg},${b},0.20)`);
      g.addColorStop(0.7, `rgba(${r},${gg},${b},0.10)`);
      g.addColorStop(1, `rgba(${r},${gg},${b},0.02)`);
      ctx.beginPath();
      ctx.moveTo(left[0][0], left[0][1]);
      for (const p of left) ctx.lineTo(p[0], p[1]);
      for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
      ctx.closePath();
      ctx.fillStyle = g;
      ctx.fill();
      // присоски по внутренней стороне
      ctx.fillStyle = 'rgba(217, 204, 255, 0.07)';
      for (let i = 3; i < centers.length - 4; i += 3) {
        const [cx, cy, , wd] = centers[i];
        const p = right[i];
        const sx = cx + (p[0] - cx) * 0.55;
        const sy = cy + (p[1] - cy) * 0.55;
        ctx.beginPath();
        ctx.arc(sx, sy, Math.max(1, wd * 0.16), 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const frame = (now: number) => {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      if (now - last < 33) return; // ~30 кадров/с
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      const time = now / 1000;

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0b0618');
      bg.addColorStop(0.55, '#070411');
      bg.addColorStop(1, '#040209');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(w * 0.72, h * 0.12, 0, w * 0.72, h * 0.12, Math.max(w, h) * 0.6);
      glow.addColorStop(0, 'rgba(110, 70, 255, 0.30)');
      glow.addColorStop(0.45, 'rgba(91, 43, 224, 0.10)');
      glow.addColorStop(1, 'rgba(91, 43, 224, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      const lime = ctx.createRadialGradient(w * 0.08, h * 0.95, 0, w * 0.08, h * 0.95, Math.max(w, h) * 0.45);
      lime.addColorStop(0, 'rgba(190, 242, 84, 0.06)');
      lime.addColorStop(1, 'rgba(190, 242, 84, 0)');
      ctx.fillStyle = lime;
      ctx.fillRect(0, 0, w, h);

      for (const t of TENTACLES) drawTentacle(t, time);

      for (const m of motes) {
        m.y -= m.vy * dt;
        m.x += Math.sin(time * 0.5 + m.tw) * 0.15;
        if (m.y < -4) {
          m.y = h + 4;
          m.x = Math.random() * w;
        }
        const a = m.a * (0.6 + 0.4 * Math.sin(time * 1.3 + m.tw));
        ctx.fillStyle = `rgba(214, 200, 255, ${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    resize();
    window.addEventListener('resize', resize);
    const onVis = () => {
      running = !document.hidden && !reduce;
      if (running) {
        last = 0;
        raf = requestAnimationFrame(frame);
      } else cancelAnimationFrame(raf);
    };
    document.addEventListener('visibilitychange', onVis);
    if (reduce) {
      running = true;
      frame(1000);
      running = false;
      cancelAnimationFrame(raf);
    } else raf = requestAnimationFrame(frame);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 h-full w-full" style={{ background: '#070411' }} />;
}
