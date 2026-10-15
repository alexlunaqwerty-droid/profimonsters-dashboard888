import 'server-only';
import { promises as fs } from 'fs';
import path from 'path';
import { getStore } from '@netlify/blobs';
import type { MetricRecord } from '@/domain/types';
import type { BulkMode, BulkResult } from '@/data/sources/types';

/**
 * Хранилище записей на сервере.
 *  - на Netlify — Netlify Blobs (включается само, без настроек);
 *  - локально и на обычном сервере — JSON-файл data/records.json.
 * Для перехода на PostgreSQL достаточно реализовать RecordRepository (схема — db/schema.sql).
 * Уникальность (дата + проект + показатель) гарантируется id записи, выведенным из этого ключа.
 */
export interface RecordRepository {
  readonly kind: string;
  list(): Promise<MetricRecord[]>;
  upsert(record: MetricRecord, opts: { overwrite: boolean; replaceId?: string }): Promise<{ record: MetricRecord; duplicate?: MetricRecord }>;
  remove(id: string): Promise<boolean>;
  bulk(records: MetricRecord[], mode: BulkMode): Promise<BulkResult>;
}

/** Где физически лежит массив записей. */
interface Backend {
  readonly kind: string;
  read(): Promise<MetricRecord[]>;
  write(records: MetricRecord[]): Promise<void>;
}

class FileBackend implements Backend {
  readonly kind = 'file';
  constructor(private file: string) {}
  async read() {
    try {
      return JSON.parse(await fs.readFile(this.file, 'utf8')) as MetricRecord[];
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw e;
    }
  }
  /** Атомарная запись: во временный файл, затем переименование. */
  async write(records: MetricRecord[]) {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(records), 'utf8');
    await fs.rename(tmp, this.file);
  }
}

class NetlifyBlobsBackend implements Backend {
  readonly kind = 'netlify-blobs';
  constructor(private store: ReturnType<typeof getStore>) {}
  async read() {
    return ((await this.store.get('records', { type: 'json' })) as MetricRecord[] | null) ?? [];
  }
  async write(records: MetricRecord[]) {
    await this.store.setJSON('records', records);
  }
}

class Repository implements RecordRepository {
  private lock: Promise<unknown> = Promise.resolve();
  constructor(private backend: Backend) {}

  get kind() {
    return this.backend.kind;
  }

  /** Изменения внутри одного процесса выполняются строго по очереди. */
  private exclusive<T>(fn: (map: Map<string, MetricRecord>) => Promise<T>): Promise<T> {
    const run = async () => {
      const map = new Map((await this.backend.read()).map((r) => [r.id, r]));
      return fn(map);
    };
    const next = this.lock.then(run, run);
    this.lock = next.catch(() => undefined);
    return next;
  }

  async list() {
    return this.backend.read();
  }

  upsert(record: MetricRecord, opts: { overwrite: boolean; replaceId?: string }) {
    return this.exclusive(async (map) => {
      const existing = map.get(record.id);
      if (existing && !opts.overwrite && opts.replaceId !== record.id) return { record, duplicate: existing };
      if (opts.replaceId && opts.replaceId !== record.id) map.delete(opts.replaceId);
      map.set(record.id, record);
      await this.backend.write([...map.values()]);
      return { record };
    });
  }

  remove(id: string) {
    return this.exclusive(async (map) => {
      const had = map.delete(id);
      if (had) await this.backend.write([...map.values()]);
      return had;
    });
  }

  bulk(records: MetricRecord[], mode: BulkMode) {
    return this.exclusive(async (map) => {
      const res: BulkResult = { added: 0, replaced: 0, skipped: 0 };
      for (const r of records) {
        if (map.has(r.id)) {
          if (mode === 'skip') {
            res.skipped++;
            continue;
          }
          res.replaced++;
        } else res.added++;
        map.set(r.id, r);
      }
      await this.backend.write([...map.values()]);
      return res;
    });
  }
}

function pickBackend(): Backend {
  if (process.env.STORAGE !== 'file') {
    try {
      // Вне Netlify getStore бросает ошибку — тогда используем файл.
      return new NetlifyBlobsBackend(getStore({ name: 'profimonsters-dashboard', consistency: 'strong' }));
    } catch {
      /* не Netlify */
    }
  }
  return new FileBackend(process.env.DATA_FILE || path.join(process.cwd(), 'data', 'records.json'));
}

const globalForRepo = globalThis as unknown as { __pmRepo?: RecordRepository };

export function getRepository(): RecordRepository {
  if (!globalForRepo.__pmRepo) {
    globalForRepo.__pmRepo = new Repository(pickBackend());
  }
  return globalForRepo.__pmRepo;
}
