import type { MetricRecord } from '@/domain/types';
import {
  DuplicateRecordError,
  SourceUnavailableError,
  type BulkMode,
  type BulkResult,
  type DataSource,
  type SaveOptions,
} from './types';

/** База сайта через API Next.js (/api/records). */
export class HttpSource implements DataSource {
  readonly kind = 'site-db' as const;
  readonly label = 'База сайта';
  readonly ephemeral = false;
  readonly readOnly = false;

  constructor(private base = '/api/records') {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(this.base + path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
        cache: 'no-store',
      });
    } catch {
      throw new SourceUnavailableError('Сервер недоступен. Проверьте подключение и повторите.');
    }
    const body = await res.json().catch(() => ({}));
    if (res.status === 409 && body.existing) throw new DuplicateRecordError(body.existing);
    if (!res.ok) throw new SourceUnavailableError(body.error || `Ошибка сервера (${res.status})`);
    return body as T;
  }

  async load(): Promise<MetricRecord[]> {
    const { records } = await this.call<{ records: MetricRecord[] }>('');
    return records;
  }

  async save(record: MetricRecord, opts: SaveOptions): Promise<MetricRecord> {
    const { record: saved } = await this.call<{ record: MetricRecord }>('', {
      method: 'POST',
      body: JSON.stringify({ record, ...opts }),
    });
    return saved;
  }

  async remove(id: string): Promise<void> {
    await this.call(`/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async bulkSave(records: MetricRecord[], mode: BulkMode): Promise<BulkResult> {
    return this.call<BulkResult>('/bulk', { method: 'POST', body: JSON.stringify({ records, mode }) });
  }
}
