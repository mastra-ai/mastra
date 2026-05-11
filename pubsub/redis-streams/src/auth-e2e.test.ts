/**
 * End-to-end auth coverage for the standalone-worker step-execution endpoint.
 *
 * Each test spawns a fresh server + orchestrator pair and exercises the auth
 * pipeline that gates `/api/workflows/.../steps/execute` (a `requiresAuth: true`
 * route).
 *
 * What we prove:
 *
 *  A. Worker → server step calls succeed when the worker presents the right
 *     bearer token (via MASTRA_WORKER_AUTH_TOKEN).
 *  B. Wrong token: the worker hits the endpoint, the framework rejects the
 *     call with 401, the workflow stalls. No silent advance.
 *  C. Missing token: same as B.
 *  D. Anonymous direct-fetch with auth provider configured → 401.
 *  E. With NO auth provider configured the framework currently allows the
 *     request through (`requiresAuth: true` only kicks in when an auth config
 *     exists). This test pins that behavior so future regressions surface
 *     explicitly — operators MUST configure an auth provider to gate this
 *     route. Documented as such.
 *  F. Auth-error response body does not echo the request payload.
 */
import { resolve } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
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

interface Pair {
  server?: ManagedProcess;
  worker?: ManagedProcess;
  storage?: { dir: string; storageUrl: string; cleanup: () => Promise<void> };
  serverUrl: string;
  serverPort: number;
}

async function spawnServer(env: NodeJS.ProcessEnv = {}): Promise<Pair> {
  const storage = await makeStorageDir('mastra-auth-e2e-');
  const serverPort = await getFreePort();
  const serverUrl = `http://localhost:${serverPort}`;
  const server = spawnFixture({
    entry: SERVER_ENTRY,
    label: 'server',
    env: {
      MASTRA_WORKERS: 'false',
      REDIS_URL,
      STORAGE_URL: storage.storageUrl,
      PORT: String(serverPort),
      ...env,
    },
  });
  await waitForLine(server, 'server-ready', 30_000);
  await waitForServerHttp(serverUrl);
  return { server, storage, serverUrl, serverPort };
}

async function spawnWorker(pair: Pair, env: NodeJS.ProcessEnv = {}): Promise<void> {
  const worker = spawnFixture({
    entry: WORKER_ENTRY,
    label: 'worker',
    env: {
      MASTRA_WORKERS: 'orchestration',
      REDIS_URL,
      STORAGE_URL: pair.storage!.storageUrl,
      MASTRA_STEP_EXECUTION_URL: `${pair.serverUrl}/api`,
      ...env,
    },
  });
  await waitForLine(worker, 'worker-ready', 30_000);
  pair.worker = worker;
}

async function teardown(pair: Pair | undefined): Promise<void> {
  if (!pair) return;
  await killProcess(pair.worker);
  await killProcess(pair.server);
  await pair.storage?.cleanup();
}

/** POST start-async with a hard client-side abort. start-async waits for the
 *  run to finish, so when the worker can't authenticate the request would
 *  otherwise hang forever. The signal-driven abort lets the test continue. */
async function fireStartAsync(
  serverUrl: string,
  token: string | undefined,
  abortMs: number,
): Promise<{ aborted: boolean; status?: number }> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), abortMs);
  try {
    const res = await fetch(`${serverUrl}/api/workflows/cross-process-greet/start-async`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ inputData: { name: 'world' } }),
      signal: ac.signal,
    });
    clearTimeout(timer);
    return { aborted: false, status: res.status };
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === 'AbortError') return { aborted: true };
    throw err;
  }
}

