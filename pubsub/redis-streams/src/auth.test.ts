import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ManagedProcess } from '../test-fixtures/harness';
import {
  flushRedis,
  getFreePort,
  killProcess,
  makeStorageDir,
  PACKAGE_DIR,
  spawnFixture,
  waitForLine,
  waitForServerHttp,
} from '../test-fixtures/harness';

const SERVER_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/server.entry.ts');

/**
 * Verifies the worker-token gate on the step-execution endpoint.
 * When `MASTRA_WORKER_SECRET` is set, requests that don't supply the
 * matching `workerToken` field in the JSON body must be rejected.
 */
describe.sequential('step-execution endpoint auth', () => {
  let server: ManagedProcess | undefined;
  let storage: { dir: string; storageUrl: string; cleanup: () => Promise<void> };
  let serverPort: number;

  beforeAll(async () => {
    await flushRedis();
    storage = await makeStorageDir('mastra-auth-');
    serverPort = await getFreePort();
    server = spawnFixture({
      entry: SERVER_ENTRY,
      label: 'server',
      env: {
        MASTRA_WORKERS: 'false',
        STORAGE_URL: storage.storageUrl,
        PORT: String(serverPort),
        MASTRA_WORKER_SECRET: 'topsecret',
      },
    });
    await waitForLine(server, 'server-ready', 30_000);
    await waitForServerHttp(`http://localhost:${serverPort}`);
  }, 60_000);

  afterAll(async () => {
    await killProcess(server);
    await storage?.cleanup();
  });

  it('rejects step-execution requests without a matching worker token', async () => {
    const url = `http://localhost:${serverPort}/api/workflows/cross-process-greet/runs/r-noauth/steps/execute`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stepId: 'doesnt-matter',
        executionPath: [0],
        runId: 'r-noauth',
        workflowId: 'cross-process-greet',
        stepResults: {},
        state: {},
        requestContext: {},
      }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects requests with a wrong token', async () => {
    const url = `http://localhost:${serverPort}/api/workflows/cross-process-greet/runs/r-wrong/steps/execute`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stepId: 'doesnt-matter',
        executionPath: [0],
        runId: 'r-wrong',
        workflowId: 'cross-process-greet',
        stepResults: {},
        state: {},
        requestContext: {},
        workerToken: 'wrong',
      }),
    });
    expect(res.status).toBe(401);
  });
});
