'use client';
import type { MetricSummary } from '@/analytics';
import { formatAbsChange, formatPctChange, formatPercent, formatValue } from '@/analytics/format';
import { AGGREGATION_LABELS } from '@/config/metrics';
import type { Trend, Verdict } from '@/domain/types';
import { useState } from 'react';
import { cx, Icon, InfoTip, useMediaQuery } from './ui';

const COLLAPSED = 8;

export function verdictText(v: Verdict) {
  return v === 'good' ? 'text-good' : v === 'bad' ? 'text-bad' : 'text-muted';
}
export function verdictBg(v: Verdict) {
  return v === 'good' ? 'bg-good-soft text-good' : v === 'bad' ? 'bg-bad-soft text-bad' : 'bg-surface2 text-muted';
}
export function trendIcon(t: Trend) {
  return t === 'up' ? 'up' : t === 'down' ? 'down' : 'flat';
}

export function KpiCards({ summaries, activeMetric, onPick, compareLabel }: { summaries: MetricSummary[]; activeMetric: string; onPick: (id: string) => void; compareLabel: string }) {
  const [expanded, setExpanded] = useState(false);
  const phone = useMediaQuery('(max-width: 639px)');
  const limit = phone ? 4 : COLLAPSED;
  const canCollapse = summaries.length > limit;
  let shown = expanded || !canCollapse ? summaries : summaries.slice(0, limit);
  // Карточка, открытая на графике, всегда видна.
  if (!shown.some((s) => s.metric.id === activeMetric)) {
    const a = summaries.find((s) => s.metric.id === activeMetric);
    if (a) shown = [...shown.slice(0, limit - 1), a];
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
        {shown.map((s) => (
          <KpiCard key={s.metric.id} s={s} active={s.metric.id === activeMetric} onPick={() => onPick(s.metric.id)} compareLabel={compareLabel} />
        ))}
      </div>
      {canCollapse && (
        <button type="button" onClick={() => setExpanded((e) => !e)} className="inline-flex items-center gap-1 self-center rounded-full border border-white/10 px-4 py-1.5 text-[13px] font-medium text-white/80 transition-colors duration-300 hover:border-white/30 hover:text-white">
          {expanded ? 'Свернуть карточки' : `Показать все показатели (${summaries.length})`}
          <Icon name="chevron" className={cx('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}
    </div>
  );
}

function KpiCard({ s, active, onPick, compareLabel }: { s: MetricSummary; active: boolean; onPick: () => void; compareLabel: string }) {
  const { metric: m, change: c } = s;
  const empty = c.current === null;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onClick={onPick}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick())}
      className={cx(
        'panel group flex min-w-0 cursor-pointer flex-col gap-2 rounded-[20px] p-3 text-left transition-all duration-300 hover:-translate-y-0.5 sm:gap-2.5 sm:rounded-card sm:p-5',
        active ? 'outline outline-1 outline-primary/70 shadow-[0_0_0_4px_rgba(165,138,255,0.12),0_20px_60px_-24px_rgba(124,86,255,0.7)]' : 'hover:shadow-[0_20px_60px_-28px_rgba(124,86,255,0.6)]',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <h3 className="truncate text-[11px] font-medium uppercase tracking-[0.14em] text-white/60" title={m.name}>
            {m.shortName}
          </h3>
          <InfoTip text={`${m.description} Значение: ${AGGREGATION_LABELS[m.periodAggregation]}.`} label={`Что показывает «${m.shortName}»`} />
        </div>
        {active && <span className="hidden shrink-0 rounded-full bg-accent sm:inline px-2 py-0.5 text-[10.5px] font-semibold text-accent-ink">на графике</span>}
      </div>

      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={cx('font-serif-display text-[26px] font-semibold leading-none sm:text-[36px]', empty && 'text-muted')}>{empty ? '—' : formatValue(c.current, m, { compact: true })}</span>
        {!empty && (
          <span className={cx('inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[12px] font-semibold tnum', verdictBg(c.verdict))} title={`К ${compareLabel}: ${formatAbsChange(c, m)}`}>
            {c.trend !== 'none' && <Icon name={trendIcon(c.trend)} className="h-3 w-3" strokeWidth={2.2} />}
            {c.trend === 'none' ? 'нет сравнения' : formatPctChange(c) === '—' ? formatAbsChange(c, m) : m.unit === 'percent' ? formatAbsChange(c, m) : formatPctChange(c)}
          </span>
        )}
      </div>

      {empty ? (
        <p className="text-[12.5px] text-muted">Нет данных за выбранный период</p>
      ) : (
        <dl className="grid gap-1 text-[12.5px]">
          <Row label="Было" value={formatValue(c.previous, m, { compact: true })} />
          {s.best && <Row label="Лучший" value={s.best.project} className="hidden sm:flex" />}
          {s.worst && <Row className="hidden sm:flex"  label="Просел" value={`${s.worst.project} · ${s.worst.change.pct !== null && m.unit !== 'percent' ? formatPctChange(s.worst.change) : formatAbsChange(s.worst.change, m)}`} tone="bad" />}
          {s.plan && <PlanBar plan={s.plan} />}
        </dl>
      )}
    </div>
  );
}

function Row({ label, value, tone, className }: { label: string; value: string; tone?: 'bad'; className?: string }) {
  return (
    <div className={cx('flex min-w-0 items-baseline justify-between gap-3', className)}>
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className={cx('truncate text-right font-medium tnum', tone === 'bad' ? 'text-bad' : 'text-ink')}>{value}</dd>
    </div>
  );
}

function PlanBar({ plan }: { plan: NonNullable<MetricSummary['plan']> }) {
  const w = Math.min(100, plan.percent);
  return (
    <div className="mt-1 flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <dt className="text-muted">План</dt>
        <dd className={cx('font-semibold tnum', verdictText(plan.verdict))}>{formatPercent(plan.percent)}</dd>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
        <div className={cx('h-full rounded-full', plan.verdict === 'bad' ? 'bg-bad/70' : 'bg-gradient-to-r from-[#7b55ff] to-accent')} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}
