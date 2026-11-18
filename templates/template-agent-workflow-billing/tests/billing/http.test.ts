import { fixtureServer } from '../support/fixture-server.js';
import { afterEach, describe, expect, it } from 'vitest';
import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ALL_SERVER_ROUTES } from '@mastra/server/server-adapter';
import { modelBoundary, runtimeFixture } from '../support/mastra.js';
import { temporaryDatabase } from '../support/billing.js';
const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function served(
  mode: 'development' | 'built',
  environment: NodeJS.ProcessEnv,
  credential: string,
  fixture = 'billing-server',
) {
  const server = await fixtureServer(fixture, environment, credential, mode);
  cleanups.push(server.close);
  return server;
}
describe('billing HTTP boundary', () => {
  it('native execution and data routes cannot bypass the billing gateway', async () => {
    for (const mode of ['development', 'built'] as const) {
      const database = await temporaryDatabase();
      cleanups.push(database.cleanup);
      const model = await modelBoundary();
      cleanups.push(model.close);
      const runtime = await runtimeFixture({
        databaseUrl: database.url,
        directory: database.directory,
        modelUrl: model.url,
      });
      cleanups.push(runtime.close);
      const options = {
        databaseUrl: database.url,
        directory: database.directory,
        modelUrl: model.url,
        credential: runtime.credential,
        workspaceId: runtime.billingContext.workspaceId,
      };
      const server = await served(mode, { BILLING_TEST_CONFIGURATION: JSON.stringify(options) }, runtime.credential);
      const headers = {
        authorization: `Bearer ${runtime.credential}`,
        'content-type': 'application/json',
        'idempotency-key': 'http-generate',
      };
      const base = `${server.url}/billing/workspaces/${runtime.billingContext.workspaceId}`;
      const generated = await fetch(`${base}/agents/assistant/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: '[success] private answer' }),
      });
      expect(generated.status, mode).toBe(200);
      expect(await generated.json()).toMatchObject({ result: { text: 'ok' }, billing: { billedUnits: 5 } });
      const created = await fetch(`${base}/workflows/report/runs`, {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'http-create' },
        body: '{}',
      });
      expect(created.status).toBe(200);
      const { executionId } = (await created.json()) as { executionId: string };
      const started = await fetch(`${base}/workflows/report/runs/${executionId}/start`, {
        method: 'POST',
        headers: { ...headers, 'idempotency-key': 'http-start' },
        body: '{"inputData":{"count":0}}',
      });
      expect(started.status).toBe(200);
      expect(await started.json()).toMatchObject({
        result: { status: 'suspended' },
        billing: { settlementStatus: 'reserved' },
      });
      const before = model.requests.length;
      for (const route of ALL_SERVER_ROUTES) {
        const path = `/api${route.path}`
          .replace(/:agentId/g, 'assistant')
          .replace(/:workflowId/g, 'report')
          .replace(/:runId/g, executionId)
          .replace(/:[^/]+/g, 'private')
          .replace(/\{[^}]+\}/g, 'private')
          .replace(/\*/g, 'private');
        const method = route.method === 'ALL' ? 'POST' : route.method;
        for (const authorization of [undefined, headers.authorization]) {
          const denied = await fetch(`${server.url}${path}`, {
            method,
            headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
            ...(['GET', 'HEAD'].includes(method)
              ? {}
              : { body: '{"messages":[{"role":"user","content":"bypass"}],"inputData":{"count":0}}' }),
            signal: AbortSignal.timeout(5000),
          });
          expect(denied.status, `${mode} ${method} ${path}`).toBe(403);
          expect(await denied.text()).not.toContain('Approval required');
        }
      }
      for (const path of [
        '/api/learning/private',
        '/__restart-active-workflow-runs',
        '/swagger-ui',
        '/openapi.json',
        '/api/agents/assistant/browser/session',
      ]) {
        const denied = await fetch(`${server.url}${path}`, {
          method: path.startsWith('/__restart') ? 'POST' : 'GET',
          headers,
        });
        expect(denied.status, path).toBe(403);
      }
      expect(model.requests).toHaveLength(before);
      const replay = await fetch(`${base}/agents/assistant/generate`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: '[success] private answer' }),
      });
      expect(await replay.json()).toMatchObject({ billing: { replayed: true, billedUnits: 5 } });
      expect(model.requests).toHaveLength(before);
      const untrusted = await fetch(`${base}/agents/assistant/generate`, {
        method: 'POST',
        headers,
        body: '{"prompt":"[success]","model":"attacker"}',
      });
      expect(untrusted.status).toBe(400);
      await server.close();
    }
  }, 180000);
});

it('native free resources coexist with billed resources and custom Mastra server configuration', async () => {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const model = await modelBoundary();
  cleanups.push(model.close);
  const runtime = await runtimeFixture({
    databaseUrl: database.url,
    directory: database.directory,
    modelUrl: model.url,
  });
  cleanups.push(runtime.close);
  const configuration = {
    databaseUrl: database.url,
    directory: database.directory,
    modelUrl: model.url,
    workspaceId: runtime.billingContext.workspaceId,
  };
  for (const mode of ['development', 'built'] as const) {
    const server = await served(
      mode,
      { BILLING_TEST_CONFIGURATION: JSON.stringify(configuration) },
      runtime.credential,
      'mixed-server',
    );
    const headers = { authorization: `Bearer ${runtime.credential}`, 'content-type': 'application/json' };
    const custom = await fetch(`${server.url}/status/ready`);
    expect(await custom.json()).toEqual({ name: 'ready' });
    const before = model.requests.length;
    const free = await fetch(`${server.url}/api/agents/public/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: '[success] public answer' }] }),
    });
    expect(free.status).toBe(200);
    expect(free.headers.get('x-application')).toBe('custom');
    expect(free.headers.get('x-middleware-calls')).toBe('1');
    expect(await free.json()).toMatchObject({ text: 'ok' });
    expect(model.requests).toHaveLength(before + 1);
    const denied = await fetch(`${server.url}/api/agents/paid/generate`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ messages: [{ role: 'user', content: '[success] bypass' }] }),
    });
    expect(denied.status).toBe(403);
    expect(
      (
        await fetch(`${server.url}/api/agents/paid-alias/generate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ messages: [{ role: 'user', content: 'bypass' }] }),
        })
      ).status,
    ).toBe(403);
    expect(model.requests).toHaveLength(before + 1);
    const base = `${server.url}/billing/workspaces/${configuration.workspaceId}`;
    const paid = await fetch(`${base}/agents/paid/generate`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'paid-once' },
      body: JSON.stringify({ prompt: '[success] paid answer' }),
    });
    expect(await paid.json()).toMatchObject({
      result: { text: 'ok' },
      billing: { billedUnits: 1, replayed: mode === 'built' },
    });
    const created = await fetch(`${base}/workflows/paid-flow/runs`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'flow-once' },
      body: '{}',
    });
    const { executionId } = (await created.json()) as { executionId: string };
    const report = await fetch(`${base}/workflows/paid-flow/runs/${executionId}/start`, {
      method: 'POST',
      headers: { ...headers, 'idempotency-key': 'flow-start' },
      body: JSON.stringify({ inputData: { text: 'paid report' } }),
    });
    expect(await report.json()).toMatchObject({
      result: { status: 'completed', output: { text: 'paid report' } },
      billing: { billedUnits: 3 },
    });
    expect(
      (
        await fetch(`${server.url}/api/workflows/paid-flow/start-async`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ inputData: { text: 'bypass' } }),
        })
      ).status,
    ).toBe(403);
    const publicRun = await fetch(`${server.url}/api/workflows/public-flow/create-run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(publicRun.status).toBe(200);
    const { runId } = (await publicRun.json()) as { runId: string };
    const publicReport = await fetch(`${server.url}/api/workflows/public-flow/start-async?runId=${runId}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ inputData: { text: 'public report' } }),
    });
    expect(publicReport.status).toBe(200);
    expect(await publicReport.json()).toMatchObject({ status: 'success', result: { text: 'public report' } });
    const crossWorkflow = await fetch(`${server.url}/api/workflows/public-flow/runs/${executionId}`, { headers });
    expect(await crossWorkflow.text()).not.toContain('paid report');
    for (const path of [
      '/api/auth/login',
      '/.well-known/agent.json',
      '/api/memory/threads',
      '/__restart-active-workflow-runs',
    ]) {
      const blocked = await fetch(`${server.url}${path}`, { method: path.startsWith('/__') ? 'POST' : 'GET', headers });
      expect(blocked.status, path).toBe(403);
    }
    const usage = await fetch(`${base}/usage`, { headers });
    expect(await usage.json()).toMatchObject({
      meters: [expect.objectContaining({ key: 'credits', confirmedBalance: 6, consumedUnits: 4 })],
    });
    expect((await stat(join(database.directory, 'custom-workflows.db'))).size).toBeGreaterThan(0);
    await server.close();
  }
}, 180000);
