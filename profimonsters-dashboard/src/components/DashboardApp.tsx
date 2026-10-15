'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildIndex, buildSeries, lastUpdated, metricSummary, projectTable, type MetricSummary } from '@/analytics';
import { formatAbsChange, formatPctChange, formatPercent, pluralRu } from '@/analytics/format';
import { getMetric } from '@/config/metrics';
import { generateDemoRecords } from '@/data/demo/generateDemo';
import { buildExport, buildTemplate } from '@/data/import/importer';
import { MemorySource } from '@/data/sources/memorySource';
import type { BulkMode, DataSource, SaveOptions } from '@/data/sources/types';
import type { MetricRecord } from '@/domain/types';
import { defaultFilters, effectiveMetrics, effectiveProjects, isDefaultFilters, listProjects, type FilterState } from '@/filters/filters';
import { autoGranularity, comparisonRange, formatDateTime, formatRange, toISO, type Granularity } from '@/filters/period';
import { FilterBar } from './FilterBar';
import { ImportDialog } from './ImportDialog';
import { KpiCards } from './KpiCards';
import { MainChart } from './MainChart';
import { ProjectTable } from './ProjectTable';
import { RecordForm } from './RecordForm';
import { RecordsView } from './RecordsView';
import { SourcesView } from './SourcesView';
import { Button, cx, Icon, ToastProvider, useToast } from './ui';
import { DeepSea } from './brand/DeepSea';
import { Octopus, OctopusMark } from './brand/Octopus';
import { Typewriter } from './brand/Typewriter';
import { seriesStyle } from './chart/palette';

export interface ConnectorInfo {
  id: string;
  title: string;
  description: string;
  env: string[];
  configured: boolean;
}

/** Всё, что зависит от среды запуска (Next.js-сервер или опубликованная страница). */
export interface Platform {
  createPrimarySource(): Promise<DataSource>;
  saveFile(filename: string, blob: Blob): Promise<boolean>;
  connectors(): Promise<ConnectorInfo[]>;
  /** Загрузка из внешнего источника в базу сайта (если среда это поддерживает). */
  syncExternal?(id: string): Promise<SyncResult>;
}

export interface SyncResult {
  totalRows: number;
  added: number;
  replaced: number;
  skipped: number;
  issues: { row: number; message: string }[];
}

type Mode = 'demo' | 'work';
type Tab = 'dashboard' | 'records' | 'sources';
type Status = 'loading' | 'ready' | 'error';

const MODE_KEY = 'profimonsters-dashboard:mode';

function readPref(): Mode | null {
  try {
    const v = localStorage.getItem(MODE_KEY);
    return v === 'demo' || v === 'work' ? v : null;
  } catch {
    return null;
  }
}
function writePref(m: Mode) {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {
    /* не критично */
  }
}

export function DashboardApp({ platform }: { platform: Platform }) {
  return (
    <ToastProvider>
      <Dashboard platform={platform} />
    </ToastProvider>
  );
}

