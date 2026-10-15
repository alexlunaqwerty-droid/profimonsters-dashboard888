/**
 * Все расчёты дашборда. Компоненты интерфейса только вызывают эти функции и отображают результат.
 */
import { getMetric } from '@/config/metrics';
import type { DateRange, MetricDefinition, MetricRecord, Trend, Verdict } from '@/domain/types';
import { bucketLabel, bucketStart, eachDay, inRange, type Granularity } from '@/filters/period';

/* ---------- Индекс записей ---------- */

/** metricId → project → date → record */
export type RecordIndex = Map<string, Map<string, Map<string, MetricRecord>>>;

export function buildIndex(records: MetricRecord[]): RecordIndex {
  const idx: RecordIndex = new Map();
  for (const r of records) {
    let byProject = idx.get(r.metricId);
    if (!byProject) idx.set(r.metricId, (byProject = new Map()));
    let byDate = byProject.get(r.project);
    if (!byDate) byProject.set(r.project, (byDate = new Map()));
    byDate.set(r.date, r);
  }
  return idx;
}

function recordsInRange(idx: RecordIndex, metricId: string, project: string, range: DateRange): MetricRecord[] {
  const byDate = idx.get(metricId)?.get(project);
  if (!byDate) return [];
  const out: MetricRecord[] = [];
  for (const [date, r] of byDate) if (inRange(date, range)) out.push(r);
  out.sort((a, b) => (a.date < b.date ? -1 : 1));
  return out;
}

/* ---------- Свёртка ---------- */

/** Сворачивает значения одного проекта за период по правилу метрики. Пустой период → null (не ноль). */
export function aggregatePeriod(values: number[], metric: MetricDefinition): number | null {
  if (!values.length) return null;
  switch (metric.periodAggregation) {
    case 'sum':
      return values.reduce((s, v) => s + v, 0);
    case 'avg':
      return values.reduce((s, v) => s + v, 0) / values.length;
    case 'last':
      return values[values.length - 1];
  }
}

/** Сводит значения нескольких проектов. Проекты без данных не участвуют. */
export function aggregateProjects(values: (number | null)[], metric: MetricDefinition): number | null {
  const present = values.filter((v): v is number => v !== null);
  if (!present.length) return null;
  const sum = present.reduce((s, v) => s + v, 0);
  return metric.projectAggregation === 'sum' ? sum : sum / present.length;
}

export function projectValue(idx: RecordIndex, metric: MetricDefinition, project: string, range: DateRange): number | null {
  return aggregatePeriod(
    recordsInRange(idx, metric.id, project, range).map((r) => r.value),
    metric,
  );
}

/* ---------- Сравнение ---------- */

/** Порог «без существенных изменений»: 1 % относительного изменения или 0,5 п.п. для процентов. */
export const FLAT_THRESHOLD_PCT = 1;
export const FLAT_THRESHOLD_PP = 0.5;

export interface Change {
  current: number | null;
  previous: number | null;
  abs: number | null;
  /** Относительное изменение в процентах; null, если не с чем сравнить. */
  pct: number | null;
  trend: Trend;
  verdict: Verdict;
}

export function compare(current: number | null, previous: number | null, metric: MetricDefinition): Change {
  if (current === null || previous === null) {
    return { current, previous, abs: null, pct: null, trend: 'none', verdict: 'none' };
  }
  const abs = current - previous;
  const pct = previous !== 0 ? (abs / Math.abs(previous)) * 100 : null;
  let trend: Trend;
  if (metric.unit === 'percent' || metric.unit === 'points') {
    trend = Math.abs(abs) < FLAT_THRESHOLD_PP ? 'flat' : abs > 0 ? 'up' : 'down';
  } else if (pct === null) {
    trend = abs === 0 ? 'flat' : abs > 0 ? 'up' : 'down';
  } else {
    trend = Math.abs(pct) < FLAT_THRESHOLD_PCT ? 'flat' : pct > 0 ? 'up' : 'down';
  }
  return { current, previous, abs, pct, trend, verdict: verdictFor(trend, metric) };
}

/** Учитывает направление метрики: для увольнений снижение — хороший результат. */
export function verdictFor(trend: Trend, metric: MetricDefinition): Verdict {
  if (trend === 'none') return 'none';
  if (trend === 'flat' || metric.direction === 'neutral') return 'neutral';
  const good = metric.direction === 'up' ? trend === 'up' : trend === 'down';
  return good ? 'good' : 'bad';
}

/** Числовая «полезность» изменения для сортировки: больше — лучше. */
function goodness(c: Change, metric: MetricDefinition): number | null {
  const v = c.pct ?? (c.abs !== null && metric.unit === 'percent' ? c.abs : null);
  if (v === null) return null;
  return metric.direction === 'down' ? -v : v;
}

/* ---------- Таблица проектов ---------- */

export interface ProjectRow {
  project: string;
  change: Change;
  rank: number | null;
  /** Есть ли пропуски за текущий период (не каждый день заполнен). */
  filledDays: number;
  totalDays: number;
}

export function projectTable(
  idx: RecordIndex,
  metric: MetricDefinition,
  projects: string[],
  range: DateRange,
  prevRange: DateRange,
): ProjectRow[] {
  const totalDays = eachDay(range).length;
  const rows: ProjectRow[] = projects.map((p) => ({
    project: p,
    change: compare(projectValue(idx, metric, p, range), projectValue(idx, metric, p, prevRange), metric),
    rank: null,
    filledDays: recordsInRange(idx, metric.id, p, range).length,
    totalDays,
  }));
  const ranked = rows.filter((r) => r.change.current !== null);
  ranked.sort((a, b) => {
    const d = (b.change.current as number) - (a.change.current as number);
    return metric.direction === 'down' ? -d : d;
  });
  ranked.forEach((r, i) => (r.rank = i + 1));
  return rows.sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || a.project.localeCompare(b.project, 'ru'));
}

