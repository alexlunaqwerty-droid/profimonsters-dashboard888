import { NextResponse } from 'next/server';
import { syncGoogleSheet } from '@/server/connectors/googleSheets';

export const dynamic = 'force-dynamic';
export const maxDuration = 26;

/** Загрузка строк из Google Таблицы в базу сайта. */
export async function POST() {
  try {
    return NextResponse.json(await syncGoogleSheet());
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
