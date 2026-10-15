'use client';
import type { ConnectorInfo, Platform, SyncResult } from '@/components/DashboardApp';
import { HttpSource } from '@/data/sources/httpSource';

/** Среда Next.js: данные в базе сайта через API, файлы скачиваются обычной ссылкой. */
export const nextPlatform: Platform = {
  async createPrimarySource() {
    return new HttpSource('/api/records');
  },
  async saveFile(filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  },
  async syncExternal(id) {
    let res: Response;
    try {
      res = await fetch(`/api/sync/${id}`, { method: 'POST', cache: 'no-store' });
    } catch {
      throw new Error('Сервер недоступен. Проверьте подключение.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) throw new Error(body.error || `Ошибка загрузки (${res.status})`);
    return body as SyncResult;
  },
  async connectors() {
    const res = await fetch('/api/connectors', { cache: 'no-store' });
    const body = (await res.json()) as { connectors: ConnectorInfo[] };
    return body.connectors;
  },
};
