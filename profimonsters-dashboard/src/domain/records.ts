import { getMetric } from '@/config/metrics';
import type { MetricRecord, RecordDraft } from './types';

/** Максимальная длина примечания. */
export const NOTE_MAX = 300;

export function normalizeProject(name: string): string {
  return String(name ?? '').replace(/\s+/g, ' ').trim();
}

/** Ключ уникальности: одна запись на дату + проект + показатель. */
export function recordKey(date: string, project: string, metricId: string): string {
  return `${date}|${normalizeProject(project).toLowerCase()}|${metricId}`;
}

/** 53-битный FNV-1a — короткий и стабильный хэш строки. */
export function hash53(str: string): string {
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/** id записи выводится из ключа, поэтому одинаковые записи не могут сосуществовать. */
export function recordId(date: string, project: string, metricId: string): string {
  return 'r' + hash53(recordKey(date, project, metricId));
}

export function finalizeRecord(draft: RecordDraft, now = new Date()): MetricRecord {
  const project = normalizeProject(draft.project);
  const note = draft.note?.trim() ? draft.note.trim().slice(0, NOTE_MAX) : undefined;
  return {
    id: recordId(draft.date, project, draft.metricId),
    date: draft.date,
    project,
    metricId: draft.metricId,
    value: draft.value,
    plan: draft.plan ?? null,
    ...(note ? { note } : {}),
    updatedAt: draft.updatedAt ?? now.toISOString(),
    source: draft.source || 'manual',
  };
}

export interface FieldErrors {
  date?: string;
  project?: string;
  metricId?: string;
  value?: string;
  plan?: string;
  note?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidISODate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/**
 * Проверка записи. Используется формой, импортом и сервером — правила одни на всё приложение.
 * value/plan приходят числом или null (пустое поле).
 */
export function validateDraft(d: {
  date: string;
  project: string;
  metricId: string;
  value: number | null;
  plan?: number | null;
  note?: string;
}): FieldErrors {
  const e: FieldErrors = {};
  if (!d.date) e.date = 'Укажите дату';
  else if (!isValidISODate(d.date)) e.date = 'Дата в формате ГГГГ-ММ-ДД';

  if (!normalizeProject(d.project)) e.project = 'Укажите проект';
  else if (normalizeProject(d.project).length > 80) e.project = 'Не длиннее 80 символов';

  const metric = getMetric(d.metricId);
  if (!d.metricId) e.metricId = 'Выберите показатель';
  else if (!metric) e.metricId = 'Неизвестный показатель';

  const checkNum = (v: number | null | undefined, field: 'value' | 'plan', required: boolean) => {
    if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) {
      if (required) e[field] = 'Введите число';
      return;
    }
    if (!Number.isFinite(v)) {
      e[field] = 'Введите число';
      return;
    }
    if (metric && !metric.allowNegative && v < 0) e[field] = 'Отрицательное значение невозможно';
    else if (metric?.max !== undefined && v > metric.max) e[field] = `Не больше ${metric.max}`;
    else if (metric?.id === 'nps' && v < -100) e[field] = 'Не меньше −100';
  };
  checkNum(d.value, 'value', true);
  checkNum(d.plan, 'plan', false);

  if (d.note && d.note.length > NOTE_MAX) e.note = `Не длиннее ${NOTE_MAX} символов`;
  return e;
}

export function hasErrors(e: FieldErrors): boolean {
  return Object.keys(e).length > 0;
}

/** Разбор числа из поля ввода или ячейки: «1 234,5», «34,5%», «12 000 ₽». */
export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const s = String(raw)
    .replace(/[\s  ]/g, '')
    .replace(/[₽%]|руб\.?|р\./gi, '')
    .replace('−', '-')
    .replace(',', '.');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
