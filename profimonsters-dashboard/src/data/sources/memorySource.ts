import type { MetricRecord } from '@/domain/types';
import { DuplicateRecordError, type BulkMode, type BulkResult, type DataSource, type SaveOptions, type SourceKind } from './types';

/**
 * Источник в памяти. Используется для демо-режима и как основа для хранилища в браузере.
 * Логика дублей одна для всех источников: id записи выводится из (дата, проект, показатель).
 */
export class MemorySource implements DataSource {
  readonly readOnly = false;
  protected map = new Map<string, MetricRecord>();
  private listeners = new Set<(r: MetricRecord[]) => void>();

  constructor(
    readonly kind: SourceKind,
    readonly label: string,
    readonly ephemeral: boolean,
    initial: MetricRecord[] = [],
  ) {
    for (const r of initial) this.map.set(r.id, r);
  }

  async load(): Promise<MetricRecord[]> {
    return [...this.map.values()];
  }

  subscribe(onChange: (r: MetricRecord[]) => void): () => void {
    this.listeners.add(onChange);
    return () => this.listeners.delete(onChange);
  }

  protected emit() {
    const all = [...this.map.values()];
    this.persist(all);
    for (const l of this.listeners) l(all);
  }

  /** Переопределяется хранилищем в браузере. */
  protected persist(_all: MetricRecord[]) {}

  async save(record: MetricRecord, opts: SaveOptions): Promise<MetricRecord> {
    const existing = this.map.get(record.id);
    if (existing && !opts.overwrite && opts.replaceId !== record.id) throw new DuplicateRecordError(existing);
    if (opts.replaceId && opts.replaceId !== record.id) this.map.delete(opts.replaceId);
    this.map.set(record.id, record);
    this.emit();
    return record;
  }

  async remove(id: string): Promise<void> {
    this.map.delete(id);
    this.emit();
  }

  async bulkSave(records: MetricRecord[], mode: BulkMode): Promise<BulkResult> {
    const res: BulkResult = { added: 0, replaced: 0, skipped: 0 };
    for (const r of records) {
      if (this.map.has(r.id)) {
        if (mode === 'skip') {
          res.skipped++;
          continue;
        }
        res.replaced++;
      } else res.added++;
      this.map.set(r.id, r);
    }
    this.emit();
    return res;
  }
}

const LS_KEY = 'profimonsters-dashboard:records:v1';

/** Хранилище в браузере — запасной вариант, когда база сайта недоступна. */
export class BrowserStorageSource extends MemorySource {
  constructor() {
    super('browser', 'Хранилище браузера', false, BrowserStorageSource.read());
  }

  private static read(): MetricRecord[] {
    try {
      const raw = globalThis.localStorage?.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as MetricRecord[]) : [];
    } catch {
      return [];
    }
  }

  protected persist(all: MetricRecord[]) {
    try {
      globalThis.localStorage?.setItem(LS_KEY, JSON.stringify(all));
    } catch {
      /* хранилище недоступно — данные останутся до перезагрузки */
    }
  }
}
