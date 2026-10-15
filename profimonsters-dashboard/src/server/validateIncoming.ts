import 'server-only';
import { finalizeRecord, hasErrors, validateDraft } from '@/domain/records';
import type { MetricRecord } from '@/domain/types';

/** Повторная проверка на сервере: клиенту не доверяем, id пересчитываем из ключа. */
export function sanitizeRecord(input: unknown): { record?: MetricRecord; error?: string } {
  const r = (input ?? {}) as Partial<MetricRecord>;
  const draft = {
    date: String(r.date ?? ''),
    project: String(r.project ?? ''),
    metricId: String(r.metricId ?? ''),
    value: typeof r.value === 'number' ? r.value : null,
    plan: typeof r.plan === 'number' ? r.plan : null,
    note: typeof r.note === 'string' ? r.note : undefined,
  };
  const errs = validateDraft(draft);
  if (hasErrors(errs)) return { error: Object.values(errs).join('; ') };
  return {
    record: finalizeRecord({ ...draft, value: draft.value as number, source: typeof r.source === 'string' ? r.source.slice(0, 40) : 'manual' }),
  };
}
