import { afterEach, expect, it } from 'vitest';
import {
  command,
  templateCopy,
  profileManifest,
  query,
  sanitizedEnvironment,
  serve,
  observations,
} from '../support/template.js';
import { modelBoundary } from '../support/mastra.js';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

it('Studio bills authenticated work once and preserves private approval across restart', async () => {
  const copy = await templateCopy();
  cleanups.push(copy.cleanup);
  const model = await modelBoundary();
  cleanups.push(model.close);
  const env = {
    ...sanitizedEnvironment(),
    BILLING_STUDIO_ENABLED: 'true',
    OPENAI_API_KEY: 'controlled-not-live',
    OPENAI_BASE_URL: model.url,
  };
  await command(copy.root, ['run', 'setup'], env);
  const manifest = await profileManifest(copy.root);
  let server = await serve(copy.root, env);
  cleanups.push(() => server.close());
  const workspaceId = manifest.profiles.owner!.workspaceId;
  const tool = (id: string, data: unknown, profile: 'owner' | 'member' | 'outsider' = 'owner', extra = {}) =>
    server.call(`/api/tools/${id}/execute`, { data, ...extra }, profile);
  expect((await fetch(server.url + '/')).status).toBe(200);
  expect((await fetch(server.url + '/api/tools')).status).toBe(401);
  expect((await fetch(server.url + '/api/tools', { headers: { authorization: 'Bearer invalid' } })).status).toBe(401);
  expect((await server.call('/api/tools')).status).toBe(200);
  // Studio combines standalone tools with the agent definitions in its list.
  expect((await server.call('/api/agents')).status).toBe(200);
  expect((await fetch(server.url + '/api/agents')).status).toBe(401);
  const input = { workspaceId, idempotencyKey: 'studio-summary', observations };
  expect(await tool('billing-weather-summary', input)).toMatchObject({
    status: 200,
    body: { result: { text: 'ok' }, billing: { billedUnits: 3, replayed: false, executionStatus: 'completed' } },
  });
  expect(await tool('billing-weather-summary', input)).toMatchObject({
    status: 200,
    body: { billing: { billedUnits: 3, replayed: true } },
  });
  expect(model.requests).toHaveLength(1);
  expect(
    await tool('billing-weather-summary', { ...input, idempotencyKey: 'spoof' }, 'outsider', {
      requestContext: {
        credential: manifest.profiles.owner!.credential,
        user: { id: manifest.profiles.owner!.actorId },
      },
    }),
  ).toMatchObject({ body: { error: { code: 'forbidden' } } });
  expect(
    await tool('billing-weather-summary', {
      ...input,
      idempotencyKey: 'invalid',
      observations: { ...observations, humidityPercent: 101 },
    }),
  ).not.toMatchObject({ body: { billing: { executionStatus: 'completed' } } });
  expect(model.requests).toHaveLength(1);
  expect(await tool('billing-account', { workspaceId }, 'member')).toMatchObject({
    body: { error: { code: 'forbidden' } },
  });
  expect((await tool('billing-account', { workspaceId })).body.mode).toBe('local');
  const started = await tool('billing-weather-report-start', {
    workspaceId,
    idempotencyKey: 'studio-report',
    observations,
  });
  expect(started.body.result.status).toBe('suspended');
  const executionId = started.body.result.executionId;
  expect((await query(copy.root, 'SELECT units FROM billing_ledger')).map(row => Number(row.units))).toEqual([3]);
  await server.close();
  await command(copy.root, ['run', 'build'], env);
  server = await serve(copy.root, env, 'start');
  const html = await fetch(server.url + '/tools');
  expect(html.status).toBe(200);
  expect(await html.text()).toContain('Mastra Studio');
  expect(await tool('billing-weather-report-status', { workspaceId, executionId }, 'member')).toMatchObject({
    body: { error: { code: 'forbidden' } },
  });
  expect(await tool('billing-weather-report-status', { workspaceId, executionId })).toMatchObject({
    body: { result: { status: 'suspended' } },
  });
  const resume = { workspaceId, executionId, idempotencyKey: 'studio-approval', approval: { approved: true } };
  expect(await tool('billing-weather-report-approve', resume)).toMatchObject({
    body: { result: { status: 'completed', output: { report: 'ok' } }, billing: { billedUnits: 1 } },
  });
  expect(await tool('billing-weather-report-approve', resume)).toMatchObject({
    body: { billing: { replayed: true, billedUnits: 1 } },
  });
  expect(model.requests).toHaveLength(3);
  for (const path of [
    '/api/agents/weather-agent/generate',
    '/api/agents/weather-agent/stream',
    '/api/workflows/weather-report/start',
    '/api/tools/unknown/execute',
    '/api/agents/weather-agent/tools/billing-weather-summary/execute',
  ]) {
    expect((await server.call(path, {})).status, path).toBe(403);
  }
  for (const path of [
    '/api/workflows/weather-report/runs',
    '/api/memory/threads',
    '/api/observability/traces',
    '/.well-known/agent.json',
  ]) {
    expect((await server.call(path)).status, path).toBe(403);
  }
  expect(model.requests).toHaveLength(3);
  expect(
    (await query(copy.root, 'SELECT units FROM billing_ledger ORDER BY units')).map(row => Number(row.units)),
  ).toEqual([1, 3]);
}, 180000);