function Dashboard({ platform }: { platform: Platform }) {
  const toast = useToast();
  const dark = true; // тема сайта — тёмная «глубина»
  const today = useMemo(() => toISO(new Date()), []);

  /* ---------- Источники ---------- */
  const demoSource = useMemo(() => new MemorySource('demo', 'Демо-данные', true, generateDemoRecords(today)), [today]);
  const [primary, setPrimary] = useState<DataSource | null>(null);
  const [primaryError, setPrimaryError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [records, setRecords] = useState<MetricRecord[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [loadError, setLoadError] = useState('');
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);

  const initPrimary = useCallback(async () => {
    setPrimaryError(null);
    try {
      const src = await platform.createPrimarySource();
      setPrimary(src);
      const recs = await src.load();
      setMode((m) => m ?? (recs.length > 0 || readPref() === 'work' ? 'work' : 'demo'));
    } catch (e) {
      setPrimaryError((e as Error).message || 'База недоступна');
      setMode((m) => m ?? 'demo');
    }
  }, [platform]);

  useEffect(() => {
    initPrimary();
    platform.connectors().then(setConnectors).catch(() => setConnectors([]));
  }, [initPrimary, platform]);

  const source: DataSource | null = mode === 'demo' ? demoSource : mode === 'work' ? primary : null;

  const [syncing, setSyncing] = useState(false);
  const sheetConnected = connectors.some((c) => c.id === 'google-sheets' && c.configured) && !!platform.syncExternal;

  const syncSheet = useCallback(async (): Promise<boolean> => {
    if (!platform.syncExternal) return false;
    setSyncing(true);
    try {
      const r = await platform.syncExternal('google-sheets');
      const issues = r.issues.length ? `; строк с ошибками: ${r.issues.length} (строка ${r.issues[0].row}: ${r.issues[0].message})` : '';
      toast(r.issues.length ? 'info' : 'success', `Google Таблица: новых ${r.added}, обновлено ${r.replaced}${issues}`);
      return true;
    } catch (e) {
      toast('error', (e as Error).message || 'Не удалось загрузить Google Таблицу');
      return false;
    } finally {
      setSyncing(false);
    }
  }, [platform, toast]);

  const load = useCallback(
    async (src: DataSource, manual = false) => {
      if (!manual) setStatus('loading');
      try {
        const recs = await src.load();
        setRecords(recs);
        setStatus('ready');
        setLoadError('');
        setLastSync(new Date().toISOString());
        if (manual) toast('success', `Данные обновлены: ${recs.length} ${pluralRu(recs.length, 'запись', 'записи', 'записей')}`);
      } catch (e) {
        setStatus('error');
        setLoadError((e as Error).message || 'Не удалось загрузить данные');
      }
    },
    [toast],
  );

  useEffect(() => {
    if (mode === 'work' && !primary) {
      if (primaryError) {
        setStatus('error');
        setLoadError(primaryError);
      }
      return;
    }
    if (!source) return;
    load(source);
    const unsub = source.subscribe?.(
      (recs) => {
        setRecords(recs);
        setStatus('ready');
        setLastSync(new Date().toISOString());
      },
      (e) => {
        setStatus('error');
        setLoadError(e.message);
      },
    );
    return () => unsub?.();
  }, [source, mode, primary, primaryError, load]);

  const switchMode = (m: Mode) => {
    writePref(m);
    setMode(m);
    if (m === 'work' && !primary) initPrimary();
  };

  /* ---------- Фильтры ---------- */
  const [filters, setFilters] = useState<FilterState>(() => defaultFilters(today));
  const [granOverride, setGranOverride] = useState<Granularity | null>(null);
  const prevRangeKey = useRef('');
  useEffect(() => {
    const k = filters.range.from + filters.range.to;
    if (prevRangeKey.current && prevRangeKey.current !== k) setGranOverride(null);
    prevRangeKey.current = k;
  }, [filters.range]);
  const granularity = granOverride ?? autoGranularity(filters.range);

  const allProjects = useMemo(() => listProjects(records), [records]);
  const projects = effectiveProjects(filters, allProjects);
  const metricIds = effectiveMetrics(filters);
  const chartMetric = getMetric(metricIds.includes(filters.chartMetric) ? filters.chartMetric : metricIds[0])!;
  const prevRange = comparisonRange(filters.range, today);

  /* ---------- Расчёты (централизованно, в analytics) ---------- */
  const index = useMemo(() => buildIndex(records), [records]);
  const summaries = useMemo(
    () => metricIds.map((id) => metricSummary(index, id, projects, filters.range, prevRange)).filter((s): s is MetricSummary => !!s),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index, metricIds.join(), projects.join('\u0001'), filters.range.from, filters.range.to, prevRange.from, prevRange.to],
  );
  const series = useMemo(() => buildSeries(index, chartMetric, projects, filters.range, granularity), [index, chartMetric, projects.join('\u0001'), filters.range, granularity]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => projectTable(index, chartMetric, projects, filters.range, prevRange), [index, chartMetric, projects.join('\u0001'), filters.range.from, filters.range.to, prevRange.from, prevRange.to]); // eslint-disable-line react-hooks/exhaustive-deps
  const updatedAt = useMemo(() => lastUpdated(records), [records]);
  const periodHasData = summaries.some((s) => s.change.current !== null);

  /* ---------- Действия ---------- */
  const [tab, setTab] = useState<Tab>('dashboard');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MetricRecord | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const byId = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);

  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (r: MetricRecord) => {
    setEditing(r);
    setFormOpen(true);
  };

  const refreshAfterWrite = async () => {
    if (source && !source.subscribe) await load(source);
    else if (source) setRecords(await source.load());
  };

  const saveRecord = async (r: MetricRecord, opts: SaveOptions) => {
    if (!source) return;
    await source.save(r, opts);
    await refreshAfterWrite();
    toast('success', editing ? 'Запись изменена' : opts.overwrite ? 'Запись перезаписана' : 'Запись сохранена');
  };
  const deleteRecord = async (r: MetricRecord) => {
    if (!source) return;
    try {
      await source.remove(r.id);
      await refreshAfterWrite();
      toast('success', 'Запись удалена');
    } catch (e) {
      toast('error', (e as Error).message || 'Не удалось удалить');
    }
  };
  const importRecords = async (recs: MetricRecord[], mode: BulkMode) => {
    if (!source) throw new Error('Источник не готов');
    const res = await source.bulkSave(recs, mode);
    await refreshAfterWrite();
    toast('success', `Загружено: новых ${res.added}, заменено ${res.replaced}${res.skipped ? `, пропущено ${res.skipped}` : ''}`);
    return res;
  };
  const save = async (name: string, blob: Blob) => {
    const ok = await platform.saveFile(name, blob);
    if (!ok) toast('info', 'Скачивание недоступно в этом окне');
  };

  const readOnly = !!source?.readOnly;
  const resetFilters = () => {
    setFilters(defaultFilters(today));
    setGranOverride(null);
  };
  const periodLabel = formatRange(filters.range);
  const prevLabel = formatRange(prevRange);

  const tipColors = useMemo(() => Array.from({ length: 8 }, (_, i) => seriesStyle(i, true).color), []);
  const insights = useMemo(() => buildInsights(summaries), [summaries]);
  const tabs: [Tab, string][] = [
    ['dashboard', 'Дашборд'],
    ['records', 'Журнал'],
    ['sources', 'Источники'],
  ];
  const refresh = async () => {
    if (!source) return;
    if (mode === 'work' && sheetConnected) {
      await syncSheet();
      await load(source);
    } else load(source, true);
  };
  const modeToggle = (
    <div role="radiogroup" aria-label="Какие данные показывать" className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5 text-[12.5px]">
      {(
        [
          ['work', 'Рабочие'],
          ['demo', 'Демо'],
        ] as [Mode, string][]
      ).map(([m, l]) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => switchMode(m)}
          className={cx('rounded-full px-3 py-1 font-medium transition-colors duration-300', mode === m ? (m === 'demo' ? 'bg-accent text-accent-ink' : 'bg-white/[0.14] text-white') : 'text-white/60 hover:text-white')}
        >
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="relative min-h-screen overflow-x-hidden pb-20 selection:bg-white selection:text-black">
      <DeepSea />
      <div className="relative z-10" style={{ paddingLeft: 'max(16px, env(safe-area-inset-left, 0px))', paddingRight: 'max(16px, env(safe-area-inset-right, 0px))' }}>
        {/* ---------- Навигация: стеклянная капсула ---------- */}
        <nav className="drop sticky z-30 mx-auto max-w-[1400px] pt-3 sm:pt-5" style={{ top: 'env(safe-area-inset-top, 0px)' }} aria-label="Основная навигация">
          <div className="liquid-glass flex items-center justify-between gap-3 rounded-full py-2 pl-3 pr-2 sm:pl-5">
            <div className="flex min-w-0 items-center gap-8">
              <button type="button" onClick={() => setTab('dashboard')} className="flex items-center gap-2" aria-label="Profimonsters — на главную">
                <OctopusMark size={34} />
                <span className="text-[17px] font-semibold tracking-[-0.02em] text-white">Profimonsters</span>
              </button>
              <div className="hidden items-center gap-7 text-sm font-medium md:flex">
                {tabs.map(([t, l]) => (
                  <button key={t} type="button" onClick={() => setTab(t)} aria-current={tab === t ? 'page' : undefined} className={cx('relative py-1 transition-colors duration-300', tab === t ? 'text-white' : 'text-white/60 hover:text-white')}>
                    {l}
                    {tab === t && <span className="absolute -bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-accent" />}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <div className="hidden lg:block">{modeToggle}</div>
              <button type="button" onClick={refresh} disabled={!source || status === 'loading' || syncing} title={mode === 'work' && sheetConnected ? 'Загрузить свежие строки из Google Таблицы' : 'Обновить данные'} aria-label="Обновить данные" className="grid h-9 w-9 place-items-center rounded-full text-white/75 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white disabled:opacity-40">
                <Icon name="refresh" className={cx('h-4 w-4', syncing && 'animate-spin')} />
              </button>
              <button type="button" onClick={() => setImportOpen(true)} disabled={!source || readOnly} aria-label="Импорт из файла" title="Импорт CSV или Excel" className="hidden h-9 w-9 place-items-center rounded-full text-white/75 transition-colors duration-300 hover:bg-white/[0.08] hover:text-white disabled:opacity-40 sm:grid">
                <Icon name="upload" className="h-4 w-4" />
              </button>
              <Button variant="primary" icon="plus" onClick={openAdd} disabled={!source || readOnly} className="h-9 px-3 sm:px-4">
                <span className="hidden sm:inline">Добавить запись</span>
              </Button>
            </div>
          </div>
        </nav>

        <div className="mx-auto flex max-w-[1400px] flex-col gap-5 pt-4">
          {/* Мобильная панель разделов */}
          <div className="flex flex-wrap items-center justify-between gap-2 md:hidden">
            <div role="tablist" aria-label="Разделы" className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.03] p-0.5 text-[12.5px]">
              {tabs.map(([t, l]) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('rounded-full px-3 py-1 font-medium', tab === t ? 'bg-white/[0.14] text-white' : 'text-white/60')}>
                  {l}
                </button>
              ))}
            </div>
            {modeToggle}
          </div>
          <div className="hidden justify-end md:flex lg:hidden">{modeToggle}</div>

          {/* ---------- Герой ---------- */}
          {tab === 'dashboard' ? (
            <section className="relative grid items-center gap-2 pb-2 pt-2 md:grid-cols-[1.35fr_1fr] md:gap-6 md:pt-6">
              <div className="relative z-10 flex flex-col items-center gap-5 text-center md:items-start md:text-left">
                <p className="rise text-[10px] font-medium uppercase tracking-[0.2em] text-white/75 md:text-[11px]" style={{ animationDelay: '0.1s' }}>
                  Операционные показатели · {periodLabel}
                </p>
                <h1 className="hero-title font-serif-display rise max-w-3xl text-[44px] font-medium leading-[1.02] sm:text-[58px] lg:text-[78px]" style={{ animationDelay: '0.05s' }}>
                  Восемь щупалец —<br className="hidden sm:block" /> <em>один взгляд</em> на&nbsp;все проекты
                </h1>
                <p className="rise flex min-h-[44px] max-w-xl items-start gap-2.5 text-[15px] leading-snug text-white/85 sm:min-h-[24px]" style={{ animationDelay: '0.4s' }}>
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent shadow-[0_0_12px_2px_rgba(190,242,84,0.6)]" aria-hidden="true" />
                  <Typewriter lines={insights} />
                </p>
                <div className="rise flex flex-wrap items-center justify-center gap-3 md:justify-start" style={{ animationDelay: '0.6s' }}>
                  <button type="button" onClick={() => document.getElementById('pm-chart')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="rounded-full border border-white/10 px-8 py-2.5 text-[14px] font-medium text-white/90 backdrop-blur-sm transition-all duration-300 hover:border-white/30 hover:bg-white/[0.03]">
                    Смотреть динамику
                  </button>
                  <button type="button" onClick={() => setTab('records')} className="text-[13px] font-medium tracking-wide text-white/75 transition-colors duration-300 hover:text-white/40">
                    Журнал записей →
                  </button>
                </div>
                <p className="rise text-[11.5px] text-white/40" style={{ animationDelay: '0.8s' }}>
                  Обновлено {formatDateTime(updatedAt)} · синхронизация {formatDateTime(lastSync)}
                </p>
              </div>
              <div className="rise relative order-first mx-auto md:order-none" style={{ animationDelay: '0.2s' }}>
                <Octopus size={420} tipColors={tipColors} tipLabels={allProjects.slice(0, 8)} className="h-auto w-[210px] sm:w-[280px] md:w-full md:max-w-[440px]" />
              </div>
            </section>
          ) : (
            <section className="rise flex items-center gap-4 pt-2">
              <Octopus size={88} tipColors={tipColors} className="h-auto w-[72px] shrink-0 sm:w-[88px]" />
              <div>
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/60 md:text-[11px]">Profimonsters</p>
                <h1 className="hero-title font-serif-display text-[38px] font-medium leading-none sm:text-[52px]">{tab === 'records' ? 'Журнал записей' : <>Источники <em>и показатели</em></>}</h1>
              </div>
            </section>
          )}

          {mode === 'demo' && (
            <div className="glass-pill flex flex-col gap-2 rounded-[22px] border border-accent/25 px-4 py-2.5 text-[13px] text-white/85 sm:flex-row sm:items-center sm:justify-between sm:rounded-full sm:pl-2.5">
              <p className="flex items-center gap-2.5">
                <span className="shrink-0 rounded-full bg-accent px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-accent-ink">Демо</span>
                Примерные значения по вымышленным проектам — не данные компании. Изменения не сохраняются.
              </p>
              <button type="button" onClick={() => switchMode('work')} className="shrink-0 self-start rounded-full border border-white/15 px-4 py-1.5 text-[12.5px] font-medium text-white transition-colors duration-300 hover:border-white/40 sm:self-auto">
                Перейти к рабочим данным
              </button>
            </div>
          )}

        {tab !== 'sources' && (
          <FilterBar filters={filters} setFilters={setFilters} allProjects={allProjects} today={today} onReset={resetFilters} canReset={!isDefaultFilters(filters, today) || granOverride !== null} dark={dark} />
        )}

        {status === 'error' && (
          <div role="alert" className="flex flex-col gap-2 rounded-[22px] border border-bad/30 bg-bad-soft/70 px-4 py-3 text-[13px] sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2">
              <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0 text-bad" />
              <span>
                <b>Не удалось подключиться к источнику данных.</b> {loadError} {lastSync ? `Последняя успешная синхронизация: ${formatDateTime(lastSync)}.` : ''}
              </span>
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => (primary && mode === 'work' ? load(primary) : initPrimary())}>
                Повторить
              </Button>
              {mode === 'work' && (
                <Button size="sm" variant="ghost" onClick={() => switchMode('demo')}>
                  Открыть демо
                </Button>
              )}
            </div>
          </div>
        )}

        {tab === 'sources' ? (
          <SourcesView
            connectors={connectors}
            activeLabel={primary?.label ?? 'База сайта'}
            syncing={syncing}
            onSync={
              sheetConnected
                ? async () => {
                    const ok = await syncSheet();
                    if (ok && primary) {
                      if (mode !== 'work') switchMode('work');
                      else await load(primary);
                    }
                  }
                : undefined
            }
          />
        ) : status === 'loading' || mode === null ? (
          <LoadingState />
        ) : status === 'error' && !records.length ? null : !records.length ? (
          <EmptyState onAdd={openAdd} onImport={() => setImportOpen(true)} onDemo={() => switchMode('demo')} onTemplate={() => save('Шаблон импорта Profimonsters.xlsx', buildTemplate())} readOnly={readOnly} />
        ) : tab === 'records' ? (
          <RecordsView records={records} filters={filters} onEdit={openEdit} onDelete={deleteRecord} onAdd={openAdd} onImport={() => setImportOpen(true)} onExport={(rs) => save('Записи Profimonsters.xlsx', buildExport(rs))} readOnly={readOnly} />
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-serif-display text-[28px] font-medium leading-tight">
                {periodLabel}
                <span className="ml-3 font-sans text-[13px] font-normal text-white/50">сравнение с {prevLabel}</span>
              </h2>
              <span className="text-[12.5px] text-muted">
                {projects.length} {pluralRu(projects.length, 'проект', 'проекта', 'проектов')} · {summaries.length} {pluralRu(summaries.length, 'показатель', 'показателя', 'показателей')} · нажмите на карточку, чтобы открыть её на графике
              </span>
            </div>
            {!periodHasData && (
              <div className="flex flex-col items-start gap-2 rounded-[22px] border border-dashed border-white/15 bg-white/[0.02] px-4 py-3 text-[13px] sm:flex-row sm:items-center sm:justify-between">
                <span>За выбранный период нет ни одной записи по выбранным проектам и показателям.</span>
                {!readOnly && (
                  <Button size="sm" variant="primary" icon="plus" onClick={openAdd}>
                    Добавить запись
                  </Button>
                )}
              </div>
            )}
            <KpiCards summaries={summaries} activeMetric={chartMetric.id} onPick={(id) => setFilters({ ...filters, chartMetric: id })} compareLabel={prevLabel} />
            <div id="pm-chart" className="scroll-mt-24" />
            <MainChart
              metric={chartMetric}
              availableMetrics={metricIds}
              onMetric={(id) => setFilters({ ...filters, chartMetric: id })}
              allProjects={allProjects}
              projects={projects}
              series={series}
              granularity={granularity}
              onGranularity={setGranOverride}
              dark={dark}
              onAdd={openAdd}
              onImport={() => setImportOpen(true)}
              readOnly={readOnly}
            />
            <ProjectTable rows={rows} metric={chartMetric} allProjects={allProjects} dark={dark} periodLabel={periodLabel} prevLabel={prevLabel} />
          </>
        )}
      </div>

      <RecordForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        defaults={{ date: filters.range.to > today ? today : filters.range.to, metricId: chartMetric.id, project: projects.length === 1 ? projects[0] : undefined }}
        projects={allProjects}
        findExisting={(id) => byId.get(id)}
        onSave={saveRecord}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        existingIds={new Set(byId.keys())}
        onImport={importRecords}
        onTemplate={() => save('Шаблон импорта Profimonsters.xlsx', buildTemplate())}
        targetLabel={mode === 'demo' ? 'демо-данные (не сохраняются)' : (source?.label ?? 'база сайта').toLowerCase()}
      />
      </div>
    </div>
  );
}

