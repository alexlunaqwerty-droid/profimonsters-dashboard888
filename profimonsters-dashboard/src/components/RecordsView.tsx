'use client';
import { useEffect, useMemo, useState } from 'react';
import { formatValue, pluralRu } from '@/analytics/format';
import { getMetric } from '@/config/metrics';
import type { MetricRecord } from '@/domain/types';
import { queryRecords, type FilterState } from '@/filters/filters';
import { formatDateShort, formatDateTime, formatRange } from '@/filters/period';
import { Button, cx, Icon, inputCls } from './ui';

const PAGE = 50;

const SOURCE_LABEL: Record<string, string> = { manual: 'Вручную', demo: 'Демо', 'import:csv': 'CSV', 'import:xlsx': 'Excel', 'google-sheets': 'Google Таблица' };

export function RecordsView({
  records,
  filters,
  onEdit,
  onDelete,
  onAdd,
  onImport,
  onExport,
  readOnly,
}: {
  records: MetricRecord[];
  filters: FilterState;
  onEdit: (r: MetricRecord) => void;
  onDelete: (r: MetricRecord) => Promise<void>;
  onAdd: () => void;
  onImport: () => void;
  onExport: (rows: MetricRecord[]) => void;
  readOnly: boolean;
}) {
  const [text, setText] = useState('');
  const [page, setPage] = useState(0);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const rows = useMemo(
    () => queryRecords(records, { range: filters.range, projects: filters.projects, metrics: filters.metrics, text }),
    [records, filters.range, filters.projects, filters.metrics, text],
  );
  useEffect(() => setPage(0), [filters, text]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const shown = rows.slice(page * PAGE, page * PAGE + PAGE);

  return (
    <section className="panel" aria-label="Журнал записей">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="font-serif-display text-[28px] font-medium leading-tight">Журнал записей</h2>
          <p className="text-[12.5px] text-muted">
            {formatRange(filters.range)} · {rows.length} {pluralRu(rows.length, 'запись', 'записи', 'записей')} с учётом фильтров
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Icon name="search" className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input aria-label="Поиск по проекту или примечанию" className={cx(inputCls, 'h-9 w-56 pl-8')} placeholder="Проект или примечание" value={text} onChange={(e) => setText(e.target.value)} />
          </div>
          <Button size="sm" icon="download" onClick={() => onExport(rows)} disabled={!rows.length}>
            Выгрузить
          </Button>
        </div>
      </div>

      {!rows.length ? (
        <div className="flex flex-col items-center gap-3 border-t border-white/[0.06] px-6 py-14 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary-soft text-primary">
            <Icon name="table" className="h-5 w-5" />
          </span>
          <h3 className="font-semibold">{records.length ? 'Под фильтры не попала ни одна запись' : 'Записей пока нет'}</h3>
          <p className="max-w-md text-[13px] text-muted">{records.length ? 'Измените период, проекты или показатели.' : 'Добавьте первую запись вручную или загрузите файл CSV или Excel.'}</p>
          {!readOnly && (
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon="plus" onClick={onAdd}>
                Добавить запись
              </Button>
              <Button icon="upload" onClick={onImport}>
                Импортировать файл
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="scroll-thin overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[13px]">
              <thead className="border-y border-white/[0.06] bg-white/[0.025] text-[12px] text-muted">
                <tr>
                  <th scope="col" className="px-3 py-2.5 font-medium">Дата</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Проект</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Показатель</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Значение</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">План</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Примечание</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Источник</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Обновлено</th>
                  <th scope="col" className="w-28 px-3 py-2.5"><span className="sr-only">Действия</span></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const m = getMetric(r.metricId);
                  return (
                    <tr key={r.id} className="border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03]">
                      <td className="whitespace-nowrap px-3 py-2 tnum">{formatDateShort(r.date)} {r.date.slice(0, 4)}</td>
                      <td className="px-3 py-2 font-medium">{r.project}</td>
                      <td className="max-w-[16rem] truncate px-3 py-2 text-ink2" title={m?.name}>{m?.shortName ?? r.metricId}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tnum">{m ? formatValue(r.value, m) : r.value}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-ink2 tnum">{m && r.plan !== null && r.plan !== undefined ? formatValue(r.plan, m) : '—'}</td>
                      <td className="max-w-[14rem] truncate px-3 py-2 text-ink2" title={r.note}>{r.note || <span className="text-muted">—</span>}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-ink2">{SOURCE_LABEL[r.source] ?? r.source}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-[12px] text-muted">{formatDateTime(r.updatedAt)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {readOnly ? null : confirmId === r.id ? (
                          <span className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              className="rounded-lg bg-bad px-2 py-1 text-[12px] font-medium text-white hover:bg-bad/90 disabled:opacity-50"
                              disabled={busy === r.id}
                              onClick={async () => {
                                setBusy(r.id);
                                try {
                                  await onDelete(r);
                                } finally {
                                  setBusy(null);
                                  setConfirmId(null);
                                }
                              }}
                            >
                              Удалить
                            </button>
                            <button type="button" className="rounded-lg px-2 py-1 text-[12px] text-ink2 hover:bg-surface2" onClick={() => setConfirmId(null)}>
                              Отмена
                            </button>
                          </span>
                        ) : (
                          <span className="inline-flex gap-0.5">
                            <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-primary-soft hover:text-primary" aria-label="Изменить запись" onClick={() => onEdit(r)}>
                              <Icon name="edit" />
                            </button>
                            <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-bad-soft hover:text-bad" aria-label="Удалить запись" onClick={() => setConfirmId(r.id)}>
                              <Icon name="trash" />
                            </button>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-3 text-[13px] sm:px-5">
              <span className="text-muted">
                Страница {page + 1} из {pages}
              </span>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  Назад
                </Button>
                <Button size="sm" variant="ghost" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>
                  Вперёд
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
