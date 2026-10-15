import { METRICS } from '@/config/metrics';
import type { DateRange, MetricRecord } from '@/domain/types';
import { inRange, quickRange, type QuickPeriod } from './period';

export interface FilterState {
  range: DateRange;
  /** Выбранные проекты; пустой массив = все проекты. */
  projects: string[];
  /** Выбранные показатели для карточек; пустой массив = все. */
  metrics: string[];
  /** Показатель на главном графике и в таблице. */
  chartMetric: string;
}

export const DEFAULT_QUICK: QuickPeriod = '30d';
export const DEFAULT_CHART_METRIC = 'shift_1';

export function defaultFilters(today: string): FilterState {
  return { range: quickRange(DEFAULT_QUICK, today), projects: [], metrics: [], chartMetric: DEFAULT_CHART_METRIC };
}

/** Список проектов, встречающихся в данных, в алфавитном порядке. */
export function listProjects(records: MetricRecord[]): string[] {
  const set = new Set<string>();
  for (const r of records) set.add(r.project);
  return [...set].sort((a, b) => a.localeCompare(b, 'ru'));
}

export function effectiveProjects(f: FilterState, all: string[]): string[] {
  if (!f.projects.length) return all;
  const allowed = new Set(all);
  return f.projects.filter((p) => allowed.has(p));
}

export function effectiveMetrics(f: FilterState): string[] {
  return f.metrics.length ? f.metrics : METRICS.map((m) => m.id);
}

export function isDefaultFilters(f: FilterState, today: string): boolean {
  const d = defaultFilters(today);
  return f.range.from === d.range.from && f.range.to === d.range.to && !f.projects.length && !f.metrics.length;
}

export interface RecordQuery {
  range?: DateRange;
  projects?: string[];
  metrics?: string[];
  text?: string;
}

/** Фильтр для журнала записей. */
export function queryRecords(records: MetricRecord[], q: RecordQuery): MetricRecord[] {
  const ps = q.projects?.length ? new Set(q.projects) : null;
  const ms = q.metrics?.length ? new Set(q.metrics) : null;
  const text = q.text?.trim().toLowerCase();
  return records
    .filter(
      (r) =>
        (!q.range || inRange(r.date, q.range)) &&
        (!ps || ps.has(r.project)) &&
        (!ms || ms.has(r.metricId)) &&
        (!text || r.project.toLowerCase().includes(text) || (r.note ?? '').toLowerCase().includes(text)),
    )
    .sort((a, b) => (a.date === b.date ? a.project.localeCompare(b.project, 'ru') : a.date < b.date ? 1 : -1));
}
