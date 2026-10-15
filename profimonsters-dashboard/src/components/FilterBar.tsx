'use client';
import { useMemo, useState } from 'react';
import { METRIC_GROUPS, METRICS } from '@/config/metrics';
import type { FilterState } from '@/filters/filters';
import { matchQuick, QUICK_PERIODS, quickRange, type QuickPeriod } from '@/filters/period';
import { Button, cx, Icon, inputCls, Popover, Segmented } from './ui';
import { seriesStyle } from './chart/palette';

interface Props {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  allProjects: string[];
  today: string;
  onReset: () => void;
  canReset: boolean;
  dark: boolean;
}

export function FilterBar({ filters, setFilters, allProjects, today, onReset, canReset, dark }: Props) {
  const quick = matchQuick(filters.range, today);
  const setQuick = (q: QuickPeriod) => setFilters({ ...filters, range: quickRange(q, today) });
  const setFrom = (from: string) => from && setFilters({ ...filters, range: { from, to: from > filters.range.to ? from : filters.range.to } });
  const setTo = (to: string) => to && setFilters({ ...filters, range: { from: to < filters.range.from ? to : filters.range.from, to } });

  return (
    <div className="liquid-glass flex flex-col gap-3 rounded-[28px] p-3 sm:px-4 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <label htmlFor="f-from" className="sr-only">
            Период с
          </label>
          <span className="text-[13px] text-muted">с</span>
          <input id="f-from" type="date" className={cx(inputCls, 'h-9 w-[9.5rem] tnum')} value={filters.range.from} max={today} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-[13px] text-muted">по</span>
          <label htmlFor="f-to" className="sr-only">
            Период по
          </label>
          <input id="f-to" type="date" className={cx(inputCls, 'h-9 w-[9.5rem] tnum')} value={filters.range.to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Segmented<QuickPeriod> label="Быстрый период" size="sm" value={quick} options={QUICK_PERIODS} onChange={setQuick} />
      </div>
      <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
        <ProjectPicker filters={filters} setFilters={setFilters} allProjects={allProjects} dark={dark} />
        <MetricPicker filters={filters} setFilters={setFilters} />
        <Button variant="ghost" size="sm" icon="reset" onClick={onReset} disabled={!canReset}>
          Сбросить
        </Button>
      </div>
    </div>
  );
}

function PickerButton({ open, onClick, label, value }: { open: boolean; onClick: () => void; label: string; value: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cx('flex h-9 items-center gap-2 rounded-xl border px-3 text-[13px] transition-colors', open ? 'border-primary bg-primary-soft' : 'border-white/10 bg-white/[0.03] hover:border-white/30')}
    >
      <span className="text-muted">{label}</span>
      <span className="max-w-[10rem] truncate font-medium">{value}</span>
      <Icon name="chevron" className={cx('h-3.5 w-3.5 text-muted transition-transform', open && 'rotate-180')} />
    </button>
  );
}

function ProjectPicker({ filters, setFilters, allProjects, dark }: Pick<Props, 'filters' | 'setFilters' | 'allProjects' | 'dark'>) {
  const [q, setQ] = useState('');
  const selected = new Set(filters.projects.length ? filters.projects : allProjects);
  const label = !filters.projects.length ? `Все (${allProjects.length})` : filters.projects.length === 1 ? filters.projects[0] : `${filters.projects.length} из ${allProjects.length}`;
  const shown = allProjects.filter((p) => p.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (p: string) => {
    const next = new Set(selected);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    const arr = allProjects.filter((x) => next.has(x));
    setFilters({ ...filters, projects: arr.length === allProjects.length ? [] : arr });
  };
  return (
    <Popover width={300} trigger={(open, toggleOpen) => <PickerButton open={open} onClick={toggleOpen} label="Проекты" value={label} />}>
      {() => (
        <div className="flex flex-col gap-2">
          {allProjects.length > 6 && (
            <div className="relative">
              <Icon name="search" className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input aria-label="Поиск проекта" className={cx(inputCls, 'h-9 pl-8')} placeholder="Найти проект" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          )}
          <div className="flex gap-1 px-1 text-[12.5px]">
            <button type="button" className="rounded-md px-2 py-1 font-medium text-primary hover:bg-primary-soft" onClick={() => setFilters({ ...filters, projects: [] })}>
              Выбрать все
            </button>
            <button type="button" className="rounded-md px-2 py-1 font-medium text-ink2 hover:bg-surface2" onClick={() => setFilters({ ...filters, projects: allProjects.length ? [allProjects[0]] : [] })}>
              Оставить один
            </button>
          </div>
          <div className="scroll-thin max-h-72 overflow-y-auto">
            {shown.map((p) => {
              const st = seriesStyle(allProjects.indexOf(p), dark);
              return (
                <label key={p} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface2">
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--primary))]" checked={selected.has(p)} onChange={() => toggle(p)} />
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: st.color }} />
                  <span className="truncate text-[13px]">{p}</span>
                </label>
              );
            })}
            {!shown.length && <p className="px-2 py-3 text-[13px] text-muted">{allProjects.length ? 'Ничего не найдено' : 'Проектов пока нет'}</p>}
          </div>
        </div>
      )}
    </Popover>
  );
}

function MetricPicker({ filters, setFilters }: Pick<Props, 'filters' | 'setFilters'>) {
  const selected = new Set(filters.metrics.length ? filters.metrics : METRICS.map((m) => m.id));
  const label = !filters.metrics.length ? `Все (${METRICS.length})` : `${filters.metrics.length} из ${METRICS.length}`;
  const groups = useMemo(() => Object.entries(METRIC_GROUPS).map(([g, title]) => ({ g, title, items: METRICS.filter((m) => m.group === g) })), []);
  const apply = (next: Set<string>) => {
    const arr = METRICS.filter((m) => next.has(m.id)).map((m) => m.id);
    const metrics = arr.length === METRICS.length || !arr.length ? [] : arr;
    const chartMetric = metrics.length && !metrics.includes(filters.chartMetric) ? metrics[0] : filters.chartMetric;
    setFilters({ ...filters, metrics, chartMetric });
  };
  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    apply(next);
  };
  const toggleGroup = (ids: string[]) => {
    const allOn = ids.every((id) => selected.has(id)) && filters.metrics.length > 0;
    const next = filters.metrics.length ? new Set(selected) : new Set<string>();
    ids.forEach((id) => (allOn ? next.delete(id) : next.add(id)));
    apply(next);
  };
  return (
    <Popover width={340} align="right" trigger={(open, t) => <PickerButton open={open} onClick={t} label="Показатели" value={label} />}>
      {() => (
        <div className="scroll-thin flex max-h-[26rem] flex-col gap-2 overflow-y-auto">
          <button type="button" className="self-start rounded-md px-2 py-1 text-[12.5px] font-medium text-primary hover:bg-primary-soft" onClick={() => setFilters({ ...filters, metrics: [] })}>
            Показать все
          </button>
          {groups.map(({ g, title, items }) => (
            <div key={g}>
              <button type="button" onClick={() => toggleGroup(items.map((i) => i.id))} className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted hover:text-primary">
                {title}
              </button>
              {items.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 hover:bg-surface2">
                  <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[rgb(var(--primary))]" checked={selected.has(m.id)} onChange={() => toggle(m.id)} />
                  <span className="text-[13px] leading-snug">{m.name}</span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </Popover>
  );
}
