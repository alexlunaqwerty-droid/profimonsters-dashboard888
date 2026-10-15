'use client';
import { useState } from 'react';
import type { ProjectRow } from '@/analytics';
import { formatAbsChange, formatPctChange, formatValue } from '@/analytics/format';
import type { MetricDefinition, Verdict } from '@/domain/types';
import { seriesStyle } from './chart/palette';
import { trendIcon, verdictBg, verdictText } from './KpiCards';
import { cx, Icon } from './ui';

type SortKey = 'rank' | 'project' | 'current' | 'previous' | 'abs' | 'pct';

const STATUS_LABEL: Record<string, string> = { up: 'Рост', down: 'Снижение', flat: 'Без изменений', none: 'Нет сравнения' };

export function ProjectTable({ rows, metric, allProjects, dark, periodLabel, prevLabel }: { rows: ProjectRow[]; metric: MetricDefinition; allProjects: string[]; dark: boolean; periodLabel: string; prevLabel: string }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'rank', dir: 1 });
  const val = (r: ProjectRow, k: SortKey): number | string | null => {
    switch (k) {
      case 'rank':
        return r.rank;
      case 'project':
        return r.project;
      case 'current':
        return r.change.current;
      case 'previous':
        return r.change.previous;
      case 'abs':
        return r.change.abs;
      case 'pct':
        return r.change.pct;
    }
  };
  const sorted = [...rows].sort((a, b) => {
    const x = val(a, sort.key);
    const y = val(b, sort.key);
    if (x === null && y === null) return 0;
    if (x === null) return 1; // пустые всегда внизу
    if (y === null) return -1;
    if (typeof x === 'string') return x.localeCompare(String(y), 'ru') * sort.dir;
    return ((x as number) - (y as number)) * sort.dir;
  });
  const th = (k: SortKey, label: string, cls = '') => (
    <th scope="col" className={cx('px-3 py-2.5 font-medium', cls)} aria-sort={sort.key === k ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className={cx('inline-flex items-center gap-1 hover:text-primary', sort.key === k && 'text-primary')}
        onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? ((-s.dir) as 1 | -1) : k === 'project' || k === 'rank' ? 1 : -1 }))}
      >
        {label}
        {sort.key === k && <Icon name={sort.dir === 1 ? 'up' : 'down'} className="h-3 w-3" />}
      </button>
    </th>
  );

  const counts = { good: 0, bad: 0, neutral: 0 } as Record<Verdict, number>;
  rows.forEach((r) => (counts[r.change.verdict] = (counts[r.change.verdict] ?? 0) + 1));

  return (
    <section className="panel" aria-label="Сравнение проектов">
      <div className="flex flex-col gap-1 px-4 pt-4 sm:flex-row sm:items-end sm:justify-between sm:px-5">
        <div>
          <h2 className="font-serif-display text-[28px] font-medium leading-tight">Проекты: {metric.shortName}</h2>
          <p className="text-[12.5px] text-muted">
            {periodLabel} к {prevLabel}
          </p>
        </div>
        <div className="flex gap-3 text-[12.5px]">
          <span className="text-good">▲ лучше: {counts.good}</span>
          <span className="text-bad">▼ хуже: {counts.bad}</span>
          <span className="text-muted">≈ {counts.neutral}</span>
        </div>
      </div>
      <div className="scroll-thin mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-[13px]">
          <thead className="border-y border-white/[0.06] bg-white/[0.025] text-[12px] text-muted">
            <tr>
              {th('rank', 'Место', 'w-16')}
              {th('project', 'Проект')}
              {th('current', 'Текущий период', 'text-right')}
              {th('previous', 'Предыдущий', 'text-right')}
              {th('abs', 'Изменение', 'text-right')}
              {th('pct', 'Изменение, %', 'text-right')}
              <th scope="col" className="px-3 py-2.5 font-medium">
                Статус
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const st = seriesStyle(allProjects.indexOf(r.project), dark);
              const partial = r.change.current !== null && r.filledDays < r.totalDays && metric.periodAggregation === 'sum';
              return (
                <tr key={r.project} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03]">
                  <td className="px-3 py-2.5 tnum">
                    {r.rank ? (
                      <span className={cx('inline-grid h-6 min-w-6 place-items-center rounded-md px-1 text-[12px] font-semibold', r.rank === 1 ? 'bg-accent text-accent-ink' : 'bg-surface2 text-ink2')}>{r.rank}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: st.color }} />
                      <span className="font-medium">{r.project}</span>
                      {partial && (
                        <span className="whitespace-nowrap rounded bg-surface2 px-1.5 py-0.5 text-[11px] text-muted" title="Не за все дни периода есть значения">
                          {r.filledDays} из {r.totalDays} дн.
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tnum">{formatValue(r.change.current, metric)}</td>
                  <td className="px-3 py-2.5 text-right text-ink2 tnum">{formatValue(r.change.previous, metric)}</td>
                  <td className={cx('px-3 py-2.5 text-right tnum', verdictText(r.change.verdict))}>{formatAbsChange(r.change, metric)}</td>
                  <td className={cx('px-3 py-2.5 text-right font-medium tnum', verdictText(r.change.verdict))}>{r.change.trend === 'none' ? '—' : formatPctChange(r.change)}</td>
                  <td className="px-3 py-2.5">
                    <span className={cx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium', verdictBg(r.change.verdict))}>
                      {r.change.trend !== 'none' && <Icon name={trendIcon(r.change.trend)} className="h-3 w-3" strokeWidth={2.2} />}
                      {STATUS_LABEL[r.change.trend]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 text-[12px] text-muted sm:px-5">
        Зелёный — динамика в нужную сторону, красный — в обратную, серый — изменение меньше {metric.unit === 'percent' || metric.unit === 'points' ? '0,5 п.' : '1 %'}
        {metric.direction === 'down' ? '. Для этого показателя снижение — хороший результат.' : metric.direction === 'neutral' ? '. Для этого показателя направление не оценивается.' : '.'}
      </p>
    </section>
  );
}
