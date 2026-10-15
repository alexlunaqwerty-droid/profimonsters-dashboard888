/**
 * Точка входа автономной версии: один HTML-файл, опубликованный как страница claude.ai.
 * Использует тот же интерфейс и те же расчёты, что и Next.js-версия; отличается только платформа.
 */
import { createRoot } from 'react-dom/client';
import { DashboardApp, type ConnectorInfo, type Platform } from '@/components/DashboardApp';
import { ArtifactDbSource, type ArtifactDb } from '@/data/sources/artifactDbSource';
import { BrowserStorageSource } from '@/data/sources/memorySource';

type ClaudeRuntime = { use(name: string): Promise<unknown> };
const runtime = (window as unknown as { claude?: ClaudeRuntime }).claude;

const CONNECTORS: ConnectorInfo[] = [
  { id: 'google-sheets', title: 'Google Таблицы', description: 'Чтение листа в формате «Дата · Проект · Показатель · Значение · План · Примечание».', env: [], configured: false },
  { id: 'amocrm', title: 'CRM (amoCRM)', description: 'Статусы исполнителей, смены, увольнения — по выгрузке из воронок AMO.', env: [], configured: false },
  { id: 'rest-api', title: 'Внешний API', description: 'Любой HTTP-источник, отдающий записи в JSON.', env: [], configured: false },
  { id: 'database', title: 'Внешняя база данных', description: 'SQL-запрос к учётной системе.', env: [], configured: false },
];

const platform: Platform = {
  async createPrimarySource() {
    const db = (await runtime?.use('db').catch(() => null)) as ArtifactDb | null;
    return db ? new ArtifactDbSource(db) : new BrowserStorageSource();
  },
  async saveFile(filename, blob) {
    const dl = (await runtime?.use('downloads').catch(() => null)) as { save(a: { filename: string; data: Blob }): Promise<unknown> } | null;
    if (!dl) return false;
    try {
      await dl.save({ filename, data: blob });
      return true;
    } catch {
      return true; // пользователь отказался — это не ошибка
    }
  },
  async connectors() {
    return CONNECTORS;
  },
};

createRoot(document.getElementById('pm-root')!).render(<DashboardApp platform={platform} />);
