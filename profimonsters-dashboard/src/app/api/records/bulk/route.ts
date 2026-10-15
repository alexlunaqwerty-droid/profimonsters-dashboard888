import { NextResponse } from 'next/server';
import { getRepository } from '@/server/repository';
import { sanitizeRecord } from '@/server/validateIncoming';
import type { MetricRecord } from '@/domain/types';

export const dynamic = 'force-dynamic';

/** Импорт пачкой. mode: replace — перезаписать совпадающие, skip — оставить существующие. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!Array.isArray(body?.records)) return NextResponse.json({ error: 'Ожидается массив records' }, { status: 400 });
  if (body.records.length > 50000) return NextResponse.json({ error: 'Не больше 50 000 записей за раз' }, { status: 413 });
  const clean: MetricRecord[] = [];
  const errors: string[] = [];
  body.records.forEach((r: unknown, i: number) => {
    const { record, error } = sanitizeRecord(r);
    if (record) clean.push(record);
    else errors.push(`#${i + 1}: ${error}`);
  });
  if (errors.length) return NextResponse.json({ error: `Есть ошибки в записях: ${errors.slice(0, 5).join(', ')}` }, { status: 400 });
  const res = await getRepository().bulk(clean, body.mode === 'skip' ? 'skip' : 'replace');
  return NextResponse.json(res);
}
