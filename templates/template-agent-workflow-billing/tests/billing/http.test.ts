import { afterEach, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { ALL_SERVER_ROUTES } from '@mastra/server/server-adapter';
import { modelBoundary, runtimeFixture } from '../support/mastra.js';
import { temporaryDatabase } from '../support/billing.js';
const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const root = fileURLToPath(new URL('../../', import.meta.url));
async function command(args: string[], environment: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, args, { cwd: root, env: environment, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => (output = (output + chunk).slice(-64000)));
  child.stderr.on('data', chunk => (output = (output + chunk).slice(-64000)));
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`Fixture command failed (${code}): ${output}`);
}
async function served(mode: 'development' | 'built', environment: NodeJS.ProcessEnv, credential: string) {
  const listener = createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const address = listener.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  await new Promise<void>(resolve => listener.close(() => resolve()));
  const env = { ...environment, BILLING_PORT: String(address.port), MASTRA_TELEMETRY_DISABLED: 'true' };
  if (mode === 'built')
    await command(['node_modules/mastra/dist/index.js', 'build', '--dir', 'tests/fixtures/billing-server'], env);
  const args =
    mode === 'built'
      ? ['.mastra/output/index.mjs']
      : ['node_modules/mastra/dist/index.js', 'dev', '--dir', 'tests/fixtures/billing-server'];
  const child = spawn(process.execPath, args, { cwd: root, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', chunk => (output = (output + chunk).slice(-64000)));
  child.stderr.on('data', chunk => (output = (output + chunk).slice(-64000)));
  const exit = once(child, 'exit');
  const close = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid!, 'SIGTERM');
    } catch {
      return;
    }
    await Promise.race([exit, setTimeout(3000)]);
    try {
      process.kill(-child.pid!, 'SIGKILL');
    } catch {
      /* Already stopped. */
    }
  };
  const url = `http://127.0.0.1:${address.port}`;
  cleanups.push(close);
  for (let attempt = 0; attempt < 300; attempt++) {
    if (child.exitCode !== null) throw new Error(`Fixture server exited: ${output}`);
    try {
      const result = await fetch(`${url}/billing/context`, {
        headers: { authorization: `Bearer ${credential}` },
        signal: AbortSignal.timeout(1000),
      });
      if (result.status === 200) return { url, close };
    } catch {
      /* Wait for the real server. */
    }
    await setTimeout(100);
  }
  throw new Error(`Fixture did not serve: ${output}`);
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
      const server = await served(
        mode,
        { ...process.env, BILLING_TEST_CONFIGURATION: JSON.stringify(options) },
        runtime.credential,
      );
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
