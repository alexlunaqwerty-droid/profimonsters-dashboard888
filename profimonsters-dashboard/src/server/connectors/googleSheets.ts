import 'server-only';
import { buildPreview, rowsFromCsvText, type ImportIssue } from '@/data/import/importer';
import { getRepository } from '@/server/repository';

/**
 * Google Таблицы через ссылку на CSV.
 * В Netlify задаётся переменная GOOGLE_SHEET_CSV_URL — одна из ссылок:
 *  - «Файл → Поделиться → Опубликовать в интернете → CSV» (…/pub?output=csv), или
 *  - обычная ссылка на таблицу с доступом «Все, у кого есть ссылка — читатель» (…/edit#gid=0).
 * Формат листа тот же, что у импорта: Дата · Проект · Показатель · Значение · План · Примечание.
 * Строки таблицы перезаписывают совпадающие записи (та же дата, проект и показатель);
 * записи, внесённые на сайте вручную и отсутствующие в таблице, не удаляются.
 */
export const GOOGLE_SHEET_ENV = 'GOOGLE_SHEET_CSV_URL';
export const SOURCE_NAME = 'google-sheets';

export function isGoogleSheetConfigured(): boolean {
  return !!process.env[GOOGLE_SHEET_ENV]?.trim();
}

/** Приводит любую ссылку на Google Таблицу к адресу выгрузки CSV. */
export function toCsvUrl(raw: string): string {
  const url = raw.trim();
  if (!/^https:\/\/docs\.google\.com\/spreadsheets\//.test(url)) {
    throw new Error('Ссылка должна начинаться с https://docs.google.com/spreadsheets/');
  }
  if (/\/pub(\?|$)/.test(url) || /output=csv|format=csv/.test(url)) {
    return url.includes('output=') ? url : url + (url.includes('?') ? '&' : '?') + 'output=csv';
  }
  const id = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  if (!id) throw new Error('Не удалось найти идентификатор таблицы в ссылке');
  const gid = url.match(/[#&?]gid=(\d+)/)?.[1] ?? '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export interface SheetSyncResult {
  ok: true;
  totalRows: number;
  added: number;
  replaced: number;
  skipped: number;
  issues: ImportIssue[];
  syncedAt: string;
}

export async function syncGoogleSheet(): Promise<SheetSyncResult> {
  const raw = process.env[GOOGLE_SHEET_ENV];
  if (!raw?.trim()) throw new Error(`Google Таблица не подключена: задайте ${GOOGLE_SHEET_ENV} в настройках Netlify`);
  const url = toCsvUrl(raw);

  let res: Response;
  try {
    res = await fetch(url, { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(20000) });
  } catch {
    throw new Error('Google Таблица не ответила. Повторите через минуту.');
  }
  const text = await res.text();
  if (!res.ok || /^\s*<(!doctype|html)/i.test(text)) {
    throw new Error('Нет доступа к таблице. Проверьте, что она опубликована в интернете как CSV или открыта по ссылке для просмотра.');
  }

  const repo = getRepository();
  const existing = new Set((await repo.list()).map((r) => r.id));
  const preview = buildPreview(rowsFromCsvText(text), 'csv', existing, SOURCE_NAME);
  if (preview.missingColumns.length) {
    throw new Error(`В таблице не найдены колонки: ${preview.missingColumns.join(', ')}. Первая строка листа — заголовки, как в шаблоне.`);
  }
  const bulk = preview.records.length ? await repo.bulk(preview.records, 'replace') : { added: 0, replaced: 0, skipped: 0 };
  return { ok: true, totalRows: preview.totalRows, ...bulk, issues: preview.issues.slice(0, 50), syncedAt: new Date().toISOString() };
}
