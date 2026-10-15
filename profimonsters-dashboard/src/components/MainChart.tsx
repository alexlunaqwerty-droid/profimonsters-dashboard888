'use client';
import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, type TooltipProps } from 'recharts';
import type { SeriesResult } from '@/analytics';
import { formatAxis, formatValue, pluralRu } from '@/analytics/format';
import { AGGREGATION_LABELS, METRIC_GROUPS, METRICS, UNIT_LABELS } from '@/config/metrics';
import type { MetricDefinition } from '@/domain/types';
import { GRANULARITY_LABELS, type Granularity } from '@/filters/period';
import { chartChrome, seriesStyle } from './chart/palette';
import { Button, cx, Icon, Segmented, useMediaQuery } from './ui';

interface Props {
  metric: MetricDefinition;
  availableMetrics: string[];
  onMetric: (id: string) => void;
  allProjects: string[];
  projects: string[];
  series: SeriesResult;
  granularity: Granularity;
  onGranularity: (g: Granularity) => void;
  dark: boolean;
  onAdd: () => void;
  onImport: () => void;
  readOnly: boolean;
}

export function MainChart(p: Props) {
  const { metric, series, projects, dark } = p;
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [hover, setHover] = useState<string | null>(null);
  const [connect, setConnect] = useState(false);
  const isPhone = useMediaQuery('(max-width: 639px)');
  const chrome = chartChrome(dark);

  const visible = projects.filter((x) => !hidden.has(x));
  const hasAny = series.total > 0 && series.missing < series.total;
  const toggle = (x: string) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(x)) n.delete(x);
      else n.add(x);
      return n;
    });
  const solo = (x: string) => setHidden(new Set(projects.filter((y) => y !== x)));

  const groups = useMemo(
    () =>
      Object.entries(METRIC_GROUPS)
        .map(([g, title]) => ({ title, items: METRICS.filter((m) => m.group === g && p.availableMetrics.includes(m.id)) }))
        .filter((g) => g.items.length),
    [p.availableMetrics],
  );

  const filledPct = series.total ? Math.round(((series.total - series.missing) / series.total) * 100) : 0;

  return (
    <section className="panel p-4 sm:p-6" aria-label="Динамика показателя">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <label htmlFor="chart-metric" className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
            Динамика показателя
          </label>
          <div className="relative mt-1 max-w-full">
            <select
              id="chart-metric"
              value={metric.id}
              onChange={(e) => p.onMetric(e.target.value)}
              style={{ fieldSizing: 'content' } as React.CSSProperties}
              className="font-serif-display max-w-full cursor-pointer appearance-none truncate rounded-lg bg-transparent py-0.5 pr-7 text-[28px] font-medium leading-tight text-ink hover:text-primary focus:outline-none sm:text-[38px]"
            >
              {groups.map((g) => (
                <optgroup key={g.title} label={g.title}>
                  {g.items.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Icon name="chevron" className="pointer-events-none absolute right-1 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {UNIT_LABELS[metric.unit]} · {metric.direction === 'up' ? 'рост — хорошо' : metric.direction === 'down' ? 'снижение — хорошо' : 'без оценки направления'} · {p.granularity === 'day' ? 'значение за день' : AGGREGATION_LABELS[metric.periodAggregation].replace('за период', 'за ' + (p.granularity === 'week' ? 'неделю' : 'месяц'))}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<Granularity> label="Детализация" size="sm" value={p.granularity} onChange={p.onGranularity} options={(['day', 'week', 'month'] as Granularity[]).map((g) => ({ id: g, label: GRANULARITY_LABELS[g] }))} />
          <label className="flex cursor-pointer items-center gap-2 rounded-xl px-2 py-1 text-[12.5px] text-ink2 hover:bg-surface2" title="По умолчанию пропуски не заполняются: линия прерывается">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--primary))]" checked={connect} onChange={(e) => setConnect(e.target.checked)} />
            Соединять пропуски
          </label>
        </div>
      </div>

      {!projects.length ? (
        <ChartEmpty title="Не выбрано ни одного проекта" text="Выберите проекты в фильтре сверху." />
      ) : !hasAny ? (
        <ChartEmpty
          title="Нет данных за выбранный период"
          text={`По показателю «${metric.shortName}» в этом периоде нет ни одной записи. Выберите другой период или добавьте данные.`}
          actions={
            !p.readOnly && (
              <>
                <Button variant="primary" icon="plus" onClick={p.onAdd}>
                  Добавить запись
                </Button>
                <Button icon="upload" onClick={p.onImport}>
                  Импортировать файл
                </Button>
              </>
            )
          }
        />
      ) : (
        <>
          {series.missing > 0 && (
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1 text-[12px] text-ink2">
              <Icon name="info" className="h-3.5 w-3.5 text-muted" />
              Заполнено {filledPct} % точек. Пропуски показаны разрывом линии{series.emptyProjects.length ? `; без данных: ${series.emptyProjects.join(', ')}` : ''}.
            </p>
          )}
          <div className="mt-3 h-[270px] w-full sm:h-[380px]" onMouseLeave={() => setHover(null)}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series.points} margin={{ top: 8, right: isPhone ? 6 : 16, bottom: 0, left: isPhone ? -12 : 0 }}>
                <CartesianGrid stroke={chrome.grid} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: chrome.tick, fontSize: 11.5 }} tickLine={false} axisLine={{ stroke: chrome.axis }} minTickGap={isPhone ? 18 : 28} interval="preserveStartEnd" tickMargin={8} />
                <YAxis
                  tick={{ fill: chrome.tick, fontSize: 11.5 }}
                  tickLine={false}
                  axisLine={false}
                  width={isPhone ? 52 : 64}
                  tickFormatter={(v: number) => formatAxis(v, metric)}
                  domain={metric.allowNegative ? ['auto', 'auto'] : [0, 'auto']}
                  allowDecimals={metric.unit === 'percent' || metric.periodAggregation === 'avg'}
                />
                <Tooltip content={<ChartTooltip metric={metric} allProjects={p.allProjects} dark={dark} hover={hover} />} cursor={{ stroke: chrome.axis, strokeWidth: 1 }} wrapperStyle={{ zIndex: 20, outline: 'none' }} />
                {visible.map((proj) => {
                  const st = seriesStyle(p.allProjects.indexOf(proj), dark);
                  const dim = hover !== null && hover !== proj;
                  return (
                    <Line
                      key={proj}
                      dataKey={proj}
                      name={proj}
                      type="monotone"
                      stroke={st.color}
                      strokeDasharray={st.dash}
                      strokeWidth={hover === proj ? 3 : 2}
                      strokeOpacity={dim ? 0.18 : 1}
                      dot={series.points.length <= 14 ? { r: 3, strokeWidth: 0, fill: st.color, fillOpacity: dim ? 0.18 : 1 } : false}
                      activeDot={{ r: 5, strokeWidth: 2, stroke: chrome.surface }}
                      connectNulls={connect}
                      isAnimationActive={false}
                      onMouseEnter={() => setHover(proj)}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend projects={projects} allProjects={p.allProjects} hidden={hidden} hover={hover} dark={dark} onToggle={toggle} onSolo={solo} onHover={setHover} onShowAll={() => setHidden(new Set())} />
        </>
      )}
    </section>
  );
}

function Legend({
  projects,
  allProjects,
  hidden,
  hover,
  dark,
  onToggle,
  onSolo,
  onHover,
  onShowAll,
}: {
  projects: string[];
  allProjects: string[];
  hidden: Set<string>;
  hover: string | null;
  dark: boolean;
  onToggle: (p: string) => void;
  onSolo: (p: string) => void;
  onHover: (p: string | null) => void;
  onShowAll: () => void;
}) {
  const hiddenCount = projects.filter((x) => hidden.has(x)).length;
  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-white/[0.06] pt-3">
      <div className="flex items-center justify-between gap-2 text-[12px] text-muted">
        <span>Нажмите на проект, чтобы скрыть линию; двойное нажатие — показать только его.</span>
        {hiddenCount > 0 && (
          <button type="button" className="shrink-0 font-medium text-primary hover:underline" onClick={onShowAll}>
            Показать все ({hiddenCount} скрыто)
          </button>
        )}
      </div>
      <div className="scroll-thin flex max-h-28 flex-wrap gap-1.5 overflow-y-auto" role="group" aria-label="Проекты на графике">
        {projects.map((proj) => {
          const st = seriesStyle(allProjects.indexOf(proj), dark);
          const off = hidden.has(proj);
          return (
            <button
              key={proj}
              type="button"
              aria-pressed={!off}
              onClick={() => onToggle(proj)}
              onDoubleClick={() => onSolo(proj)}
              onMouseEnter={() => !off && onHover(proj)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => !off && onHover(proj)}
              onBlur={() => onHover(null)}
              className={cx(
                'flex items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] transition-colors duration-300',
                off ? 'border-dashed border-white/10 text-muted' : 'border-white/10 bg-white/[0.03] text-ink hover:border-white/30',
                hover === proj && 'border-primary/60',
              )}
            >
              <svg width="18" height="8" aria-hidden="true">
                <line x1="1" y1="4" x2="17" y2="4" stroke={off ? 'currentColor' : st.color} strokeWidth="2.5" strokeDasharray={st.dash} strokeLinecap="round" />
              </svg>
              <span className={cx(off && 'line-through')}>{proj}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label, metric, allProjects, dark, hover }: TooltipProps<number, string> & { metric: MetricDefinition; allProjects: string[]; dark: boolean; hover: string | null }) {
  if (!active || !payload?.length) return null;
  const rows = payload
    .filter((x) => x.value !== null && x.value !== undefined)
    .sort((a, b) => (b.value as number) - (a.value as number));
  const missing = payload.length - rows.length;
  const MAX = 10;
  return (
    <div className="min-w-[200px] max-w-[280px] rounded-2xl border border-white/10 bg-[#120b22]/95 px-3.5 py-3 text-[12.5px] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
      <div className="mb-1.5 font-semibold text-ink">{label}</div>
      <div className="flex flex-col gap-1">
        {rows.slice(0, MAX).map((r) => {
          const st = seriesStyle(allProjects.indexOf(String(r.dataKey)), dark);
          return (
            <div key={String(r.dataKey)} className={cx('flex items-center justify-between gap-3', hover && hover !== r.dataKey && 'opacity-60', hover === r.dataKey && 'font-semibold')}>
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: st.color }} />
                <span className="truncate text-ink2">{String(r.dataKey)}</span>
              </span>
              <span className="tnum text-ink">{formatValue(r.value as number, metric)}</span>
            </div>
          );
        })}
        {rows.length > MAX && <div className="text-muted">и ещё {rows.length - MAX}</div>}
        {missing > 0 && (
          <div className="text-muted">
            нет данных: {missing} {pluralRu(missing, 'проект', 'проекта', 'проектов')}
          </div>
        )}
      </div>
    </div>
  );
}

function ChartEmpty({ title, text, actions }: { title: string; text: string; actions?: React.ReactNode }) {
  return (
    <div className="mt-4 flex h-[270px] flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-white/10 px-6 text-center sm:h-[380px]">
      <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary">
        <Icon name="chart" className="h-5 w-5" />
      </span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="max-w-md text-[13px] text-muted">{text}</p>
      {actions && <div className="flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}

