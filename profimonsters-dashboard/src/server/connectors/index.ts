import 'server-only';
import type { DateRange, RecordDraft } from '@/domain/types';
import { GOOGLE_SHEET_ENV, isGoogleSheetConfigured } from './googleSheets';

/**
 * Внешние источники данных. Каждый коннектор отдаёт записи в общем формате RecordDraft,
 * дальше они проходят ту же проверку и попадают в ту же базу, что и ручной ввод.
 * Подключение нового источника = реализация одного метода fetchRecords + переменные окружения.
 * Google Таблицы работают через ссылку на CSV (googleSheets.ts); остальные — заготовки.
 */
export interface ExternalConnector {
  id: string;
  title: string;
  description: string;
  /** Какие переменные окружения нужны. */
  env: string[];
  isConfigured(): boolean;
  fetchRecords(range: DateRange): Promise<RecordDraft[]>;
}

class NotConfiguredError extends Error {}

function envConnector(id: string, title: string, description: string, env: string[]): ExternalConnector {
  return {
    id,
    title,
    description,
    env,
    isConfigured: () => env.every((k) => !!process.env[k]),
    async fetchRecords() {
      // Здесь будет запрос к источнику и преобразование его строк в RecordDraft.
      throw new NotConfiguredError(`Источник «${title}» не подключён`);
    },
  };
}

export const CONNECTORS: ExternalConnector[] = [
  {
    ...envConnector('google-sheets', 'Google Таблицы', 'Лист в формате «Дата · Проект · Показатель · Значение · План · Примечание». Загружается кнопкой «Обновить» и автоматически раз в час.', [GOOGLE_SHEET_ENV]),
    isConfigured: isGoogleSheetConfigured,
  },
  envConnector('amocrm', 'CRM (amoCRM)', 'Статусы исполнителей, смены, увольнения — по выгрузке из воронок AMO.', ['AMO_BASE_URL', 'AMO_ACCESS_TOKEN']),
  envConnector('rest-api', 'Внешний API', 'Любой HTTP-источник, отдающий записи в JSON.', ['EXTERNAL_API_URL', 'EXTERNAL_API_TOKEN']),
  envConnector('database', 'Внешняя база данных', 'SQL-запрос к учётной системе.', ['EXTERNAL_DATABASE_URL']),
];

export function connectorStatus() {
  return CONNECTORS.map((c) => ({ id: c.id, title: c.title, description: c.description, env: c.env, configured: c.isConfigured() }));
}
