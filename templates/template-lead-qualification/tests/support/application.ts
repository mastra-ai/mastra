import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Mastra } from '@mastra/core/mastra';
import { MastraServer } from '@mastra/hono';
import { Hono } from 'hono';
import { createApplicationRuntime } from '../../src/mastra/application';
import { intakeConfig } from '../../src/mastra/config/lead-ingestion';
import type { IntakeConfig } from '../../src/mastra/config/lead-ingestion';

export const productionToken = 'example-token-for-functional-tests-1234567890';
export function event(eventId = 'delivery-1', lead: Record<string, unknown> = { domain: 'example.com' }) {
  return { version: 1, type: 'lead.received', eventId, lead: { reference: eventId, ...lead } };
}

export async function harness(
  options: {
    production?: boolean;
    dispatch?: boolean;
    config?: IntakeConfig;
    directory?: string;
  } = {},
) {
  const directory = options.directory ?? (await mkdtemp(join(tmpdir(), 'lead-intake-')));
  const application = await createApplicationRuntime({
    runtime: {
      mode: options.production ? 'production' : 'local',
      token: options.production ? productionToken : undefined,
      host: '127.0.0.1',
      applicationPath: join(directory, 'application.db'),
      observabilityPath: join(directory, 'observability.duckdb'),
    },
    config: options.config ?? intakeConfig,
  });
  const mastra = new Mastra(application.mastraConfig);
  const http = new Hono();
  const server = new MastraServer({ app: http, mastra, prefix: '/api' });
  await server.init();
  if (options.dispatch) await mastra.startWorkers();
  function post(body: unknown, headers: Record<string, string> = {}) {
    return http.request('/lead-qualification/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
  }
  let closing: Promise<void> | undefined;
  async function close(remove = true) {
    closing ??= mastra.shutdown();
    await closing;
    if (remove) await rm(directory, { recursive: true, force: true });
  }
  return {
    ...application,
    store: application.storage.leadEvents,
    duckdb: application.storage.telemetryStore,
    mastra,
    directory,
    http,
    post,
    close,
  };
}
