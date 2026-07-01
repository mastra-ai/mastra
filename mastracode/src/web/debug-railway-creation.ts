import { appendFileSync } from 'node:fs';
import { join } from 'node:path';

export function debugRailwayCreation(event: string, data: Record<string, unknown> = {}): void {
  appendFileSync(
    join(process.cwd(), 'debug-railway-creation.jsonl'),
    `${JSON.stringify({
      ts: new Date().toISOString(),
      pid: process.pid,
      source: 'mastracode-web',
      event,
      ...data,
    })}\n`,
  );
}

export function errorInfo(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack?.split('\n').slice(0, 5) };
  }
  return { name: typeof error, message: String(error) };
}

export function envSummary(): Record<string, unknown> {
  return {
    hasRailwayEnvironmentId: Boolean(process.env.RAILWAY_ENVIRONMENT_ID),
    railwayEnvironmentIdSuffix: process.env.RAILWAY_ENVIRONMENT_ID?.slice(-8),
    hasRailwayApiToken: Boolean(process.env.RAILWAY_API_TOKEN),
    railwayApiTokenLength: process.env.RAILWAY_API_TOKEN?.length,
  };
}
