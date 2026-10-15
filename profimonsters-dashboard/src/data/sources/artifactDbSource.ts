import { hash53 } from '@/domain/records';
import type { MetricRecord } from '@/domain/types';
import {
  DuplicateRecordError,
  SourceUnavailableError,
  type BulkMode,
  type BulkResult,
  type DataSource,
  type SaveOptions,
} from './types';

/**
 * База опубликованной версии сайта (claude.ai Artifact, capability `db`).
 * Записи хранятся пачками: один документ = проект × половина месяца.
 * Так документов немного, а один документ остаётся далеко от лимита в 256 КБ.
 */

/* Минимальные типы платформенного API — только то, что используется. */
interface DbSnap {
  id: string;
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}
interface DbDocRef {
  get(): Promise<DbSnap>;
  set(d: Record<string, unknown>): Promise<void>;
  update(d: Record<string, unknown>): Promise<void>;
}
interface DbCollection {
  doc(id: string): DbDocRef;
  onSnapshot(next: (s: { docs: DbSnap[] }) => void, err?: (e: { code: string; message: string }) => void): () => void;
  get(): Promise<{ docs: DbSnap[] }>;
}
export interface ArtifactDb {
  collection(path: string): DbCollection;
}

const COLLECTION = 'chunks';

function chunkId(r: Pick<MetricRecord, 'project' | 'date'>): string {
  const half = Number(r.date.slice(8, 10)) <= 15 ? 'a' : 'b';
  return `c${hash53(r.project.toLowerCase())}_${r.date.slice(0, 7)}${half}`;
}

type ChunkBody = { project: string; period: string; records: Record<string, MetricRecord | null> };

function flatten(docs: DbSnap[]): MetricRecord[] {
  const out: MetricRecord[] = [];
  for (const d of docs) {
    const body = d.data() as ChunkBody | undefined;
    if (!body?.records) continue;
    for (const r of Object.values(body.records)) if (r && typeof r === 'object' && r.id) out.push(r);
  }
  return out;
}

function explain(e: unknown): Error {
  const code = (e as { code?: string })?.code;
  if (code === 'quota_exceeded') return new SourceUnavailableError('В базе закончилось место. Удалите старые записи и повторите.');
  if (code === 'invalid_argument') return new SourceUnavailableError('Нет прав на изменение данных в этой базе.');
  if (code === 'resource_exhausted') return new SourceUnavailableError('Слишком много запросов подряд. Подождите немного и повторите.');
  return new SourceUnavailableError('База временно недоступна. Повторите через минуту.');
}

export class ArtifactDbSource implements DataSource {
  readonly kind = 'artifact-db' as const;
  readonly label = 'База сайта';
  readonly ephemeral = false;
  readonly readOnly = false;

  private cache = new Map<string, MetricRecord>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private db: ArtifactDb) {}

  private col() {
    return this.db.collection(COLLECTION);
  }

  private setCache(records: MetricRecord[]) {
    this.cache = new Map(records.map((r) => [r.id, r]));
  }

  async load(): Promise<MetricRecord[]> {
    try {
      const snap = await this.col().get();
      const recs = flatten(snap.docs);
      this.setCache(recs);
      return recs;
    } catch (e) {
      throw explain(e);
    }
  }

  subscribe(onChange: (r: MetricRecord[]) => void, onError: (e: Error) => void): () => void {
    return this.col().onSnapshot(
      (s) => {
        const recs = flatten(s.docs);
        this.setCache(recs);
        onChange(recs);
      },
      (e) => onError(explain(e)),
    );
  }

  /** Записи в базу идут строго по одной, чтобы не было параллельной записи в один документ. */
  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.queue.then(fn, fn);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async patchChunk(sample: Pick<MetricRecord, 'project' | 'date'>, patch: Record<string, MetricRecord | null>) {
    const ref = this.col().doc(chunkId(sample));
    const snap = await ref.get();
    if (snap.exists) await ref.update({ records: patch });
    else {
      const half = Number(sample.date.slice(8, 10)) <= 15 ? 'a' : 'b';
      await ref.set({ project: sample.project, period: sample.date.slice(0, 7) + half, records: patch });
    }
  }

  save(record: MetricRecord, opts: SaveOptions): Promise<MetricRecord> {
    return this.enqueue(async () => {
      const existing = this.cache.get(record.id);
      if (existing && !opts.overwrite && opts.replaceId !== record.id) throw new DuplicateRecordError(existing);
      try {
        if (opts.replaceId && opts.replaceId !== record.id) {
          const old = this.cache.get(opts.replaceId);
          if (old) await this.patchChunk(old, { [old.id]: null });
          this.cache.delete(opts.replaceId);
        }
        await this.patchChunk(record, { [record.id]: record });
        this.cache.set(record.id, record);
        return record;
      } catch (e) {
        throw explain(e);
      }
    });
  }

  remove(id: string): Promise<void> {
    return this.enqueue(async () => {
      const old = this.cache.get(id);
      if (!old) return;
      try {
        await this.patchChunk(old, { [id]: null });
        this.cache.delete(id);
      } catch (e) {
        throw explain(e);
      }
    });
  }

  bulkSave(records: MetricRecord[], mode: BulkMode): Promise<BulkResult> {
    return this.enqueue(async () => {
      const res: BulkResult = { added: 0, replaced: 0, skipped: 0 };
      const groups = new Map<string, MetricRecord[]>();
      for (const r of records) {
        const id = chunkId(r);
        const g = groups.get(id);
        if (g) g.push(r);
        else groups.set(id, [r]);
      }
      try {
        for (const [, group] of groups) {
          const patch: Record<string, MetricRecord> = {};
          for (const r of group) {
            if (this.cache.has(r.id)) {
              if (mode === 'skip') {
                res.skipped++;
                continue;
              }
              res.replaced++;
            } else res.added++;
            patch[r.id] = r;
          }
          if (Object.keys(patch).length) {
            await this.patchChunk(group[0], patch);
            for (const r of Object.values(patch)) this.cache.set(r.id, r);
          }
        }
      } catch (e) {
        throw explain(e);
      }
      return res;
    });
  }
}
