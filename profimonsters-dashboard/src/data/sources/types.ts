import type { MetricRecord } from '@/domain/types';

/**
 * Слой данных. Интерфейс и расчёты работают только с этим контрактом,
 * поэтому источник (демо, база сайта, Google Таблицы, CRM, API) меняется без переделки экранов.
 */
export type SourceKind = 'demo' | 'site-db' | 'artifact-db' | 'browser' | 'external';

export type BulkMode = 'replace' | 'skip';

export interface BulkResult {
  added: number;
  replaced: number;
  skipped: number;
}

export interface SaveOptions {
  /** Разрешить перезапись существующей записи с тем же ключом (дата + проект + показатель). */
  overwrite: boolean;
  /** id редактируемой записи, если у неё изменились дата, проект или показатель. */
  replaceId?: string;
}

export class DuplicateRecordError extends Error {
  constructor(public existing: MetricRecord) {
    super('Запись с такой датой, проектом и показателем уже есть');
    this.name = 'DuplicateRecordError';
  }
}

export class SourceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceUnavailableError';
  }
}

export interface DataSource {
  readonly kind: SourceKind;
  /** Название для шапки: «Демо-данные», «База сайта». */
  readonly label: string;
  /** true — изменения не сохраняются между сессиями. */
  readonly ephemeral: boolean;
  /** true — источник только для чтения (например, внешний коннектор). */
  readonly readOnly: boolean;

  load(): Promise<MetricRecord[]>;
  /** Живые обновления, если источник их поддерживает. Возвращает функцию отписки. */
  subscribe?(onChange: (records: MetricRecord[]) => void, onError: (e: Error) => void): () => void;

  save(record: MetricRecord, opts: SaveOptions): Promise<MetricRecord>;
  remove(id: string): Promise<void>;
  bulkSave(records: MetricRecord[], mode: BulkMode): Promise<BulkResult>;
}
