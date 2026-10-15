/**
 * Доменная модель дашборда. Не зависит ни от интерфейса, ни от источника данных.
 */

/** Единица измерения показателя. */
export type MetricUnit = 'people' | 'count' | 'percent' | 'rub' | 'days' | 'points';

/**
 * Направление оценки:
 *  up      — рост хорошо (выручка, лиды);
 *  down    — снижение хорошо (увольнения, текучка, дебиторка);
 *  neutral — изменение само по себе не хорошо и не плохо (потребность клиента).
 */
export type Direction = 'up' | 'down' | 'neutral';

/**
 * Как значения одного проекта сворачиваются за период:
 *  sum  — поток событий за день (лиды, увольнения, выручка);
 *  avg  — среднее из дневных значений (среднедневной выход, конверсии, NPS);
 *  last — состояние на дату: берётся последнее значение периода (штат, дебиторка).
 */
export type PeriodAggregation = 'sum' | 'avg' | 'last';

/** Как значения нескольких проектов сводятся в одно число для карточки. */
export type ProjectAggregation = 'sum' | 'avg';

export interface MetricDefinition {
  id: string;
  name: string;
  /** Короткое название для карточек и осей. */
  shortName: string;
  /** Что показывает метрика и для чего нужна (из файла заказчика). */
  description: string;
  unit: MetricUnit;
  direction: Direction;
  periodAggregation: PeriodAggregation;
  projectAggregation: ProjectAggregation;
  /** Можно ли вводить отрицательные значения (NPS может быть от −100 до 100). */
  allowNegative: boolean;
  /** Верхняя граница допустимого значения, если она есть по смыслу (проценты, NPS). */
  max?: number;
  /** Откуда берётся показатель. null — источник пока не определён. */
  source: string | null;
  group: MetricGroup;
}

export type MetricGroup = 'staff' | 'funnel' | 'finance' | 'quality';

/** Одна запись: значение показателя проекта за дату. */
export interface MetricRecord {
  /** Детерминированный идентификатор из (дата, проект, показатель) — защита от дублей. */
  id: string;
  /** Дата в формате YYYY-MM-DD. */
  date: string;
  project: string;
  metricId: string;
  value: number;
  plan?: number | null;
  note?: string;
  /** ISO-время последнего изменения записи. */
  updatedAt: string;
  /** Откуда пришла запись: manual, import:csv, import:xlsx, demo, google-sheets… */
  source: string;
}

/** Черновик записи из формы или импорта, до присвоения id. */
export type RecordDraft = Omit<MetricRecord, 'id' | 'updatedAt'> & { updatedAt?: string };

export interface DateRange {
  from: string; // YYYY-MM-DD, включительно
  to: string; // YYYY-MM-DD, включительно
}

export type Trend = 'up' | 'down' | 'flat' | 'none';
export type Verdict = 'good' | 'bad' | 'neutral' | 'none';
