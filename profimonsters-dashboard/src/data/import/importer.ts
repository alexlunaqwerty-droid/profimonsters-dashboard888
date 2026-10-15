import * as XLSX from 'xlsx';
import { findMetricByName, getMetric, METRICS, UNIT_LABELS } from '@/config/metrics';
import { finalizeRecord, hasErrors, isValidISODate, parseNumber, validateDraft } from '@/domain/records';
import type { MetricRecord } from '@/domain/types';
import { toISO } from '@/filters/period';

/**
 * Импорт CSV и Excel. Формат «длинный»: одна строка = одна запись.
 * Колонки распознаются по названию (регистр и порядок не важны).
 */
export const IMPORT_COLUMNS = [
  { key: 'date', title: 'Дата', required: true, hint: 'ДД.ММ.ГГГГ или ГГГГ-ММ-ДД' },
  { key: 'project', title: 'Проект', required: true, hint: 'Название проекта' },
  { key: 'metric', title: 'Показатель', required: true, hint: 'Название из списка показателей' },
  { key: 'value', title: 'Значение', required: true, hint: 'Число; проценты — числом (34,5)' },
  { key: 'plan', title: 'План', required: false, hint: 'Число, можно оставить пустым' },
  { key: 'note', title: 'Примечание', required: false, hint: 'Текст до 300 символов' },
] as const;

type ColKey = (typeof IMPORT_COLUMNS)[number]['key'];

const HEADER_ALIASES: Record<ColKey, string[]> = {
  date: ['дата', 'date', 'день'],
  project: ['проект', 'project', 'название проекта'],
  metric: ['показатель', 'метрика', 'metric', 'название показателя'],
  value: ['значение', 'value', 'факт', 'кол-во', 'количество'],
  plan: ['план', 'plan', 'плановое значение'],
  note: ['примечание', 'комментарий', 'note', 'comment'],
};

export interface ImportIssue {
  row: number; // номер строки в файле (с учётом заголовка)
  message: string;
}

export interface ImportPreview {
  records: MetricRecord[];
  issues: ImportIssue[];
  totalRows: number;
  /** Строки, повторяющие одну и ту же запись внутри файла (оставлена последняя). */
  duplicatesInFile: number;
  /** Записи, которые уже есть в данных. */
  existing: number;
  missingColumns: string[];
  source: string;
}

