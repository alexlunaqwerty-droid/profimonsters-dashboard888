// Автоматическая загрузка из Google Таблицы раз в час (Netlify Scheduled Functions).
// Ничего не делает, если GOOGLE_SHEET_CSV_URL не задана.
export default async () => {
  if (!process.env.GOOGLE_SHEET_CSV_URL) return;
  const base = process.env.URL;
  if (!base) return;
  const res = await fetch(`${base}/api/sync/google-sheets`, { method: 'POST' });
  console.log('google-sheet sync', res.status, (await res.text()).slice(0, 300));
};

export const config = { schedule: '@hourly' };
