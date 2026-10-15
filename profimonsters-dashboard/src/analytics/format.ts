import { UNIT_LABELS } from '@/config/metrics';
import type { MetricDefinition } from '@/domain/types';
import type { Change } from './index';

const nf0 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
const nf1fixed = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 });

/** Количественные показатели — целые; проценты и средние — с одним знаком. */
export function formatValue(v: number | null | undefined, metric: MetricDefinition, opts: { compact?: boolean; unit?: boolean } = {}): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const unit = opts.unit === false ? '' : UNIT_LABELS[metric.unit];
  switch (metric.unit) {
    case 'percent':
      return `${nf1fixed.format(v)}${unit ? ' %' : ''}`;
    case 'rub': {
      const s = opts.compact ? compactNumber(v) : nf0.format(Math.round(v));
      return unit ? `${s} ₽` : s;
    }
    case 'points':
      return nf1.format(v);
    case 'days':
      return `${nf1.format(v)}${unit ? ' ' + unit : ''}`;
    default: {
      const isAvg = metric.periodAggregation === 'avg' || metric.projectAggregation === 'avg';
      const s = isAvg && Math.abs(v) < 1000 && !Number.isInteger(v) ? nf1.format(v) : nf0.format(Math.round(v));
      return unit ? `${s} ${unit}` : s;
    }
  }
}

export function compactNumber(v: number): string {
  const a = Math.abs(v);
  if (a >= 1e9) return `${nf2.format(v / 1e9)} млрд`;
  if (a >= 1e6) return `${nf2.format(v / 1e6)} млн`;
  if (a >= 1e4) return `${nf1.format(v / 1e3)} тыс.`;
  return nf0.format(Math.round(v));
}

/** Короткая подпись оси Y. */
export function formatAxis(v: number, metric: MetricDefinition): string {
  if (metric.unit === 'percent') return `${nf0.format(v)} %`;
  if (Math.abs(v) >= 1e4) return compactNumber(v);
  return nf0.format(v);
}

/** Абсолютное изменение со знаком. Для процентов — в процентных пунктах. */
export function formatAbsChange(c: Change, metric: MetricDefinition): string {
  if (c.abs === null) return '—';
  const a = Math.abs(c.abs);
  const tiny = metric.unit === 'percent' ? a < 0.05 : metric.unit === 'rub' || metric.periodAggregation === 'sum' ? a < 0.5 : a < 0.05;
  if (tiny) return metric.unit === 'percent' ? '0 п.п.' : '0';
  const sign = c.abs > 0 ? '+' : '−';
  if (metric.unit === 'percent') return `${sign}${nf1fixed.format(a)} п.п.`;
  return sign + formatValue(a, metric, { compact: metric.unit === 'rub' });
}

export function formatPctChange(c: Change): string {
  if (c.pct === null) return c.abs === null ? 'нет данных' : '—';
  if (Math.abs(c.pct) < 0.05) return '0 %';
  const sign = c.pct > 0 ? '+' : c.pct < 0 ? '−' : '';
  return `${sign}${nf1.format(Math.abs(c.pct))} %`;
}

export function formatPercent(v: number): string {
  return `${nf0.format(v)} %`;
}

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
