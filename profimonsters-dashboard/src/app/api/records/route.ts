import { NextResponse } from 'next/server';
import { getRepository } from '@/server/repository';
import { sanitizeRecord } from '@/server/validateIncoming';

export const dynamic = 'force-dynamic';

export async function GET() {
  const records = await getRepository().list();
  return NextResponse.json({ records });
}

/** Создание или изменение записи. 409 — запись с тем же ключом уже есть и overwrite=false. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const { record, error } = sanitizeRecord(body?.record);
  if (!record) return NextResponse.json({ error }, { status: 400 });
  const res = await getRepository().upsert(record, {
    overwrite: !!body?.overwrite,
    replaceId: typeof body?.replaceId === 'string' ? body.replaceId : undefined,
  });
  if (res.duplicate) return NextResponse.json({ error: 'Дубликат', existing: res.duplicate }, { status: 409 });
  return NextResponse.json({ record: res.record }, { status: 201 });
}