describe.sequential('step-execution endpoint auth (end-to-end)', () => {
  let pair: Pair | undefined;

  beforeAll(async () => {
    await flushRedis();
  });

  afterEach(async () => {
    await teardown(pair);
    pair = undefined;
    await flushRedis();
  });

  it('A: workflow completes when worker presents the correct bearer token', async () => {
    pair = await spawnServer({ TEST_AUTH_TOKEN: 'secret-abc' });
    await spawnWorker(pair, { MASTRA_WORKER_AUTH_TOKEN: 'secret-abc' });

    const before = countMarker(pair.server, 'step-execute-hit');
    const res = await fetch(`${pair.serverUrl}/api/workflows/cross-process-greet/start-async`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer secret-abc',
      },
      body: JSON.stringify({ inputData: { name: 'world' } }),
    });

    expect(res.ok).toBe(true);
    const body = (await res.json()) as { status: string; result?: { greeting?: string } };
    expect(body.status).toBe('success');
    expect(body.result?.greeting).toBe('hello, world');
    // Proves the worker actually authenticated and hit the endpoint.
    expect(countMarker(pair.server, 'step-execute-hit')).toBeGreaterThan(before);
  }, 60_000);

  it('B: workflow stalls when worker presents the wrong token', async () => {
    pair = await spawnServer({ TEST_AUTH_TOKEN: 'secret-abc' });
    await spawnWorker(pair, { MASTRA_WORKER_AUTH_TOKEN: 'wrong-token' });

    // start-async waits for the run to finish; the worker will fail auth
    // forever, so abort the client after 6s.
    const result = await fireStartAsync(pair.serverUrl, 'secret-abc', 6000);
    expect(result.aborted).toBe(true);

    // The middleware ran — proves the worker actually called the endpoint.
    // start-async never returned (request aborted), so the run did not
    // complete. Together this means the worker hit auth and was rejected.
    expect(countMarker(pair.server, 'step-execute-hit')).toBeGreaterThan(0);
  }, 30_000);

  it('C: workflow stalls when worker omits the token entirely', async () => {
    pair = await spawnServer({ TEST_AUTH_TOKEN: 'secret-abc' });
    await spawnWorker(pair, { MASTRA_WORKER_AUTH_TOKEN: '' });

    const result = await fireStartAsync(pair.serverUrl, 'secret-abc', 6000);
    expect(result.aborted).toBe(true);

    expect(countMarker(pair.server, 'step-execute-hit')).toBeGreaterThan(0);
  }, 30_000);

  it('D: anonymous direct request rejected with 401 when auth provider is configured', async () => {
    pair = await spawnServer({ TEST_AUTH_TOKEN: 'secret-abc' });

    const url = `${pair.serverUrl}/api/workflows/cross-process-greet/runs/anon/steps/execute`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stepId: 'greet',
        executionPath: [0],
        runId: 'anon',
        workflowId: 'cross-process-greet',
        stepResults: {},
        state: {},
        requestContext: {},
      }),
    });

    expect(res.status).toBe(401);
  }, 60_000);

  it('E: documents that requiresAuth is a no-op when no auth provider is configured', async () => {
    // Mastra's checkRouteAuth returns null (no auth required) when there is
    // no `server.auth` config, regardless of `requiresAuth: true` on the
    // route. This test pins that behavior. Operators deploying standalone
    // workers MUST configure an auth provider to gate the step-execution
    // endpoint — there is no implicit fail-closed.
    pair = await spawnServer();

    const url = `${pair.serverUrl}/api/workflows/cross-process-greet/runs/leak/steps/execute`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        stepId: 'greet',
        executionPath: [0],
        runId: 'leak',
        workflowId: 'cross-process-greet',
        stepResults: {},
        state: {},
        requestContext: {},
      }),
    });

    // Currently 200 (handler executes) or 4xx/5xx from inside the handler.
    // What we're pinning is: NOT 401 — auth was not enforced.
    expect(res.status).not.toBe(401);
  }, 60_000);

  it('F: 401 response does not echo the request body', async () => {
    pair = await spawnServer({ TEST_AUTH_TOKEN: 'secret-abc' });
    const url = `${pair.serverUrl}/api/workflows/cross-process-greet/runs/sanity/steps/execute`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer not-the-token' },
      body: JSON.stringify({
        stepId: 'greet',
        executionPath: [0],
        runId: 'sanity',
        workflowId: 'cross-process-greet',
        stepResults: {},
        state: {},
        requestContext: { secret: 'do-not-echo' },
      }),
    });
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).not.toContain('do-not-echo');
  }, 60_000);
});
