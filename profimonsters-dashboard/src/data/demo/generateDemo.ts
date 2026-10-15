import { finalizeRecord } from '@/domain/records';
import type { MetricRecord } from '@/domain/types';
import { addDays, fromISO } from '@/filters/period';

/**
 * Демонстрационные данные. Это НЕ данные компании — только пример,
 * чтобы было видно, как работает дашборд. Значения генерируются детерминированно.
 */
export const DEMO_PROJECTS = ['Альфа', 'Бета', 'Гамма', 'Дельта', 'Сигма', 'Омега'];

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Profile {
  scale: number;
  trend: number; // относительное изменение за весь период
  conv1: number;
  conv2: number;
  start: number; // с какого дня (от начала) есть данные
}

const PROFILES: Profile[] = [
  { scale: 1.6, trend: 0.18, conv1: 38, conv2: 62, start: 0 },
  { scale: 1.1, trend: -0.22, conv1: 31, conv2: 55, start: 0 },
  { scale: 0.8, trend: 0.05, conv1: 42, conv2: 66, start: 0 },
  { scale: 1.3, trend: 0.32, conv1: 35, conv2: 58, start: 0 },
  { scale: 0.6, trend: -0.08, conv1: 28, conv2: 49, start: 0 },
  { scale: 0.9, trend: 0.1, conv1: 33, conv2: 60, start: 110 },
];

export function generateDemoRecords(today: string, days = 150): MetricRecord[] {
  const rnd = mulberry32(20261014);
  const out: MetricRecord[] = [];
  const start = addDays(today, -(days - 1));
  const now = new Date();
  const updatedAt = now.toISOString();

  DEMO_PROJECTS.forEach((project, pi) => {
    const p = PROFILES[pi];
    let staff = 140 * p.scale;
    let receivables = 1_600_000 * p.scale;
    for (let i = p.start; i < days; i++) {
      const date = addDays(start, i);
      const t = i / days;
      const dow = fromISO(date).getDay();
      const weekend = dow === 0 || dow === 6 ? 0.78 : 1;
      const k = (1 + p.trend * t) * weekend;
      const noise = (amp: number) => 1 + (rnd() - 0.5) * 2 * amp;
      const push = (metricId: string, value: number, plan?: number | null) => {
        if (rnd() < 0.025) return; // пропуски, как в реальном ручном вводе
        out.push(finalizeRecord({ date, project, metricId, value, plan: plan ?? null, source: 'demo', updatedAt }, now));
      };

      const leads = Math.round(42 * p.scale * k * noise(0.25));
      const conv1 = Math.min(95, p.conv1 * noise(0.12) * (1 + p.trend * t * 0.3));
      const conv2 = Math.min(95, p.conv2 * noise(0.1));
      const shift1 = Math.max(0, Math.round((leads * conv1 * conv2) / 10000));
      const shift3 = Math.round(shift1 * 0.74 * noise(0.12));
      const shift5 = Math.round(shift3 * 0.8 * noise(0.1));
      staff = Math.max(20, staff + (rnd() - 0.47 + p.trend * 0.08) * 2.4);
      const turnout = Math.round(staff * 0.58 * weekend * noise(0.08));
      const dismissals = Math.round(Math.max(0, 2.2 * p.scale * (1 - p.trend * t * 0.8) * noise(0.6)));
      const revenue = Math.round(turnout * 3400 * noise(0.1) * (1 + p.trend * t * 0.2));
      const coef = Math.round(revenue * 0.17 * noise(0.08));
      receivables = Math.max(150_000, receivables + (rnd() - 0.5) * 140_000 * p.scale);
      const isFirstOfWeek = dow === 1;

      push('leads', leads, Math.round(45 * p.scale * weekend));
      push('conv_lead_to_internship', round1(conv1));
      push('conv_internship_to_shift_1', round1(conv2));
      push('shift_1', shift1, Math.max(1, Math.round(9 * p.scale * weekend)));
      push('shift_3', shift3);
      push('shift_5', shift5);
      push('avg_daily_turnout', turnout);
      push('dismissals', dismissals);
      push('active_staff', Math.round(staff));
      push('revenue_total', revenue, Math.round(290_000 * p.scale * weekend));
      push('coefficient_sum', coef);
      push('receivables', Math.round(receivables / 1000) * 1000);
      push('first_shift_cost', Math.round(2600 * noise(0.18) * (1 - p.trend * t * 0.4)));
      push('demand', Math.round(180 * p.scale * (1 + 0.15 * Math.sin(i / 18))));
      push('turnover', round1(Math.max(0.5, 4.5 * noise(0.35) * (1 - p.trend * t))));
      if (isFirstOfWeek || rnd() < 0.15) push('newbie_life', round1(26 * noise(0.25) * (1 + p.trend * t)));
      if (isFirstOfWeek) push('nps', Math.round(Math.max(-100, Math.min(100, 48 * noise(0.35) + p.trend * 30 * t))));
    }
  });
  return out;
}

function round1(v: number) {
  return Math.round(v * 10) / 10;
}