function parseDateCell(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return toISO(v);
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(v ?? '').trim();
  if (isValidISODate(s)) return s;
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? '20' + m[3] : m[3];
    const iso = `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    return isValidISODate(iso) ? iso : null;
  }
  return null;
}

export async function readSpreadsheet(file: File): Promise<{ rows: unknown[][]; kind: 'csv' | 'xlsx' }> {
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  let wb: XLSX.WorkBook;
  if (isCsv) {
    let text = new TextDecoder('utf-8').decode(buf);
    if (text.includes('�')) text = new TextDecoder('windows-1251').decode(buf);
    return { rows: rowsFromCsvText(text), kind: 'csv' };
  } else {
    wb = XLSX.read(buf, { type: 'array', cellDates: true });
  }
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: false });
  return { rows, kind: isCsv ? 'csv' : 'xlsx' };
}

/** Разбор текста CSV (разделитель «,» или «;» определяется по первой строке). Значения остаются строками. */
export function rowsFromCsvText(text: string): unknown[][] {
  const firstLine = text.replace(/^\uFEFF/, '').split(/\r?\n/)[0] ?? '';
  const FS = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const wb = XLSX.read(text.replace(/^\uFEFF/, ''), { type: 'string', FS, raw: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true, blankrows: false });
}

export function buildPreview(rows: unknown[][], kind: 'csv' | 'xlsx', existingIds: Set<string>, sourceName?: string): ImportPreview {
  const source = sourceName ?? `import:${kind}`;
  const issues: ImportIssue[] = [];
  // Заголовок — первая строка, где нашлись хотя бы «дата» и «значение».
  let headerRow = -1;
  let map: Partial<Record<ColKey, number>> = {};
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const m: Partial<Record<ColKey, number>> = {};
    rows[i].forEach((cell, ci) => {
      const h = String(cell ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
      for (const key of Object.keys(HEADER_ALIASES) as ColKey[]) if (m[key] === undefined && HEADER_ALIASES[key].includes(h)) m[key] = ci;
    });
    if (m.date !== undefined && m.value !== undefined) {
      headerRow = i;
      map = m;
      break;
    }
  }
  const missingColumns = IMPORT_COLUMNS.filter((c) => c.required && map[c.key] === undefined).map((c) => c.title);
  if (headerRow < 0 || missingColumns.length) {
    return {
      records: [],
      issues: [],
      totalRows: Math.max(0, rows.length - 1),
      duplicatesInFile: 0,
      existing: 0,
      missingColumns: missingColumns.length ? missingColumns : IMPORT_COLUMNS.filter((c) => c.required).map((c) => c.title),
      source,
    };
  }

  const byId = new Map<string, MetricRecord>();
  let duplicatesInFile = 0;
  const now = new Date();
  const dataRows = rows.slice(headerRow + 1);
  dataRows.forEach((row, i) => {
    const line = headerRow + i + 2;
    const cell = (k: ColKey) => (map[k] === undefined ? null : row[map[k] as number]);
    if (row.every((c) => c === null || String(c).trim() === '')) return;
    const date = parseDateCell(cell('date'));
    const metricRaw = String(cell('metric') ?? '').trim();
    const metric = findMetricByName(metricRaw);
    const value = parseNumber(cell('value'));
    const plan = parseNumber(cell('plan'));
    const project = String(cell('project') ?? '').trim();
    const note = cell('note') === null ? undefined : String(cell('note'));

    if (!date) return issues.push({ row: line, message: `Не распознана дата «${String(cell('date') ?? '')}»` });
    if (!metric) return issues.push({ row: line, message: metricRaw ? `Неизвестный показатель «${metricRaw}»` : 'Не указан показатель' });
    const errs = validateDraft({ date, project, metricId: metric.id, value, plan, note });
    if (hasErrors(errs)) {
      const first = Object.entries(errs)[0];
      const fieldNames: Record<string, string> = { project: 'Проект', value: 'Значение', plan: 'План', note: 'Примечание', date: 'Дата', metricId: 'Показатель' };
      return issues.push({ row: line, message: `${fieldNames[first[0]] ?? first[0]}: ${first[1]}` });
    }
    const rec = finalizeRecord({ date, project, metricId: metric.id, value: value as number, plan, note, source }, now);
    if (byId.has(rec.id)) duplicatesInFile++;
    byId.set(rec.id, rec);
  });

  const records = [...byId.values()];
  return {
    records,
    issues,
    totalRows: dataRows.filter((r) => !r.every((c) => c === null || String(c).trim() === '')).length,
    duplicatesInFile,
    existing: records.filter((r) => existingIds.has(r.id)).length,
    missingColumns: [],
    source,
  };
}

/** Шаблон для заполнения: заголовки, две строки-примера и лист со списком показателей. */
export function buildTemplate(): Blob {
  const wb = XLSX.utils.book_new();
  const example = [
    IMPORT_COLUMNS.map((c) => c.title),
    ['01.10.2026', 'Название проекта', 'Количество лидов', 120, 150, 'Пример строки — удалите'],
    ['01.10.2026', 'Название проекта', 'Конверсия из лида в оформленного и назначенного на стаж', 34.5, '', 'Проценты — числом'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(example);
  ws['!cols'] = [{ wch: 12 }, { wch: 22 }, { wch: 52 }, { wch: 12 }, { wch: 10 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Данные');
  const ref = XLSX.utils.aoa_to_sheet([['Показатель', 'Единица', 'Можно отрицательное'], ...METRICS.map((m) => [m.name, UNIT_LABELS[m.unit], m.allowNegative ? 'да' : 'нет'])]);
  ref['!cols'] = [{ wch: 58 }, { wch: 10 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ref, 'Показатели');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Выгрузка записей в Excel в том же формате, что и импорт. */
export function buildExport(records: MetricRecord[]): Blob {
  const rows = [
    [...IMPORT_COLUMNS.map((c) => c.title), 'Источник', 'Обновлено'],
    ...records.map((r) => [r.date, r.project, getMetric(r.metricId)?.name ?? r.metricId, r.value, r.plan ?? '', r.note ?? '', r.source, r.updatedAt]),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Данные');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