/** Строки для «печатной машинки» в герое — реальные выводы из данных за период. */
function buildInsights(summaries: MetricSummary[]): string[] {
  const out: string[] = [];
  const withChange = summaries.filter((s) => s.change.trend !== 'none');
  const fmt = (s: MetricSummary) => (s.metric.unit === 'percent' ? formatAbsChange(s.change, s.metric) : formatPctChange(s.change));
  const goods = withChange.filter((s) => s.change.verdict === 'good').sort((a, b) => Math.abs(b.change.pct ?? 0) - Math.abs(a.change.pct ?? 0));
  const bads = withChange.filter((s) => s.change.verdict === 'bad').sort((a, b) => Math.abs(b.change.pct ?? 0) - Math.abs(a.change.pct ?? 0));
  if (goods[0]) out.push(`${goods[0].metric.shortName}: ${fmt(goods[0])} к прошлому периоду`);
  const dip = summaries.find((s) => s.worst && s.metric.id === (bads[0]?.metric.id ?? '')) ?? summaries.find((s) => s.worst);
  if (dip?.worst) out.push(`Сильнее всего просел: ${dip.worst.project} · ${dip.metric.shortName} ${dip.metric.unit === 'percent' ? formatAbsChange(dip.worst.change, dip.metric) : formatPctChange(dip.worst.change)}`);
  if (bads[0]) out.push(`Требует внимания: ${bads[0].metric.shortName} ${fmt(bads[0])}`);
  const plan = summaries.find((s) => s.plan);
  if (plan?.plan) out.push(`План по показателю «${plan.metric.shortName}» выполнен на ${formatPercent(plan.plan.percent)}`);
  if (!out.length) out.push(summaries.some((s) => s.change.current !== null) ? 'Данных для сравнения с прошлым периодом пока мало' : 'За выбранный период данных нет — добавьте записи или загрузите файл');
  return out;
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Загрузка данных">
      <div className="skeleton flex h-[440px] w-full flex-col items-center justify-center gap-3">
        <Octopus size={140} className="h-auto w-[120px] opacity-80" followCursor={false} />
        <p className="text-[13px] text-white/60">Щупальца собирают данные…</p>
      </div>
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-36" />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onAdd, onImport, onDemo, onTemplate, readOnly }: { onAdd: () => void; onImport: () => void; onDemo: () => void; onTemplate: () => void; readOnly: boolean }) {
  return (
    <section className="panel flex flex-col items-center gap-4 px-6 py-14 text-center">
      <Octopus size={180} className="h-auto w-[150px]" />
      <div>
        <h2 className="font-serif-display text-[34px] font-medium leading-tight">Щупальцам пока нечего держать</h2>
        <p className="mx-auto mt-1 max-w-lg text-[13.5px] text-muted">Добавьте первые значения показателей вручную или загрузите файл по шаблону. Пока данных нет, можно посмотреть, как работает дашборд, на демонстрационных значениях.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {!readOnly && (
          <>
            <Button variant="primary" icon="plus" onClick={onAdd}>
              Добавить запись
            </Button>
            <Button icon="upload" onClick={onImport}>
              Импортировать файл
            </Button>
          </>
        )}
        <Button variant="ghost" icon="eye" onClick={onDemo}>
          Посмотреть демо
        </Button>
      </div>
      <button type="button" className="text-[12.5px] font-medium text-white/70 transition-colors hover:text-white" onClick={onTemplate}>
        Скачать шаблон Excel
      </button>
    </section>
  );
}
