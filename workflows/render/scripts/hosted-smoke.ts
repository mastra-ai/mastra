import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

// Run against your own deployed deterministic example. This creates three real jobs.
const base = process.env.DEMO_BASE_URL;
const token = process.env.DEMO_TEST_TOKEN;
const otherToken = process.env.DEMO_OTHER_TOKEN;
if (!base || !token || !otherToken) throw new Error('Set DEMO_BASE_URL, DEMO_TEST_TOKEN and DEMO_OTHER_TOKEN');
interface Reply {
  runId?: string;
  status?: string;
  mode?: string;
  result?: { result: { revisedDraft: string; findings: unknown[]; mode: string } };
  error?: string;
}
async function request(path: string, credential: string | undefined = token, body?: unknown) {
  const response = await fetch(`${base}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { ...(credential ? { authorization: `Bearer ${credential}` } : {}), 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(90000),
  });
  return { status: response.status, body: (await response.json()) as Reply };
}
async function terminal(id: string) {
  const deadline = performance.now() + 300000;
  while (performance.now() < deadline) {
    const reply = await request(`/api/jobs/${id}`);
    assert.equal(reply.status, 200, JSON.stringify(reply));
    if (['success', 'failed', 'canceled'].includes(reply.body.status ?? '')) return reply.body;
    await delay(3000);
  }
  throw new Error(`Timed out waiting for ${id}; reconnect using this ID before submitting again`);
}
const observations: unknown[] = [];
function record(value: unknown) {
  observations.push(value);
  console.log(JSON.stringify(value));
  if (process.env.DEMO_RESULTS_FILE)
    writeFileSync(process.env.DEMO_RESULTS_FILE, JSON.stringify(observations, null, 2));
}
assert.equal((await request('/healthz', '')).status, 200);
assert.equal((await request('/api/config', '')).status, 401);
const config = await request('/api/config');
assert.equal(config.status, 200);
assert.equal(config.body.mode, 'deterministic', 'These checks must not make paid model calls');
assert.equal((await request('/api/jobs', token, { draft: '' })).status, 400);
record({ check: 'health, authentication, validation', passed: true });

const successId = randomUUID();
const payload = { runId: successId, draft: 'A   hosted draft with useful content.', criteria: 'Keep it clear.' };
record({ check: 'success submission identity', runId: successId });
const accepted = await request('/api/jobs', token, payload);
assert.equal(accepted.status, 202, JSON.stringify(accepted));
assert.equal(accepted.body.runId, successId);
assert.equal(accepted.body.result, undefined);
const duplicate = await request('/api/jobs', token, payload);
assert.equal(duplicate.status, 202);
assert.equal(duplicate.body.runId, successId);
assert.equal((await request('/api/jobs', token, { ...payload, draft: 'Changed input' })).status, 409);
assert.equal((await request('/api/jobs', otherToken, payload)).status, 404);
assert.equal((await request(`/api/jobs/${successId}`, otherToken)).status, 404);
assert.equal((await request(`/api/jobs/${successId}/cancel`, otherToken, {})).status, 404);
const completed = await terminal(successId);
assert.equal(completed.status, 'success', JSON.stringify(completed));
assert.equal(completed.result?.result.revisedDraft, 'A hosted draft with useful content.');
assert.equal(completed.result.result.findings.length, 3);
assert.equal(completed.result.result.mode, 'deterministic');
record({ check: 'success, duplicate acceptance and ownership', passed: true, ...completed });

const failureId = randomUUID();
record({ check: 'failure submission identity', runId: failureId });
assert.equal((await request('/api/jobs', token, { runId: failureId, draft: 'Failure demonstration.', demoFailure: true })).status, 202);
const failure = await terminal(failureId);
assert.equal(failure.status, 'failed', JSON.stringify(failure));
assert.match(failure.error ?? '', /failure/i);
record({ check: 'child failure', passed: true, ...failure });

const cancelId = randomUUID();
record({ check: 'cancellation submission identity', runId: cancelId });
assert.equal((await request('/api/jobs', token, { runId: cancelId, draft: 'Cancel this job.' })).status, 202);
assert.equal((await request(`/api/jobs/${cancelId}/cancel`, token, {})).status, 202);
const canceled = await terminal(cancelId);
assert.equal(canceled.status, 'canceled', JSON.stringify(canceled));
record({ check: 'remote cancellation', passed: true, ...canceled });
