'use client';
import { DashboardApp } from '@/components/DashboardApp';
import { nextPlatform } from '@/platform/nextPlatform';

export default function Page() {
  return <DashboardApp platform={nextPlatform} />;
}
