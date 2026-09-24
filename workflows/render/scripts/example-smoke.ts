import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { openSync, closeSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

const directory = resolve('examples/editorial-review');
const tokens = { alice: 'local-fixture-alice-token-only', bob: 'local-fixture-bob-token-only' };
const base = 'http://127.0.0.1:4318';
interface Reply {
  runId?: string;
  status?: string;
  result?: { result: { revisedDraft: string; findings: unknown[]; mode: string } };
  error?: string;
}
let backend: ChildProcess | undefined;
async function until<T>(operation: () => Promise<T>, check: (value: T) => boolean): Promise<T> {
  const deadline = performance.now() + 60000;
  while (performance.now() < deadline) {
    const value = await operation();
    if (check(value)) return value;
    await delay(150);
  }
  throw new Error('Example HTTP check timed out');
}
async function request(path: string, user: keyof typeof tokens | undefined, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(user ? { authorization: `Bearer ${tokens[user]}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: (await response.json()) as Reply };
}
async function start() {
  const log = openSync('.scratch/example-http.log', 'a');
  backend = spawn(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'server.ts'], {
    cwd: directory,
    env: { ...process.env, PORT: '4318', DEMO_API_TOKENS: JSON.stringify(tokens), REVIEW_MODE: 'deterministic' },
    stdio: ['ignore', log, log],
  });
  closeSync(log);
  await until(async () => {
    if (backend?.exitCode !== null) throw new Error('Example backend exited; inspect .scratch/example-http.log');
    try {
      return (await request('/api/config', 'alice')).status === 200;
    } catch {
      return false;
    }
  }, Boolean);
  return backend.pid;
}
async function stop() {
  if (!backend || backend.exitCode !== null) return;
  const child = backend;
  const ended = new Promise<void>(resolveExit => child.once('exit', () => resolveExit()));
  child.kill('SIGTERM');
  const timer = setTimeout(() => child.kill('SIGKILL'), 3000);
  await ended;
  clearTimeout(timer);
  backend = undefined;
}
const observations: unknown[] = [];
try {
  const originalPid = await start();
  assert.equal((await request('/api/config', undefined)).status, 401);
  assert.equal((await request('/api/jobs', 'alice', { draft: '' })).status, 400);
  const payload = { runId: randomUUID(), draft: 'A   draft with useful content.', criteria: 'Keep it clear.' };
  const submitted = await request('/api/jobs', 'alice', payload);
  assert.equal(submitted.status, 202);
  assert.ok(submitted.body.runId);
  assert.equal(submitted.body.result, undefined);
  const id = submitted.body.runId;
  assert.equal(id, payload.runId);
  assert.equal((await request('/api/jobs', 'alice', payload)).body.runId, id);
  assert.equal((await request('/api/jobs', 'alice', { ...payload, draft: 'Changed input' })).status, 409);
  assert.equal((await request('/api/jobs', 'bob', payload)).status, 404);
  assert.equal((await request(`/api/jobs/${id}`, 'bob')).status, 404);
  assert.equal((await request(`/api/jobs/${id}/cancel`, 'bob', {})).status, 404);
  assert.equal((await request(`/api/jobs/${id}`, 'alice')).status, 200);
  await stop();
  const restartedPid = await start();
  assert.notEqual(originalPid, restartedPid);
  const completed = await until(
    () => request(`/api/jobs/${id}`, 'alice'),
    value => value.body.status === 'success',
  );
  assert.equal(completed.body.result?.result.revisedDraft, 'A draft with useful content.');
  assert.equal(completed.body.result.result.findings.length, 3);
  assert.equal(completed.body.result.result.mode, 'deterministic');
  observations.push({ check: 'ownership and backend restart', runId: id, originalPid, restartedPid, completed });
  console.log('PASS: HTTP authentication, validation, ownership, accepted submission and backend restart');

  const failed = await request('/api/jobs', 'alice', { draft: 'Failure demonstration.', demoFailure: true });
  assert.equal(failed.status, 202);
  const failure = await until(
    () => request(`/api/jobs/${failed.body.runId}`, 'alice'),
    value => value.body.status === 'failed',
  );
  assert.match(failure.body.error ?? '', /failure/i);
  observations.push({ check: 'failure', ...failure });
  console.log('PASS: HTTP child failure');

  const cancel = await request('/api/jobs', 'alice', { draft: 'Cancel this job.' });
  assert.equal(cancel.status, 202);
  assert.equal((await request(`/api/jobs/${cancel.body.runId}/cancel`, 'alice', {})).status, 202);
  const canceled = await until(
    () => request(`/api/jobs/${cancel.body.runId}`, 'alice'),
    value => value.body.status === 'canceled',
  );
  observations.push({ check: 'cancellation', ...canceled });
  console.log('PASS: HTTP remote cancellation');
  writeFileSync('.scratch/example-observations.json', JSON.stringify(observations, null, 2));
} finally {
  await stop();
}
