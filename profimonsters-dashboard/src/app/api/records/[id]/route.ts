import { NextResponse } from 'next/server';
import { getRepository } from '@/server/repository';

export const dynamic = 'force-dynamic';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ok = await getRepository().remove(id);
  if (!ok) return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
