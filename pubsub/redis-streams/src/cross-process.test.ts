import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  countMarker,
  flushRedis,
  getFreePort,
  killProcess,
  makeStorageDir,
  PACKAGE_DIR,
  REDIS_URL,
  spawnFixture,
  waitForLine,
  waitForServerHttp,
} from '../test-fixtures/harness';
import type { ManagedProcess } from '../test-fixtures/harness';

const SERVER_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/app.server.entry.ts');
const WORKER_ENTRY = resolve(PACKAGE_DIR, 'test-fixtures/app.worker.entry.ts');

describe('cross-process workflow execution via Redis Streams', () => {
  let storage: { dir: string; storageUrl: string; cleanup: () => Promise<void> };
  let serverUrl: string;
  let server: ManagedProcess | undefined;
  let worker: ManagedProcess | undefined;

  beforeAll(async () => {
    await flushRedis();
    storage = await makeStorageDir();
    const serverPort = await getFreePort();
    serverUrl = `http://localhost:${serverPort}`;

    server = spawnFixture({
      entry: SERVER_ENTRY,
      label: 'server',
      env: {
        MASTRA_WORKERS: 'false',
        REDIS_URL,
        STORAGE_URL: storage.storageUrl,
        PORT: String(serverPort),
      },
    });
    await waitForLine(server, 'server-ready');
    await waitForServerHttp(serverUrl);

    worker = spawnFixture({
      entry: WORKER_ENTRY,
      label: 'worker',
      env: {
        MASTRA_WORKERS: 'orchestration',
        REDIS_URL,
        STORAGE_URL: storage.storageUrl,
        MASTRA_STEP_EXECUTION_URL: `${serverUrl}/api`,
      },
    });
    await waitForLine(worker, 'worker-ready');
  }, 60_000);

  afterAll(async () => {
    await killProcess(worker);
    await killProcess(server);
    await storage?.cleanup();
  });

  it('runs a workflow end-to-end: server publishes, worker processes via Redis, worker calls server for step execution', async () => {
    const before = countMarker(server, 'step-execute-hit');
    const res = await fetch(`${serverUrl}/api/workflows/cross-process-greet/start-async`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inputData: { name: 'world' } }),
    });

    expect(res.ok).toBe(true);
    const body = (await res.json()) as { status: string; result?: { greeting?: string }; error?: unknown };

    expect(body.status).toBe('success');
    expect(body.result?.greeting).toBe('hello, world');
    expect(countMarker(server, 'step-execute-hit')).toBeGreaterThan(before);
  }, 30_000);

  it('runs a multi-step workflow end-to-end across processes', async () => {
    const before = countMarker(server, 'step-execute-hit');
    const res = await fetch(`${serverUrl}/api/workflows/cross-process-pipeline/start-async`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inputData: { name: '  World  ' } }),
    });

    expect(res.ok).toBe(true);
    const body = (await res.json()) as { status: string; result?: { shouted?: string }; error?: unknown };

    expect(body.status).toBe('success');
    expect(body.result?.shouted).toBe('HELLO, WORLD!');
    expect(countMarker(server, 'step-execute-hit') - before).toBeGreaterThanOrEqual(3);
  }, 30_000);
});
