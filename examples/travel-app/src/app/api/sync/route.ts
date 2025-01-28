import { NextResponse } from "next/server";

import { mastra } from "@/mastra";

export async function POST() {
  const { start } = mastra.getWorkflow("syncCsvDataWorkflow").createRun();

  await start();
  // Your cron logic here
  return NextResponse.json({ success: true });
}
