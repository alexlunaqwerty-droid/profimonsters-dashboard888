import { NextResponse } from 'next/server';
import { connectorStatus } from '@/server/connectors';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ connectors: connectorStatus() });
}
