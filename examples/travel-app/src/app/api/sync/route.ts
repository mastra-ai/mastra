import { NextResponse } from "next/server";

import { mastra } from "@/mastra";

export async function POST() {
  const run = await mastra.getWorkflow("syncCsvDataWorkflow").createRunAsync();
  const { start } = run;

  await start();
  // Your cron logic here
  return NextResponse.json({ success: true });
}
