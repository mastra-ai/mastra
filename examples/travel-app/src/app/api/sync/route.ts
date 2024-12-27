import { NextResponse } from 'next/server';

import { mastra } from '@/mastra';

export async function POST() {
  await mastra.sync('syncCsvData', {});
  // Your cron logic here
  return NextResponse.json({ success: true });
}
