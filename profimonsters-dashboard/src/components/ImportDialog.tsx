'use client';
import { useEffect, useRef, useState } from 'react';
import { pluralRu } from '@/analytics/format';
import { buildPreview, IMPORT_COLUMNS, readSpreadsheet, type ImportPreview } from '@/data/import/importer';
import type { BulkMode, BulkResult } from '@/data/sources/types';
import type { MetricRecord } from '@/domain/types';
import { Button, cx, Icon, Modal } from './ui';

interface Props {
  open: boolean;
  onClose: () => void;
  existingIds: Set<string>;
  onImport: (records: MetricRecord[], mode: BulkMode) => Promise<BulkResult>;
  onTemplate: () => void;
  targetLabel: string;
}

export function ImportDialog({ open, onClose, existingIds, onImport, onTemplate, targetLabel }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<BulkMode>('replace');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setFile(null);
      setPreview(null);
      setErr('');
      setMode('replace');
    }
  }, [open]);

  const handle = async (f: File) => {
    setFile(f);
    setErr('');
    setPreview(null);
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) return setErr('Поддерживаются файлы .csv, .xlsx и .xls');
    if (f.size > 15 * 1024 * 1024) return setErr('Файл больше 15 МБ. Разбейте его на части.');
    try {
      const { rows, kind } = await readSpreadsheet(f);
      setPreview(buildPreview(rows, kind, existingIds));
    } catch {
      setErr('Не удалось прочитать файл. Проверьте, что это CSV или Excel и он не защищён паролем.');
    }
  };

  const run = async () => {
    if (!preview?.records.length) return;
    setBusy(true);
    try {
      await onImport(preview.records, mode);
      onClose();
    } catch (e) {
      setErr((e as Error).message || 'Импорт не выполнен');
    } finally {
      setBusy(false);
    }
  };

  const ok = preview && !preview.missingColumns.length && preview.records.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      wide
      title="Импорт из CSV или Excel"
      footer={
        <>
          <Button variant="ghost" icon="download" onClick={onTemplate} className="mr-auto">
            Скачать шаблон
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" icon="upload" disabled={!ok || busy} onClick={run}>
            {busy ? 'Загружаем…' : ok ? `Загрузить ${preview!.records.length} ${pluralRu(preview!.records.length, 'запись', 'записи', 'записей')}` : 'Загрузить'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) handle(f);
          }}
          className={cx('flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-colors', drag ? 'border-primary bg-primary-soft' : 'border-line')}
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon name="upload" className="h-5 w-5" />
          </span>
          <p className="text-[13.5px]">
            {file ? <span className="font-medium">{file.name}</span> : 'Перетащите файл сюда или'}{' '}
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => inputRef.current?.click()}>
              {file ? 'выбрать другой' : 'выберите на компьютере'}
            </button>
          </p>
          <p className="text-[12px] text-muted">Данные попадут в: {targetLabel}</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handle(f);
              e.target.value = '';
            }}
          />
        </div>

        {err && (
          <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-[13px] text-bad">
            {err}
          </p>
        )}

        {preview && preview.missingColumns.length > 0 && (
          <div role="alert" className="rounded-xl bg-bad-soft px-3 py-2.5 text-[13px] text-ink">
            <p className="font-semibold text-bad">Не найдены обязательные колонки: {preview.missingColumns.join(', ')}</p>
            <p className="text-ink2">Первая строка файла должна содержать заголовки, как в шаблоне.</p>
          </div>
        )}

        {preview && !preview.missingColumns.length && (
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label="Строк в файле" value={preview.totalRows} />
              <Stat label="Готово к загрузке" value={preview.records.length} tone="good" />
              <Stat label="С ошибками" value={preview.issues.length} tone={preview.issues.length ? 'bad' : undefined} />
              <Stat label="Уже есть в данных" value={preview.existing} />
            </div>
            {preview.duplicatesInFile > 0 && (
              <p className="text-[12.5px] text-muted">
                В файле {preview.duplicatesInFile} {pluralRu(preview.duplicatesInFile, 'повтор', 'повтора', 'повторов')} одной и той же записи — оставлено последнее значение.
              </p>
            )}
            {preview.existing > 0 && (
              <fieldset className="flex flex-col gap-1.5 rounded-xl bg-surface2 p-3 text-[13px]">
                <legend className="sr-only">Что делать с совпадающими записями</legend>
                <p className="font-medium">
                  {preview.existing} {pluralRu(preview.existing, 'запись совпадает', 'записи совпадают', 'записей совпадают')} с существующими по дате, проекту и показателю:
                </p>
                <label className="flex items-center gap-2">
                  <input type="radio" name="imp-mode" className="accent-[rgb(var(--primary))]" checked={mode === 'replace'} onChange={() => setMode('replace')} />
                  Заменить значениями из файла
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="imp-mode" className="accent-[rgb(var(--primary))]" checked={mode === 'skip'} onChange={() => setMode('skip')} />
                  Оставить существующие, загрузить только новые
                </label>
              </fieldset>
            )}
            {preview.issues.length > 0 && (
              <div className="rounded-xl border border-line">
                <p className="border-b border-line px-3 py-2 text-[12.5px] font-medium">Строки с ошибками не будут загружены</p>
                <ul className="scroll-thin max-h-40 overflow-y-auto px-3 py-2 text-[12.5px]">
                  {preview.issues.slice(0, 50).map((i) => (
                    <li key={i.row} className="py-0.5">
                      <span className="tnum text-muted">Строка {i.row}:</span> {i.message}
                    </li>
                  ))}
                  {preview.issues.length > 50 && <li className="py-0.5 text-muted">и ещё {preview.issues.length - 50}</li>}
                </ul>
              </div>
            )}
          </div>
        )}

        <details className="rounded-xl bg-surface2 px-3 py-2 text-[12.5px]">
          <summary className="cursor-pointer font-medium">Формат файла</summary>
          <p className="mt-2 text-ink2">Одна строка — одна запись. Порядок колонок не важен, названия — как в таблице:</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left">
              <tbody>
                {IMPORT_COLUMNS.map((c) => (
                  <tr key={c.key} className="border-t border-white/[0.06]">
                    <td className="py-1 pr-3 font-medium">
                      {c.title}
                      {c.required && <span className="text-bad"> *</span>}
                    </td>
                    <td className="py-1 text-ink2">{c.hint}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </Modal>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'good' | 'bad' }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <div className="text-[11.5px] text-muted">{label}</div>
      <div className={cx('text-lg font-semibold tnum', tone === 'good' && 'text-good', tone === 'bad' && 'text-bad')}>{value}</div>
    </div>
  );
}
