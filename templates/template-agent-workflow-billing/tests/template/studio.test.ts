import { afterEach, expect, it } from 'vitest';
import { command, templateCopy, profileManifest, query, sanitizedEnvironment, serve } from '../support/template.js';
import { imageBoundary } from '../support/images.js';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

it('Studio bills authenticated work once and preserves private approval across restart', async () => {
  const copy = await templateCopy();
  cleanups.push(copy.cleanup);
  const model = await imageBoundary();
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
  const input = { workspaceId, idempotencyKey: 'studio-summary', brief: 'A blue bird' };
  expect(await tool('billing-image-generate', input)).toMatchObject({
    status: 200,
    body: {
      result: { text: 'Image generated.' },
      billing: { billedUnits: 1, replayed: false, executionStatus: 'completed' },
    },
  });
  expect(await tool('billing-image-generate', input)).toMatchObject({
    status: 200,
    body: { billing: { billedUnits: 1, replayed: true } },
  });
  expect(model.images).toHaveLength(1);
  expect(
    await tool('billing-image-generate', { ...input, idempotencyKey: 'spoof' }, 'outsider', {
      requestContext: {
        credential: manifest.profiles.owner!.credential,
        user: { id: manifest.profiles.owner!.actorId },
      },
    }),
  ).toMatchObject({ body: { error: { code: 'forbidden' } } });
  expect(
    await tool('billing-image-generate', {
      ...input,
      idempotencyKey: 'invalid',
      brief: '',
    }),
  ).not.toMatchObject({ body: { billing: { executionStatus: 'completed' } } });
  expect(model.images).toHaveLength(1);
  expect(await tool('billing-account', { workspaceId }, 'member')).toMatchObject({
    body: { error: { code: 'forbidden' } },
  });
  expect((await tool('billing-account', { workspaceId })).body.mode).toBe('local');
  const started = await tool('billing-image-kit-start', {
    workspaceId,
    idempotencyKey: 'studio-report',
    brief: 'A blue bird story',
  });
  expect(started.body.result.status).toBe('suspended');
  const executionId = started.body.result.executionId;
  expect((await query(copy.root, 'SELECT units FROM billing_ledger')).map(row => Number(row.units))).toEqual([1]);
  await server.close();
  await command(copy.root, ['run', 'build'], env);
  server = await serve(copy.root, env, 'start');
  const html = await fetch(server.url + '/tools');
  expect(html.status).toBe(200);
  expect(await html.text()).toContain('Mastra Studio');
  expect(await tool('billing-image-kit-status', { workspaceId, executionId }, 'member')).toMatchObject({
    body: { error: { code: 'forbidden' } },
  });
  expect(await tool('billing-image-kit-status', { workspaceId, executionId })).toMatchObject({
    body: { result: { status: 'suspended' } },
  });
  const resume = { workspaceId, executionId, idempotencyKey: 'studio-approval', approval: { approved: true } };
  expect(await tool('billing-image-kit-approve', resume)).toMatchObject({
    body: { result: { status: 'completed', output: { artifacts: expect.any(Array) } }, billing: { billedUnits: 3 } },
  });
  expect(await tool('billing-image-kit-approve', resume)).toMatchObject({
    body: { billing: { replayed: true, billedUnits: 3 } },
  });
  expect(model.images).toHaveLength(4);
  for (const path of [
    '/api/agents/image-agent/generate',
    '/api/agents/image-agent/stream',
    '/api/workflows/image-kit/start',
    '/api/tools/unknown/execute',
    '/api/agents/image-agent/tools/billing-image-generate/execute',
  ]) {
    expect((await server.call(path, {})).status, path).toBe(403);
  }
  for (const path of [
    '/api/workflows/image-kit/runs',
    '/api/memory/threads',
    '/api/observability/traces',
    '/.well-known/agent.json',
  ]) {
    expect((await server.call(path)).status, path).toBe(403);
  }
  expect(model.images).toHaveLength(4);
  expect(
    (await query(copy.root, 'SELECT units FROM billing_ledger ORDER BY units')).map(row => Number(row.units)),
  ).toEqual([1, 3]);
}, 180000);