/* ---------- Карточка показателя ---------- */

export interface PlanProgress {
  fact: number;
  plan: number;
  /** fact / plan × 100 */
  percent: number;
  verdict: Verdict;
}

export interface MetricSummary {
  metric: MetricDefinition;
  change: Change;
  /** Лучший проект по значению за период с учётом направления. */
  best: { project: string; value: number } | null;
  /** Проект с самой слабой динамикой к прошлому периоду (с учётом направления). */
  worst: { project: string; change: Change } | null;
  plan: PlanProgress | null;
  projectsWithData: number;
}

export function metricSummary(
  idx: RecordIndex,
  metricId: string,
  projects: string[],
  range: DateRange,
  prevRange: DateRange,
): MetricSummary | null {
  const metric = getMetric(metricId);
  if (!metric) return null;
  const rows = projectTable(idx, metric, projects, range, prevRange);
  const current = aggregateProjects(rows.map((r) => r.change.current), metric);
  const previous = aggregateProjects(rows.map((r) => r.change.previous), metric);
  const change = compare(current, previous, metric);

  const top = rows.find((r) => r.rank === 1);
  const best = top && metric.direction !== 'neutral' && rows.filter((r) => r.rank).length > 1
    ? { project: top.project, value: top.change.current as number }
    : null;

  let worst: MetricSummary['worst'] = null;
  let worstScore = Infinity;
  for (const r of rows) {
    const g = metric.direction === 'neutral' ? (r.change.pct ?? null) : goodness(r.change, metric);
    if (g === null) continue;
    if (g < worstScore) {
      worstScore = g;
      worst = { project: r.project, change: r.change };
    }
  }
  // «Просел» имеет смысл только при реальном ухудшении.
  if (worst && !(worst.change.verdict === 'bad' || (metric.direction === 'neutral' && worst.change.trend === 'down'))) worst = null;

  return {
    metric,
    change,
    best,
    worst,
    plan: planProgress(idx, metric, projects, range),
    projectsWithData: rows.filter((r) => r.change.current !== null).length,
  };
}

/** Выполнение плана: факт и план сворачиваются одинаково и только по записям, где план указан. */
export function planProgress(idx: RecordIndex, metric: MetricDefinition, projects: string[], range: DateRange): PlanProgress | null {
  const facts: (number | null)[] = [];
  const plans: (number | null)[] = [];
  for (const p of projects) {
    const withPlan = recordsInRange(idx, metric.id, p, range).filter((r) => r.plan !== null && r.plan !== undefined);
    facts.push(aggregatePeriod(withPlan.map((r) => r.value), metric));
    plans.push(aggregatePeriod(withPlan.map((r) => r.plan as number), metric));
  }
  const fact = aggregateProjects(facts, metric);
  const plan = aggregateProjects(plans, metric);
  if (fact === null || plan === null || plan === 0) return null;
  const percent = (fact / plan) * 100;
  let verdict: Verdict = 'neutral';
  if (metric.direction === 'up') verdict = percent >= 100 ? 'good' : 'bad';
  if (metric.direction === 'down') verdict = percent <= 100 ? 'good' : 'bad';
  return { fact, plan, percent, verdict };
}

/* ---------- Ряды для графика ---------- */

export interface SeriesPoint {
  bucket: string;
  label: string;
  [project: string]: number | null | string;
}

export interface SeriesResult {
  points: SeriesPoint[];
  /** Сколько ячеек «проект × точка» без значения. */
  missing: number;
  total: number;
  /** Проекты, у которых за период нет ни одного значения. */
  emptyProjects: string[];
}

/**
 * Ряды по проектам. Пропуски остаются null — график рисует разрыв линии, ноль не подставляется.
 * При детализации по неделям и месяцам значения внутри корзины сворачиваются по правилу метрики.
 */
export function buildSeries(
  idx: RecordIndex,
  metric: MetricDefinition,
  projects: string[],
  range: DateRange,
  granularity: Granularity,
): SeriesResult {
  const days = eachDay(range);
  const buckets: string[] = [];
  const bucketOfDay = new Map<string, string>();
  for (const d of days) {
    const b = bucketStart(d, granularity);
    bucketOfDay.set(d, b);
    if (buckets[buckets.length - 1] !== b) buckets.push(b);
  }
  const points: SeriesPoint[] = buckets.map((b) => ({ bucket: b, label: bucketLabel(b, granularity) }));
  const pos = new Map(buckets.map((b, i) => [b, i]));
  let missing = 0;
  const emptyProjects: string[] = [];

  for (const p of projects) {
    const grouped = new Map<string, number[]>();
    for (const r of recordsInRange(idx, metric.id, p, range)) {
      const b = bucketOfDay.get(r.date)!;
      const arr = grouped.get(b);
      if (arr) arr.push(r.value);
      else grouped.set(b, [r.value]);
    }
    if (!grouped.size) emptyProjects.push(p);
    for (const b of buckets) {
      const vals = grouped.get(b);
      const v = vals ? aggregatePeriod(vals, metric) : null;
      if (v === null) missing++;
      points[pos.get(b)!][p] = v;
    }
  }
  return { points, missing, total: buckets.length * projects.length, emptyProjects };
}

/** Время последнего изменения среди записей. */
export function lastUpdated(records: MetricRecord[]): string | null {
  let max: string | null = null;
  for (const r of records) if (!max || r.updatedAt > max) max = r.updatedAt;
  return max;
}
