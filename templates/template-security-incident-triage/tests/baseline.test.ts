import { readdir } from 'node:fs/promises';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { submitPlanTool } from '@mastra/core/tools';
import type { Mastra } from '@mastra/core/mastra';
import type { LibSQLStore } from '@mastra/libsql';
import type { Hono } from 'hono';

import { migrateOperationalStore } from '../src/db/migrate.js';
import type { OperationalStore } from '../src/db/operational-store.js';
import type { AppEnv } from '../src/http-context.js';
import { makeServerConfig } from './fixtures/alert-intake.js';
import { createTempDatabase, type TempDatabase } from './helpers/temp-libsql.js';

let mastra: Mastra;
let storage: LibSQLStore;
let createApp: () => Promise<Hono<AppEnv>>;
let operationalStore: OperationalStore;
let database: TempDatabase | undefined;
let previousStorageUrl: string | undefined;
let initialWorkspaceDatabases: string[] = [];

beforeAll(async () => {
  initialWorkspaceDatabases = await listWorkspaceDatabases();
  database = await createTempDatabase();
  previousStorageUrl = process.env.MASTRA_STORAGE_URL;
  process.env.MASTRA_STORAGE_URL = database.url;

  ({ mastra, storage } = await import('../src/mastra/index.js'));
  const server = await import('../src/server.js');
  operationalStore = database.createStore();
  await migrateOperationalStore(operationalStore);
  createApp = () =>
    server.createApp({
      config: makeServerConfig(),
      store: operationalStore,
      logger: { write: () => {} },
    });
});

afterAll(async () => {
  try {
    operationalStore?.close();
    await storage?.close();
  } finally {
    try {
      await database?.cleanup();
    } finally {
      if (previousStorageUrl === undefined) {
        delete process.env.MASTRA_STORAGE_URL;
      } else {
        process.env.MASTRA_STORAGE_URL = previousStorageUrl;
      }
    }
  }
  expect(await listWorkspaceDatabases()).toEqual(initialWorkspaceDatabases);
});

async function listWorkspaceDatabases(): Promise<string[]> {
  return (await readdir(process.cwd())).filter(name => name === 'mastra.db' || name.startsWith('mastra.db-')).sort();
}

describe('application bootstrap', () => {
  it('registers the security incident workflow', () => {
    expect(mastra.getWorkflow('securityIncidentWorkflow')).toBeDefined();
  });

  it('registers the presentation-only submit-plan spike', () => {
    expect(submitPlanTool.id).toBe('submit_plan');
    expect(submitPlanTool.inputSchema).toBeDefined();
    expect(submitPlanTool.suspendSchema).toBeDefined();
    expect(submitPlanTool.resumeSchema).toBeDefined();
  });

  it('serves a minimal health response with defensive headers', async () => {
    const app = await createApp();
    const response = await app.request('/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('content-security-policy')).toBe("default-src 'none'");
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });
});
