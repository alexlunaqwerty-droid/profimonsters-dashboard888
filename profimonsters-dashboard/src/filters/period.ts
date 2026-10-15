import type { DateRange } from '@/domain/types';

/** Все даты — строки YYYY-MM-DD в локальном календаре, без часовых поясов. */

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysBetween(from: string, to: string): number {
  const ms = fromISO(to).getTime() - fromISO(from).getTime();
  return Math.round(ms / 86400000);
}

/** Длина периода в днях, включая обе границы. */
export function rangeLength(r: DateRange): number {
  return daysBetween(r.from, r.to) + 1;
}

export function eachDay(r: DateRange): string[] {
  const out: string[] = [];
  const n = rangeLength(r);
  for (let i = 0; i < n; i++) out.push(addDays(r.from, i));
  return out;
}

export function inRange(date: string, r: DateRange): boolean {
  return date >= r.from && date <= r.to;
}

/** Предыдущий сопоставимый период: той же длины, вплотную перед текущим. */
export function previousRange(r: DateRange): DateRange {
  const len = rangeLength(r);
  return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
}

export type QuickPeriod = '7d' | '30d' | 'month' | 'prev_month';

export const QUICK_PERIODS: { id: QuickPeriod; label: string }[] = [
  { id: '7d', label: '7 дней' },
  { id: '30d', label: '30 дней' },
  { id: 'month', label: 'Текущий месяц' },
  { id: 'prev_month', label: 'Прошлый месяц' },
];

export function quickRange(id: QuickPeriod, today: string): DateRange {
  const t = fromISO(today);
  switch (id) {
    case '7d':
      return { from: addDays(today, -6), to: today };
    case '30d':
      return { from: addDays(today, -29), to: today };
    case 'month':
      return { from: toISO(new Date(t.getFullYear(), t.getMonth(), 1)), to: today };
    case 'prev_month':
      return {
        from: toISO(new Date(t.getFullYear(), t.getMonth() - 1, 1)),
        to: toISO(new Date(t.getFullYear(), t.getMonth(), 0)),
      };
  }
}

export function matchQuick(r: DateRange, today: string): QuickPeriod | null {
  for (const q of QUICK_PERIODS) {
    const qr = quickRange(q.id, today);
    if (qr.from === r.from && qr.to === r.to) return q.id;
  }
  return null;
}

/**
 * Для «текущего месяца» сравнение идёт с тем же числом дней прошлого месяца
 * (1–14 октября против 1–14 сентября), для остальных — с периодом той же длины перед текущим.
 */
export function comparisonRange(r: DateRange, today: string): DateRange {
  if (matchQuick(r, today) === 'month') {
    const f = fromISO(r.from);
    const prevStart = new Date(f.getFullYear(), f.getMonth() - 1, 1);
    const prevEndOfMonth = new Date(f.getFullYear(), f.getMonth(), 0);
    const len = rangeLength(r);
    const end = new Date(prevStart);
    end.setDate(Math.min(len, prevEndOfMonth.getDate()));
    return { from: toISO(prevStart), to: toISO(end) };
  }
  if (matchQuick(r, today) === 'prev_month') {
    const f = fromISO(r.from);
    return {
      from: toISO(new Date(f.getFullYear(), f.getMonth() - 1, 1)),
      to: toISO(new Date(f.getFullYear(), f.getMonth(), 0)),
    };
  }
  return previousRange(r);
}

const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function formatDateShort(iso: string): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function formatDateLong(iso: string): string {
  const d = fromISO(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatRange(r: DateRange): string {
  const a = fromISO(r.from);
  const b = fromISO(r.to);
  if (r.from === r.to) return formatDateLong(r.from);
  if (a.getFullYear() === b.getFullYear()) {
    if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${MONTHS_GEN[b.getMonth()]} ${b.getFullYear()}`;
    return `${a.getDate()} ${MONTHS_GEN[a.getMonth()]} – ${b.getDate()} ${MONTHS_GEN[b.getMonth()]} ${b.getFullYear()}`;
  }
  return `${formatDateLong(r.from)} – ${formatDateLong(r.to)}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

/** Детализация графика. */
export type Granularity = 'day' | 'week' | 'month';

export const GRANULARITY_LABELS: Record<Granularity, string> = { day: 'Дни', week: 'Недели', month: 'Месяцы' };

export function autoGranularity(r: DateRange): Granularity {
  const n = rangeLength(r);
  if (n <= 62) return 'day';
  if (n <= 200) return 'week';
  return 'month';
}

/** Начало корзины, в которую попадает дата (неделя — с понедельника). */
export function bucketStart(iso: string, g: Granularity): string {
  if (g === 'day') return iso;
  const d = fromISO(iso);
  if (g === 'month') return toISO(new Date(d.getFullYear(), d.getMonth(), 1));
  const dow = (d.getDay() + 6) % 7; // 0 = понедельник
  d.setDate(d.getDate() - dow);
  return toISO(d);
}

export function bucketLabel(start: string, g: Granularity): string {
  const d = fromISO(start);
  if (g === 'month') return `${MONTHS_SHORT[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`;
  if (g === 'week') return `с ${formatDateShort(start)}`;
  return formatDateShort(start);
}
