import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { configuredOrganizations } from '../../src/billing/environment.js';
import { studioComposition } from '../support/studio-composition.js';
import { createStudioBillingWrapper } from '../../src/studio-with-billing/index.js';
import { createBilling } from '../../src/billing/integration.js';
import { imageConfiguration } from '../support/image-configuration.js';
import { readConfigurationFile } from '../../src/billing/configuration-file.js';
import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile, writeFile, chmod, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { ALL_SERVER_ROUTES } from '@mastra/server/server-adapter';
import {
  command,
  templateCopy,
  profileManifest,
  query,
  sanitizedEnvironment,
  serve,
  shareOwnerWorkspace,
} from '../support/template.js';
import { imageBoundary } from '../support/images.js';
import type { Artifact } from '../../src/images/schemas.js';

type Server = Awaited<ReturnType<typeof serve>>;
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const toolIds = [
  'billing-account',
  'billing-image-generate',
  'billing-image-kit-start',
  'billing-image-kit-status',
  'billing-image-kit-approve',
  'billing-image-kit-cancel',
];
const tool = (
  server: Server,
  id: string,
  data: unknown,
  profile: 'owner' | 'member' | 'outsider' = 'owner',
  requestContext?: unknown,
) => server.call(`/api/tools/${id}/execute`, { data, ...(requestContext ? { requestContext } : {}) }, profile);
async function fixture(shared = false) {
  const copy = await templateCopy();
  cleanups.push(copy.cleanup);
  const boundary = await imageBoundary();
  cleanups.push(boundary.close);
  const env = {
    ...sanitizedEnvironment(),
    BILLING_STUDIO_ENABLED: 'true',
    OPENAI_API_KEY: 'controlled-not-live',
    OPENAI_BASE_URL: boundary.url,
  };
  await command(copy.root, ['run', 'setup'], env);
  if (shared) await shareOwnerWorkspace(copy.root);
  return { ...copy, boundary, env, manifest: await profileManifest(copy.root) };
}
async function account(server: Server, workspaceId: string) {
  const response = await tool(server, 'billing-account', { workspaceId });
  expect(response).toMatchObject({ status: 200, body: { mode: 'local', authority: 'provider-reservations' } });
  return response.body.meters.find((meter: { key: string }) => meter.key === 'credits');
}
async function download(server: Server, root: string, artifact: Artifact, png: Buffer) {
  const response = await fetch(`${server.url}/billing/workspaces/${artifact.workspaceId}/artifacts/${artifact.id}`, {
    headers: { authorization: `Bearer ${server.manifest.profiles.owner!.credential}` },
    redirect: 'error',
  });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('image/png');
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('content-disposition')).toBe(`attachment; filename="${artifact.filename}"`);
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  const bytes = Buffer.from(await response.arrayBuffer());
  expect(bytes).toEqual(png);
  expect(bytes.length).toBe(artifact.bytes);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256);
  const path = join(root, 'data/private-images', `${artifact.id}.png`);
  expect(await readFile(path)).toEqual(bytes);
  expect((await stat(path)).mode & 0o777).toBe(0o600);
}
const inputSchema = (definition: { inputSchema: string }) => JSON.parse(definition.inputSchema).json;
async function studioDefinitions(server: Server) {
  for (const path of ['/', '/tools', '/settings']) {
    const response = await fetch(server.url + path);
    expect(response.status, path).toBe(200);
    expect(await response.text()).toContain('Mastra Studio');
  }
  expect((await fetch(server.url + '/api/auth/capabilities')).status).toBe(200);
  for (const path of ['/api/tools', '/api/agents']) {
    expect((await fetch(server.url + path)).status).toBe(401);
    expect((await fetch(server.url + path, { headers: { authorization: 'Bearer invalid' } })).status).toBe(401);
    expect((await server.call(path)).status).toBe(200);
  }
  const listed = await server.call('/api/tools');
  for (const id of toolIds) {
    expect(listed.body).toHaveProperty(id);
    const definition = await server.call(`/api/tools/${id}`);
    expect(definition.status).toBe(200);
    expect(inputSchema(definition.body)).toMatchObject({
      type: 'object',
      additionalProperties: false,
      required: expect.arrayContaining(['workspaceId']),
    });
  }
  const generate = inputSchema((await server.call('/api/tools/billing-image-generate')).body);
  expect(generate.required).toEqual(expect.arrayContaining(['workspaceId', 'idempotencyKey', 'brief']));
  expect(generate.properties.brief).toMatchObject({ type: 'string', minLength: 1, maxLength: 2000 });
  const approval = inputSchema((await server.call('/api/tools/billing-image-kit-approve')).body).properties.approval;
  expect(approval).toMatchObject({
    type: 'object',
    additionalProperties: false,
    properties: { approved: { type: 'boolean' } },
  });
}

// A Studio user must receive durable private images, saved approval prompts and exactly one parent charge across real process boundaries.
it('Studio image actions preserve billed generation approval replay and built serving', async () => {
  const f = await fixture();
  const workspaceId = f.manifest.profiles.owner!.workspaceId;
  let server = await serve(f.root, f.env);
  cleanups.push(() => server.close());
  const initial = await account(server, workspaceId);
  const balance = initial.confirmedBalance;
  expect(balance).toBe(30);
  expect(initial.consumedUnits).toBe(0);
  let spent = 0;
  let pending: any;
  let savedImage!: { input: { workspaceId: string; idempotencyKey: string; brief: string }; body: any };
  for (const mode of ['dev', 'start'] as const) {
    if (mode === 'start') {
      await server.close();
      await command(f.root, ['run', 'build'], f.env);
      server = await serve(f.root, f.env, 'start');
      const calls = { images: f.boundary.images.length, models: f.boundary.models.length };
      const imageReplay = await tool(server, 'billing-image-generate', savedImage.input);
      expect(imageReplay.body.result).toEqual(savedImage.body.result);
      expect(imageReplay.body.billing).toMatchObject({ billedUnits: 1, replayed: true });
      await download(server, f.root, savedImage.body.result.object.artifacts[0], f.boundary.png);
      expect(f.boundary.images).toHaveLength(calls.images);
      expect(f.boundary.models).toHaveLength(calls.models);
      expect(await account(server, workspaceId)).toMatchObject({
        confirmedBalance: balance - spent - 3,
        consumedUnits: spent,
      });
      const restored = await tool(server, 'billing-image-kit-status', {
        workspaceId,
        executionId: pending.result.executionId,
      });
      expect(restored.body.result).toEqual(pending.result);
      const imagesBefore = f.boundary.images.length;
      const modelsBefore = f.boundary.models.length;
      const approve = {
        workspaceId,
        executionId: pending.result.executionId,
        idempotencyKey: 'approve-saved-prompts',
        approval: { approved: true },
      };
      const completed = await tool(server, 'billing-image-kit-approve', approve);
      expect(completed.body).toMatchObject({
        result: { status: 'completed' },
        billing: { billedUnits: 3, executionStatus: 'completed' },
      });
      const artifacts: Artifact[] = completed.body.result.output.artifacts;
      expect(artifacts).toHaveLength(3);
      expect(f.boundary.images.slice(imagesBefore).map(image => image.prompt)).toEqual(
        pending.result.pending.approval.prompts,
      );
      expect(f.boundary.models.length - modelsBefore).toBe(6);
      const replay = await tool(server, 'billing-image-kit-approve', approve);
      expect(replay.body.result).toEqual(completed.body.result);
      expect(replay.body.billing).toMatchObject({ billedUnits: 3, replayed: true });
      expect(f.boundary.images).toHaveLength(imagesBefore + 3);
      expect(f.boundary.models).toHaveLength(modelsBefore + 6);
      expect(
        await query(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', [pending.result.executionId]),
      ).toMatchObject([{ units: 3 }]);
      for (const artifact of artifacts) await download(server, f.root, artifact, f.boundary.png);
      spent += 3;
    }
    await studioDefinitions(server);
    const input = { workspaceId, idempotencyKey: `${mode}-image`, brief: 'A blue bird in a quiet forest' };
    const before = { images: f.boundary.images.length, models: f.boundary.models.length };
    const generated = await tool(server, 'billing-image-generate', input);
    expect(generated).toMatchObject({
      status: 200,
      body: {
        result: { text: 'Image generated.' },
        billing: { billedUnits: 1, executionStatus: 'completed', replayed: false },
      },
    });
    const artifact: Artifact = generated.body.result.object.artifacts[0];
    expect(generated.body.result.object.artifacts).toHaveLength(1);
    expect(await tool(server, 'billing-image-generate', input)).toMatchObject({
      body: { result: generated.body.result, billing: { billedUnits: 1, replayed: true } },
    });
    expect(f.boundary.images).toHaveLength(before.images + 1);
    expect(f.boundary.models).toHaveLength(before.models + 2);
    expect(JSON.stringify(generated.body)).not.toMatch(/b64_json|data:image|private-images|controlled-not-live/);
    await download(server, f.root, artifact, f.boundary.png);
    if (mode === 'dev') savedImage = { input, body: generated.body };
    spent++;
    expect(await account(server, workspaceId)).toMatchObject({
      confirmedBalance: balance - spent,
      consumedUnits: spent,
    });
    const calls = { images: f.boundary.images.length, models: f.boundary.models.length };
    for (const invalid of [
      { ...input, brief: '' },
      { ...input, model: 'attacker' },
      { ...input, actorId: 'attacker' },
    ]) {
      const rejected = await tool(server, 'billing-image-generate', invalid);
      expect(rejected.body).not.toHaveProperty('billing');
      expect(JSON.stringify(rejected.body)).toMatch(/error|validation/i);
    }
    expect(f.boundary.images).toHaveLength(calls.images);
    expect(f.boundary.models).toHaveLength(calls.models);
    const cancelStarted = await tool(server, 'billing-image-kit-start', {
      workspaceId,
      idempotencyKey: `${mode}-cancel-kit`,
      brief: 'A second blue bird',
    });
    const executionId = cancelStarted.body.result.executionId;
    expect(cancelStarted.body).toMatchObject({
      result: { status: 'suspended' },
      billing: { billedUnits: null, settlementStatus: 'reserved' },
    });
    expect(await account(server, workspaceId)).toMatchObject({
      confirmedBalance: balance - spent - 3,
      consumedUnits: spent,
    });
    const canceled = await tool(server, 'billing-image-kit-cancel', {
      workspaceId,
      executionId,
      idempotencyKey: `${mode}-cancel`,
    });
    expect(canceled.body.billing).toMatchObject({ billedUnits: 0, settlementStatus: 'released' });
    expect(
      await query(f.root, 'SELECT units, active FROM billing_reservations WHERE execution_id = ?', [executionId]),
    ).toMatchObject([{ units: 3, active: 0 }]);
    expect(f.boundary.images).toHaveLength(calls.images);
    expect(f.boundary.models).toHaveLength(calls.models);
    f.boundary.mode('refusal');
    const refusalInput = { ...input, idempotencyKey: `${mode}-refusal` };
    const refused = await tool(server, 'billing-image-generate', refusalInput);
    expect(refused.body.billing).toMatchObject({
      billedUnits: 0,
      executionStatus: 'failed',
      settlementStatus: 'released',
    });
    expect(refused.body).not.toHaveProperty('result.object.artifacts');
    expect(JSON.stringify(refused.body)).not.toMatch(/Controlled refusal|stack|controlled-not-live|private-images/);
    const refusedCalls = { images: f.boundary.images.length, models: f.boundary.models.length };
    expect(refusedCalls.images).toBe(calls.images + 1);
    expect((await tool(server, 'billing-image-generate', refusalInput)).body.billing).toMatchObject({
      billedUnits: 0,
      replayed: true,
    });
    expect(f.boundary.images).toHaveLength(refusedCalls.images);
    expect(f.boundary.models).toHaveLength(refusedCalls.models);
    f.boundary.mode('success');
    expect(await account(server, workspaceId)).toMatchObject({
      confirmedBalance: balance - spent,
      consumedUnits: spent,
    });
    if (mode === 'dev') {
      pending = (
        await tool(server, 'billing-image-kit-start', {
          workspaceId,
          idempotencyKey: 'persisted-kit',
          brief: 'A blue bird story for books and websites',
        })
      ).body;
      expect(pending).toMatchObject({
        result: { status: 'suspended' },
        billing: { billedUnits: null, settlementStatus: 'reserved' },
      });
      expect(pending.result.pending.approval.prompts).toHaveLength(3);
      for (const [index, style] of ['Notion-inspired', '3D style', 'Vector illustration'].entries())
        expect(pending.result.pending.approval.prompts[index]).toContain(style);
      expect(
        await query(f.root, 'SELECT units, active FROM billing_reservations WHERE execution_id = ?', [
          pending.result.executionId,
        ]),
      ).toMatchObject([{ units: 3, active: 1 }]);
      expect(await account(server, workspaceId)).toMatchObject({
        confirmedBalance: balance - spent - 3,
        consumedUnits: spent,
      });
      expect(f.boundary.images).toHaveLength(refusedCalls.images);
      expect(f.boundary.models).toHaveLength(refusedCalls.models);
    }
  }
  expect(
    (await query(f.root, 'SELECT units FROM billing_ledger ORDER BY units')).map(row => Number(row.units)),
  ).toEqual([0, 0, 0, 0, 1, 1, 3]);
}, 600000);

// Shared membership permits billed work while creator data, credentials and all native bypasses remain private in both server modes.
it('Studio forged identity native routes and private image bypasses are denied', async () => {
  const f = await fixture(true);
  const { owner, member, outsider } = f.manifest.profiles;
  const workspaceId = owner!.workspaceId;
  let server = await serve(f.root, f.env);
  cleanups.push(() => server.close());
  const generated = await tool(server, 'billing-image-generate', {
    workspaceId,
    idempotencyKey: 'private-owner-image',
    brief: 'A private blue bird',
  });
  const artifact: Artifact = generated.body.result.object.artifacts[0];
  const pending = await tool(server, 'billing-image-kit-start', {
    workspaceId,
    idempotencyKey: 'private-owner-kit',
    brief: 'Private saved approval prompts',
  });
  const executionId = pending.body.result.executionId;
  const forged = {
    credential: owner!.credential,
    user: { id: owner!.actorId },
    actorId: owner!.actorId,
    workspaceId,
    accountId: artifact.accountId,
    executionId,
    billing: { workspaceId, actorId: owner!.actorId, accountId: artifact.accountId },
  };
  // A real invitation grants membership; Emma's own personal payer remains separate.
  expect((await server.call(`/billing/workspaces/${workspaceId}`, undefined, 'member')).status).toBe(200);
  const memberGenerated = await tool(
    server,
    'billing-image-generate',
    { workspaceId, idempotencyKey: 'shared-member-image', brief: 'Emma owns this shared image' },
    'member',
    forged,
  );
  expect(memberGenerated.body.billing).toMatchObject({ billedUnits: 1, workspaceId });
  expect(memberGenerated.body.result.object.artifacts[0].creatorId).toBe(member!.actorId);
  for (const mode of ['dev', 'start'] as const) {
    if (mode === 'start') {
      await server.close();
      await command(f.root, ['run', 'build'], f.env);
      server = await serve(f.root, f.env, 'start');
    }
    const before = {
      images: f.boundary.images.length,
      models: f.boundary.models.length,
      ledger: await query(f.root, 'SELECT * FROM billing_ledger ORDER BY execution_id'),
      meters: await query(f.root, 'SELECT * FROM commercial_meters ORDER BY account_id, key'),
    };
    for (const authorization of [undefined, 'Bearer invalid']) {
      const response = await fetch(`${server.url}/api/tools/billing-image-generate/execute`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
        body: JSON.stringify({
          data: { workspaceId, idempotencyKey: `${mode}-unauthenticated`, brief: 'Forged owner generation' },
          requestContext: forged,
        }),
      });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: 'unauthenticated' } });
    }
    for (const profile of ['member', 'outsider'] as const) {
      for (const [id, data] of [
        ['billing-account', { workspaceId }],
        ['billing-image-kit-status', { workspaceId, executionId }],
        [
          'billing-image-kit-approve',
          { workspaceId, executionId, idempotencyKey: `${mode}-${profile}-approve`, approval: { approved: true } },
        ],
        ['billing-image-kit-cancel', { workspaceId, executionId, idempotencyKey: `${mode}-${profile}-cancel` }],
      ] as const)
        expect(await tool(server, id, data, profile, forged)).toMatchObject({ body: { error: { code: 'forbidden' } } });
    }
    expect(
      await tool(
        server,
        'billing-image-generate',
        { workspaceId, idempotencyKey: `${mode}-outsider`, brief: 'Steal owner credits' },
        'outsider',
        forged,
      ),
    ).toMatchObject({ body: { error: { code: 'forbidden' } } });
    const path = `/billing/workspaces/${workspaceId}/artifacts/${artifact.id}`;
    for (const [target, credential, expected] of [
      [path, undefined, 401],
      [path, 'invalid', 401],
      [path, member!.credential, 403],
      [path, outsider!.credential, 403],
      [`${path}?token=${owner!.credential}`, undefined, 401],
      [`${path}?authorization=Bearer%20${owner!.credential}`, undefined, 401],
      [`/billing/workspaces/${member!.workspaceId}/artifacts/${artifact.id}`, member!.credential, 403],
      [`/billing/workspaces/${workspaceId}/artifacts/%2e%2e%2flocal-profiles.json`, owner!.credential, 400],
    ] as const) {
      const response = await fetch(server.url + target, {
        headers: credential ? { authorization: `Bearer ${credential}` } : {},
        redirect: 'error',
      });
      expect(response.status, `${mode} artifact access`).toBe(expected);
      expect(await response.text()).not.toContain(owner!.credential);
    }
    for (const route of ALL_SERVER_ROUTES) {
      const path = `/api${route.path}`
        .replace(/:agentId/g, 'image-agent')
        .replace(/:workflowId/g, 'image-kit')
        .replace(/:runId/g, executionId)
        .replace(/:toolId/g, 'billing-image-generate')
        .replace(/:[^/]+/g, 'private')
        .replace(/\{[^}]+\}/g, 'private')
        .replace(/\*/g, 'private');
      const method = route.method === 'ALL' ? 'POST' : route.method;
      // The narrow read-only Studio catalog and public auth capabilities are exercised separately.
      if (
        method === 'GET' &&
        ['/api/tools', '/api/tools/billing-image-generate', '/api/agents', '/api/auth/capabilities'].includes(path)
      )
        continue;
      // Billed standalone execution is exercised above; no other native tool execution is allowed.
      if (method === 'POST' && path === '/api/tools/billing-image-generate/execute') continue;
      for (const authorization of [undefined, `Bearer ${owner!.credential}`]) {
        const response = await fetch(server.url + path, {
          method,
          headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
          ...(['GET', 'HEAD'].includes(method)
            ? {}
            : {
                body: JSON.stringify({
                  messages: [{ role: 'user', content: 'bypass' }],
                  inputData: { brief: 'bypass' },
                  requestContext: forged,
                }),
              }),
          signal: AbortSignal.timeout(5000),
        });
        expect(response.status, `${mode} ${method} ${path}`).toBe(403);
        expect(await response.text()).toContain('billing_gateway_required');
      }
    }
    for (const path of [
      '/api/tools/unknown/execute',
      '/.well-known/agent.json',
      '/api/learning/private',
      '/__restart-active-workflow-runs',
      '/swagger-ui',
      '/openapi.json',
      `/private-images/${artifact.id}.png`,
      `/data/private-images/${artifact.id}.png`,
      `/assets/../private-images/${artifact.id}.png`,
      '/data/local-profiles.json',
    ]) {
      const response = await fetch(server.url + path, {
        method: path.endsWith('/execute') || path.startsWith('/__restart') ? 'POST' : 'GET',
        headers: { authorization: `Bearer ${owner!.credential}`, 'content-type': 'application/json' },
        redirect: 'error',
      });
      expect(response.status, `${mode} ${path}`).toBe(403);
      expect(await response.text()).toContain('billing_gateway_required');
    }
    await query(f.root, 'DELETE FROM memberships WHERE workspace_id = ? AND identity_id = ?', [
      workspaceId,
      owner!.actorId,
    ]);
    try {
      const revoked = await fetch(server.url + path, { headers: { authorization: `Bearer ${owner!.credential}` } });
      expect(revoked.status).toBe(403);
      expect(await revoked.json()).toMatchObject({ error: { code: 'forbidden' } });
    } finally {
      await query(f.root, "INSERT INTO memberships VALUES (?, ?, 'owner')", [workspaceId, owner!.actorId]);
    }
    await download(server, f.root, artifact, f.boundary.png);
    expect((await tool(server, 'billing-image-kit-status', { workspaceId, executionId })).body.result).toEqual(
      pending.body.result,
    );
    expect(f.boundary.images).toHaveLength(before.images);
    expect(f.boundary.models).toHaveLength(before.models);
    expect(await query(f.root, 'SELECT * FROM billing_ledger ORDER BY execution_id')).toEqual(before.ledger);
    expect(await query(f.root, 'SELECT * FROM commercial_meters ORDER BY account_id, key')).toEqual(before.meters);
    expect(
      await query(
        f.root,
        'SELECT balance, consumed FROM commercial_meters WHERE account_id = (SELECT id FROM billing_accounts WHERE workspace_id = ?) AND key = ?',
        [member!.workspaceId, 'credits'],
      ),
    ).toMatchObject([{ balance: 30, consumed: 0 }]);
  }
}, 600000);

const chatAgent = '/api/agents/studio-assistant';
async function chatHistory(server: Server, threadId: string) {
  return server.call(`/api/memory/threads/${threadId}/messages?agentId=studio-assistant`);
}
async function waitForHistory(server: Server, threadId: string, expected: string) {
  let history: any;
  for (let attempt = 0; attempt < 200; attempt++) {
    history = await chatHistory(server, threadId);
    if (history.status === 200 && JSON.stringify(history.body).includes(expected)) return history.body;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Conversation did not persist ${expected}: ${JSON.stringify(history)}`);
}
it('Studio chat persists history and returns one billed agent result through native signals', async () => {
  const f = await fixture();
  const server = await serve(f.root, f.env);
  cleanups.push(server.close);
  expect((await server.call(`${chatAgent}?requestContext=${encodeURIComponent('{}')}`)).status).toBe(200);
  expect((await server.call(`${chatAgent}?requestContext=e30%3D`)).status).toBe(200);
  expect((await server.call(`${chatAgent}?requestContext=eyJyZXF1ZXN0Q29udGV4dCI6e319&status=draft`)).status).toBe(200);
  expect((await server.call(`${chatAgent}?requestContext=e30%3D&versionId=forged`)).status).toBe(403);
  expect(
    (
      await server.call(
        `${chatAgent}?requestContext=${encodeURIComponent(Buffer.from(JSON.stringify({ actorId: f.manifest.profiles.member!.actorId })).toString('base64'))}`,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await server.call(
        `${chatAgent}?requestContext=${encodeURIComponent(JSON.stringify({ actorId: f.manifest.profiles.member!.actorId }))}`,
      )
    ).status,
  ).toBe(403);
  const threadId = 'native-history-thread';
  const greeting = await server.call(`${chatAgent}/send-message`, {
    threadId,
    resourceId: 'default',
    message: { contents: 'Hello Studio', metadata: { clientMessageId: 'client-set-native-greeting' } },
    ifIdle: {
      streamOptions: { maxSteps: 8, modelSettings: { maxRetries: 2 }, tracingOptions: {}, requestContext: {} },
    },
  });
  expect(greeting.status, JSON.stringify(greeting.body)).toBe(200);
  await waitForHistory(server, threadId, 'Saved conversation result.');
  expect(await query(f.root, 'SELECT * FROM billing_executions')).toHaveLength(0);
  const generated = await server.call(`${chatAgent}/send-message`, {
    threadId,
    resourceId: 'default',
    message: 'CALL image {"action":"execute","prompt":"A blue bird in a quiet forest"}',
  });
  expect(generated.status).toBe(200);
  const history = await waitForHistory(server, threadId, 'billedUnits');
  expect(JSON.stringify(history)).toContain('operationId');
  expect(JSON.stringify(history)).toContain('artifacts');
  expect(await query(f.root, 'SELECT units FROM billing_ledger')).toMatchObject([{ units: 1 }]);
  expect(f.boundary.images).toHaveLength(1);
  expect(await query(f.root, 'SELECT execution_id FROM billing_studio_operations')).toHaveLength(1);
}, 180000);

const toolResults = (history: any) =>
  history.messages
    .flatMap((message: any) => message.content.parts ?? [])
    .map((part: any) => part.toolInvocation?.result)
    .filter(Boolean);
async function sendTool(server: Server, threadId: string, name: string, input: unknown) {
  const response = await server.call(`${chatAgent}/send-message`, {
    threadId,
    resourceId: 'default',
    message: `CALL ${name} ${JSON.stringify(input)}`,
  });
  expect(response.status, JSON.stringify(response.body)).toBe(200);
}
async function waitQuery(
  root: string,
  sql: string,
  predicate: (rows: any[]) => boolean,
  args: (string | number)[] = [],
) {
  let rows: any[] = [];
  for (let attempt = 0; attempt < 240; attempt++) {
    const inspected = await query(root, sql, args).catch(error => {
      // Concurrent application writes can briefly lock this separate inspection client.
      if (error !== null && typeof error === 'object' && 'code' in error && error.code === 'SQLITE_BUSY')
        return undefined;
      throw error;
    });
    if (inspected !== undefined) {
      rows = inspected;
      if (predicate(rows)) return rows;
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Persisted state did not settle: ${sql}: ${JSON.stringify(rows)}`);
}
async function pendingChat(server: Server, root: string, threadId: string) {
  await sendTool(server, threadId, 'image-kit-start', { brief: 'A blue bird story for books and websites' });
  const history = await waitForHistory(server, threadId, 'suspendedSteps');
  const started = toolResults(history).find((result: any) => result.result?.status === 'suspended');
  expect(started.billing).toMatchObject({ billedUnits: null, settlementStatus: 'reserved' });
  await sendTool(server, threadId, 'image-kit-resume', {
    operationId: started.operationId,
    step: 'approval',
    approvalData: { approved: true },
  });
  const rows = await waitQuery(
    root,
    "SELECT * FROM billing_studio_operations WHERE thread_id = ? AND action = 'resume'",
    rows => rows.length === 1,
    [threadId],
  ).catch(async error => {
    throw new Error(`${error.message}: ${JSON.stringify(await chatHistory(server, threadId))}`);
  });
  const pending = await waitForHistory(server, threadId, 'pendingToolApprovals');
  const message = pending.messages.findLast(
    (message: any) =>
      message.content.metadata?.pendingToolApprovals &&
      Object.keys(message.content.metadata.pendingToolApprovals).length,
  );
  const [toolCallId, native] = Object.entries(message.content.metadata.pendingToolApprovals)[0] as [
    string,
    { runId: string },
  ];
  expect(rows[0].tool_call_id).toBe(toolCallId);
  expect(JSON.parse(rows[0].pending).nativeRunId).toBe(native.runId);
  return { started, approval: { toolCallId, nativeRunId: native.runId } };
}
async function subscriptionHistory(server: Server, threadId: string) {
  const controller = new AbortController();
  const response = await fetch(server.url + `${chatAgent}/threads/subscribe`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${server.manifest.profiles.owner!.credential}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ threadId, resourceId: 'default', withInitialHistory: true, withRunStatus: true }),
    signal: controller.signal,
  });
  expect(response.status).toBe(200);
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const chunks: any[] = [];
  try {
    for (let attempt = 0; attempt < 50; attempt++) {
      const read = reader.read();
      const part = await Promise.race([
        read,
        new Promise<null>(resolve =>
          setTimeout(() => resolve(null), chunks.some(chunk => chunk.type === 'thread-history') ? 300 : 2000),
        ),
      ]);
      if (!part || part.done) break;
      buffer += decoder.decode(part.value, { stream: true });
      expect(buffer.length).toBeLessThan(256000);
      let end;
      while ((end = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        const data = frame
          .split('\n')
          .filter(line => line.startsWith('data:'))
          .map(line => line.slice(5).trim())
          .join('\n');
        if (data && data !== '[DONE]') chunks.push(JSON.parse(data));
      }
    }
  } finally {
    controller.abort();
    await reader.cancel().catch(() => {});
  }
  const history = chunks.find(chunk => chunk.type === 'thread-history');
  expect(history).toBeTruthy();
  return { history: history.payload, chunks };
}
it('Studio native approval and decline use the persisted billed workflow suspension', async () => {
  const f = await fixture();
  const server = await serve(f.root, f.env);
  cleanups.push(server.close);
  const approved = await pendingChat(server, f.root, 'native-approve-thread');
  expect(f.boundary.images).toHaveLength(0);
  const result = await server.call(`${chatAgent}/send-tool-approval`, {
    threadId: 'native-approve-thread',
    resourceId: 'default',
    toolCallId: approved.approval.toolCallId,
    approved: true,
  });
  expect(result.status, JSON.stringify(result.body)).toBe(200);
  await waitQuery(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', rows => rows.length === 1, [
    approved.started.result.executionId,
  ]);
  expect(await query(f.root, 'SELECT units FROM billing_ledger')).toMatchObject([{ units: 3 }]);
  expect(f.boundary.images).toHaveLength(3);
  expect(
    await query(f.root, 'SELECT resource_id, COUNT(*) AS count FROM billing_executions GROUP BY resource_id'),
  ).toMatchObject([{ resource_id: 'image-kit', count: 1 }]);
  const calls = f.boundary.images.length;
  const repeat = await server.call(`${chatAgent}/send-tool-approval`, {
    threadId: 'native-approve-thread',
    resourceId: 'default',
    toolCallId: approved.approval.toolCallId,
    approved: true,
  });
  expect(repeat).toMatchObject({ status: 200, body: { accepted: true, toolCallId: approved.approval.toolCallId } });
  expect(f.boundary.images).toHaveLength(calls);
  const declined = await pendingChat(server, f.root, 'native-decline-thread');
  const decline = await server.call(`${chatAgent}/send-tool-approval`, {
    threadId: 'native-decline-thread',
    resourceId: 'default',
    toolCallId: declined.approval.toolCallId,
    approved: false,
  });
  expect(decline.status, JSON.stringify(decline.body)).toBe(200);
  await waitQuery(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', rows => rows.length === 1, [
    declined.started.result.executionId,
  ]);
  expect(
    await query(f.root, 'SELECT units, active FROM billing_reservations WHERE execution_id = ?', [
      declined.started.result.executionId,
    ]),
  ).toMatchObject([{ units: 3, active: 0 }]);
  expect(
    await query(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', [
      declined.started.result.executionId,
    ]),
  ).toMatchObject([{ units: 0 }]);
  expect(
    (
      await server.call(`${chatAgent}/send-tool-approval`, {
        threadId: 'native-decline-thread',
        resourceId: 'default',
        toolCallId: declined.approval.toolCallId,
        approved: false,
      })
    ).status,
  ).toBe(200);
  expect(f.boundary.images).toHaveLength(calls);
  await sendTool(server, 'native-explicit-cancel', 'image-kit-start', {
    brief: 'Cancel this separate business operation',
  });
  const cancelHistory = await waitForHistory(server, 'native-explicit-cancel', 'suspendedSteps');
  const cancelStart = toolResults(cancelHistory).find((result: any) => result.result?.status === 'suspended');
  await sendTool(server, 'native-explicit-cancel', 'image-kit-cancel', { operationId: cancelStart.operationId });
  await waitQuery(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', rows => rows.length === 1, [
    cancelStart.result.executionId,
  ]);
  expect(
    await query(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', [cancelStart.result.executionId]),
  ).toMatchObject([{ units: 0 }]);
  const stopped = await pendingChat(server, f.root, 'native-stopped-approval');
  const nativeRunId = stopped.approval.nativeRunId;
  const stop = await server.call(`${chatAgent}/threads/abort`, {
    threadId: 'native-stopped-approval',
    resourceId: 'default',
    expectedRunId: nativeRunId,
  });
  expect(stop).toMatchObject({ status: 200, body: { aborted: true } });
  const business = await tool(server, 'billing-image-kit-status', {
    workspaceId: f.manifest.profiles.owner!.workspaceId,
    executionId: stopped.started.result.executionId,
  });
  expect(business.body).toMatchObject({
    result: { status: 'suspended' },
    billing: { billedUnits: null, settlementStatus: 'reserved' },
  });
  const reloaded = await subscriptionHistory(server, 'native-stopped-approval');
  expect(reloaded.history.activeRunId).toBeNull();
  const stoppedMessage = reloaded.history.messages.find((message: any) =>
    message.content.parts.some((part: any) => part.toolInvocation?.toolCallId === stopped.approval.toolCallId),
  );
  const stoppedPart = stoppedMessage.content.parts.find(
    (part: any) => part.toolInvocation?.toolCallId === stopped.approval.toolCallId,
  );
  expect(stoppedPart.toolInvocation).toMatchObject({
    state: 'output-error',
    errorText: expect.stringContaining('Conversation stopped'),
  });
  expect(stoppedMessage.content.metadata?.pendingToolApprovals).toBeUndefined();
  expect(
    reloaded.chunks
      .filter(chunk => chunk.type === 'thread-run-status' && chunk.runId === nativeRunId)
      .map(chunk => chunk.payload.status),
  ).not.toEqual(expect.arrayContaining(['running']));
  expect(
    reloaded.chunks.some(
      chunk => ['tool-call-approval', 'tool-call-suspended'].includes(chunk.type) && chunk.runId === nativeRunId,
    ),
  ).toBe(false);
  await sendTool(server, 'native-stopped-approval', 'image-kit-query', {});
  const continued = await waitForHistory(server, 'native-stopped-approval', '"operations":[');
  const existing = toolResults(continued)
    .flatMap((result: any) => result.operations ?? [])
    .find((result: any) => result.result?.status === 'suspended');
  expect(existing.billing).toMatchObject({ billedUnits: null, settlementStatus: 'reserved' });
  await sendTool(server, 'native-stopped-approval', 'image-kit-cancel', { operationId: existing.operationId });
  await waitQuery(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', rows => rows.length === 1, [
    existing.result.executionId,
  ]);
  expect(
    await query(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', [existing.result.executionId]),
  ).toMatchObject([{ units: 0 }]);
}, 180000);

it('Studio chat ownership revocation and forged context close native and operation bypasses', async () => {
  const f = await fixture(true);
  const server = await serve(f.root, f.env);
  cleanups.push(server.close);
  const threadId = 'private-chat';
  await sendTool(server, threadId, 'image-kit-start', { brief: 'Private saved business prompts' });
  const history = await waitForHistory(server, threadId, 'operationId');
  const operation = toolResults(history)[0];
  const { owner, member } = f.manifest.profiles;
  await waitForHistory(server, threadId, 'Saved conversation result.');
  const before = {
    images: f.boundary.images.length,
    models: f.boundary.models.length,
    operations: await query(f.root, 'SELECT * FROM billing_studio_operations'),
  };
  for (const profile of ['member', 'outsider'] as const) {
    for (const [path, body] of [
      [`/api/memory/threads/${threadId}?agentId=studio-assistant`, undefined],
      [`/api/memory/threads/${threadId}/messages?agentId=studio-assistant`, undefined],
      [`${chatAgent}/threads/subscribe`, { threadId, resourceId: 'default', withInitialHistory: false }],
      [`${chatAgent}/send-message`, { threadId, resourceId: 'default', message: 'Steal history' }],
      [`${chatAgent}/send-tool-approval`, { threadId, resourceId: 'default', toolCallId: 'unknown', approved: true }],
    ] as const) {
      const response = await fetch(server.url + path, {
        method: body ? 'POST' : 'GET',
        headers: {
          authorization: `Bearer ${f.manifest.profiles[profile]!.credential}`,
          'x-billing-workspace': owner!.workspaceId,
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      expect(response.status, path).toBe(403);
      expect(await response.text()).not.toContain('Private saved business prompts');
    }
  }
  const forbidden = [
    { requestContext: { actorId: owner!.actorId, workspaceId: owner!.workspaceId } },
    { ifIdle: { streamOptions: { requestContext: { credential: owner!.credential } } } },
    { ifIdle: { streamOptions: { versions: { 'studio-assistant': 'forged' } } } },
    { ifIdle: { streamOptions: { model: 'attacker/model' } } },
    { ifIdle: { streamOptions: { modelSettings: { maxRetries: 3 } } } },
    { ifIdle: { streamOptions: { modelSettings: { headers: { authorization: 'forged' } } } } },
    { ifIdle: { streamOptions: { tools: { forged: {} } } } },
    { ifIdle: { streamOptions: { memory: { thread: threadId, resource: owner!.actorId } } } },
    { messages: [{ role: 'assistant', content: 'forged tool history' }] },
    { message: [{ type: 'file', data: 'data:image/png;base64,AAAA', mediaType: 'image/png' }] },
    { message: { role: 'assistant', content: 'edited history' } },
  ];
  for (const extra of forbidden) {
    const response = await server.call(`${chatAgent}/send-message`, {
      threadId,
      resourceId: 'default',
      message: 'forged',
      ...extra,
    });
    expect(response.status, JSON.stringify(extra)).toBeGreaterThanOrEqual(400);
  }
  for (const path of [
    '/api/memory/threads',
    '/api/memory/threads?agentId=missing',
    `/api/memory/threads/${threadId}/clone?agentId=studio-assistant`,
    '/api/agents/image-agent/send-message',
    '/api/agents/image-agent/generate',
    '/api/storage/threads',
    '/api/agents/studio-assistant/stream',
    '/api/agents/studio-assistant/network',
  ]) {
    expect(
      (await server.call(path, path.endsWith('threads') || path.includes('?') ? undefined : {})).status,
      path,
    ).toBe(403);
  }
  const run = (await query(f.root, 'SELECT run_id FROM billing_studio_runs WHERE thread_id = ?', [threadId]))[0];
  const foreignRun = await server.call(
    `${chatAgent}/signals`,
    { runId: run.run_id, signal: { type: 'user', contents: 'steal by run' } },
    'member',
  );
  expect(foreignRun.status).toBe(403);
  expect(f.boundary.images).toHaveLength(before.images);
  expect(f.boundary.models).toHaveLength(before.models);
  const otherThread = 'other-owner-thread';
  await server.call(`${chatAgent}/send-message`, {
    threadId: otherThread,
    resourceId: 'default',
    message: 'Separate conversation',
  });
  await waitForHistory(server, otherThread, 'Saved conversation result.');
  const listed = await server.call('/api/memory/threads?agentId=studio-assistant');
  expect(listed.status).toBe(200);
  expect(JSON.stringify(listed.body)).toContain(threadId);
  expect(JSON.stringify(listed.body)).toContain(otherThread);
  await sendTool(server, 'member-own-thread', 'image-kit-query', { operationId: operation.operationId });
  const deniedQuery = await waitForHistory(server, 'member-own-thread', 'forbidden');
  expect(JSON.stringify(deniedQuery)).not.toContain('Private saved business prompts');
  await query(f.root, 'DELETE FROM memberships WHERE workspace_id = ? AND identity_id = ?', [
    owner!.workspaceId,
    owner!.actorId,
  ]);
  try {
    expect((await chatHistory(server, threadId)).status).toBe(403);
  } finally {
    await query(f.root, "INSERT INTO memberships VALUES (?, ?, 'owner')", [owner!.workspaceId, owner!.actorId]);
  }
  expect(f.boundary.images).toHaveLength(before.images);
  expect(await query(f.root, 'SELECT * FROM billing_studio_operations')).toEqual(before.operations);
  expect(member!.actorId).not.toBe(owner!.actorId);
  await query(f.root, 'UPDATE local_credentials SET active = 0 WHERE identity_id = ?', [owner!.actorId]);
  try {
    for (const [path, body] of [
      [`/api/memory/threads/${threadId}/messages?agentId=studio-assistant`, undefined],
      [`${chatAgent}/send-message`, { threadId, resourceId: 'default', message: 'revoked input' }],
      [`${chatAgent}/send-tool-approval`, { threadId, resourceId: 'default', toolCallId: 'unknown', approved: true }],
    ] as const)
      expect((await server.call(path, body)).status).toBe(401);
  } finally {
    await query(f.root, 'UPDATE local_credentials SET active = 1 WHERE identity_id = ?', [owner!.actorId]);
  }
  await server.close();
  const keys = await generateKeyPair('EdDSA');
  const identityConfiguration = {
    issuer: 'https://studio-identity.example.test',
    audience: 'studio',
    algorithms: ['EdDSA'],
    jwks: { keys: [await exportJWK(keys.publicKey)] },
  };
  await writeFile(join(f.root, 'identity.json'), JSON.stringify(identityConfiguration));
  const jwtEnvironment = { ...f.env, BILLING_PROJECT_ROOT: f.root, BILLING_IDENTITY_CONFIG_FILE: 'identity.json' };
  const organizations = await configuredOrganizations(jwtEnvironment);
  await organizations.provisionJwt({
    issuer: identityConfiguration.issuer,
    subject: 'native-expiring-user',
    displayName: 'Native Expiring User',
  });
  organizations.close();
  const sign = (expired: boolean) =>
    new SignJWT({})
      .setProtectedHeader({ alg: 'EdDSA' })
      .setIssuer(identityConfiguration.issuer)
      .setAudience('studio')
      .setSubject('native-expiring-user')
      .setExpirationTime(Math.floor(Date.now() / 1000) + (expired ? -1 : 3600))
      .sign(keys.privateKey);
  const valid = await sign(false),
    expired = await sign(true);
  const jwtServer = await serve(f.root, jwtEnvironment, 'dev', valid);
  cleanups.push(jwtServer.close);
  const jwtCall = (path: string, body: unknown, token: string) =>
    fetch(jwtServer.url + path, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  expect(
    (
      await jwtCall(
        `${chatAgent}/send-message`,
        { threadId: 'jwt-thread', resourceId: 'default', message: 'A valid signed conversation' },
        valid,
      )
    ).status,
  ).toBe(200);
  await waitForHistory(jwtServer, 'jwt-thread', 'Saved conversation result.');
  const jwtBefore = { images: f.boundary.images.length, models: f.boundary.models.length };
  for (const [path, body] of [
    [`/api/memory/threads/jwt-thread/messages?agentId=studio-assistant`, undefined],
    [`${chatAgent}/send-message`, { threadId: 'jwt-thread', resourceId: 'default', message: 'expired input' }],
    [
      `${chatAgent}/send-tool-approval`,
      { threadId: 'jwt-thread', resourceId: 'default', toolCallId: 'unknown', approved: true },
    ],
  ] as const)
    expect((await jwtCall(path, body, expired)).status).toBe(401);
  expect(f.boundary.images).toHaveLength(jwtBefore.images);
  expect(f.boundary.models).toHaveLength(jwtBefore.models);
}, 180000);

it('Studio configuration files and memory work across setup dev build and restart without framework upgrades', async () => {
  const f = await fixture();
  const file = join(f.root, 'billing.json');
  const configuration = imageConfiguration(Object.values(f.manifest.profiles).map(profile => profile!.workspaceId));
  await writeFile(file, JSON.stringify(configuration), { mode: 0o600 });
  const env = { ...f.env, BILLING_CONFIG_FILE: 'billing.json' };
  expect((await command(f.root, ['run', 'setup'], env)).code).toBe(0);
  expect(readConfigurationFile({ BILLING_CONFIG_FILE: file }, 'BILLING_CONFIG_FILE')).toEqual(configuration);
  expect(
    readConfigurationFile({ BILLING_PROJECT_ROOT: f.root, BILLING_CONFIG_FILE: 'billing.json' }, 'BILLING_CONFIG_FILE'),
  ).toEqual(configuration);
  let server = await serve(f.root, env);
  cleanups.push(() => server.close());
  await server.call(`${chatAgent}/send-message`, {
    threadId: 'restart-memory',
    resourceId: 'default',
    message: 'Remember this text after restart',
  });
  await waitForHistory(server, 'restart-memory', 'Saved conversation result.');
  await server.close();
  await command(f.root, ['run', 'build'], env);
  server = await serve(f.root, env, 'start');
  expect(JSON.stringify((await chatHistory(server, 'restart-memory')).body)).toContain(
    'Remember this text after restart',
  );
  for (const path of [
    '/agents/studio-assistant/threads/restart-memory',
    '/agents/studio-assistant/session/restart-memory',
  ]) {
    expect((await fetch(server.url + path)).status, path).toBe(200);
  }
  expect(await query(f.root, 'SELECT * FROM billing_executions')).toHaveLength(0);
  for (const name of ['BILLING_CONFIG_FILE', 'AUTUMN_CONFIG_FILE', 'BILLING_IDENTITY_CONFIG_FILE']) {
    for (const path of ['', 'missing.json', 'malformed.json', 'array.json']) {
      await writeFile(join(f.root, 'malformed.json'), '{"secret":"do-not-leak"');
      await writeFile(join(f.root, 'array.json'), '[]');
      expect(() => readConfigurationFile({ BILLING_PROJECT_ROOT: f.root, [name]: path }, name)).toThrow(
        'Billing configuration is invalid',
      );
      expect(() =>
        createBilling({ environment: { BILLING_PROJECT_ROOT: f.root, [name]: path }, billingKeys: { meters: [] } }),
      ).toThrow('Billing configuration is invalid');
    }
  }
  const unreadable = join(f.root, 'unreadable.json');
  await writeFile(unreadable, '{}');
  await chmod(unreadable, 0);
  try {
    for (const name of ['BILLING_CONFIG_FILE', 'AUTUMN_CONFIG_FILE', 'BILLING_IDENTITY_CONFIG_FILE'])
      expect(() =>
        createBilling({
          environment: { BILLING_PROJECT_ROOT: f.root, [name]: unreadable },
          billingKeys: { meters: [] },
        }),
      ).toThrow('Billing configuration is invalid');
  } finally {
    await chmod(unreadable, 0o600);
  }
  await writeFile(join(f.root, 'schema-invalid.json'), '{}');
  for (const name of ['BILLING_CONFIG_FILE', 'AUTUMN_CONFIG_FILE', 'BILLING_IDENTITY_CONFIG_FILE'])
    expect(() =>
      createBilling({
        environment: { BILLING_PROJECT_ROOT: f.root, [name]: 'schema-invalid.json' },
        billingKeys: { meters: [] },
      }),
    ).toThrow('Billing configuration is invalid');
  expect(readConfigurationFile({ BILLING_CONFIGURATION: '{bad legacy JSON' }, 'BILLING_CONFIG_FILE')).toBeUndefined();
  const lock = JSON.parse(await readFile(join(f.root, 'package-lock.json'), 'utf8'));
  expect(lock.packages['node_modules/@mastra/core'].version).toBe('1.82.0');
  expect(lock.packages['node_modules/@mastra/libsql'].version).toBe('1.29.0');
  expect(lock.packages['node_modules/mastra'].version).toBe('1.38.0');
  expect(lock.packages['node_modules/@mastra/memory'].version).toBe('1.41.0');
}, 300000);

it('Studio replay reconnect Stop and restart preserve one business operation without uncertain recompute', async () => {
  const f = await fixture();
  let server = await serve(f.root, f.env);
  cleanups.push(() => server.close());
  f.boundary.mode('stall');
  const input = {
    threadId: 'native-replay-stop',
    resourceId: 'default',
    signal: {
      id: 'stable-native-message',
      type: 'user',
      contents: 'CALL image {"action":"execute","prompt":"A blue bird held at the image boundary"}',
    },
  };
  const replay = await Promise.all([
    server.call(`${chatAgent}/signals`, input),
    server.call(`${chatAgent}/signals`, input),
  ]);
  expect(replay.map(result => result.status)).toEqual([200, 200]);
  await f.boundary.started();
  const links = await waitQuery(
    f.root,
    'SELECT * FROM billing_studio_operations WHERE thread_id = ?',
    rows => rows.length === 1,
    [input.threadId],
  );
  const business = await waitQuery(
    f.root,
    "SELECT id FROM billing_executions WHERE status = 'running'",
    rows => rows.length === 1,
  );
  const conversationCalls = () => f.boundary.models.filter(model => model.path.endsWith('/chat/completions')).length;
  const ownedRunSignal = await server.call(`${chatAgent}/signals`, {
    runId: replay[0].body.runId,
    signal: { type: 'user', contents: 'Observe the existing admitted operation.' },
  });
  expect(ownedRunSignal.status, JSON.stringify(ownedRunSignal.body)).toBe(200);
  const beforeStop = conversationCalls();
  const stopped = await server.call(`${chatAgent}/threads/abort`, {
    threadId: input.threadId,
    resourceId: 'default',
    expectedRunId: replay[0].body.runId,
  });
  expect(stopped.status).toBe(200);
  expect(
    await query(f.root, 'SELECT units, active FROM billing_reservations WHERE execution_id = ?', [
      String(business[0].id),
    ]),
  ).toMatchObject([{ units: 1, active: 1 }]);
  f.boundary.release();
  await waitQuery(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', rows => rows.length === 1, [
    String(business[0].id),
  ]);
  expect(
    await query(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', [String(business[0].id)]),
  ).toMatchObject([{ units: 1 }]);
  expect(conversationCalls()).toBe(beforeStop);
  expect(f.boundary.images).toHaveLength(1);
  f.boundary.mode('success');
  await sendTool(server, input.threadId, 'image', { action: 'query' });
  const discovered = await waitForHistory(server, input.threadId, '"operations":[');
  expect(toolResults(discovered).flatMap((result: any) => result.operations ?? [])).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ operationId: links[0].id, billing: expect.objectContaining({ billedUnits: 1 }) }),
    ]),
  );
  expect(f.boundary.images).toHaveLength(1);
  // A new native tool call creates new business work, while the old invocation remains immutable.
  await sendTool(server, 'new-business-thread', 'image', { action: 'execute', prompt: 'A new independent blue bird' });
  await waitForHistory(server, 'new-business-thread', 'billedUnits');
  expect(f.boundary.images).toHaveLength(2);
  const subscriptionController = new AbortController();
  const subscription = await fetch(server.url + `${chatAgent}/threads/subscribe`, {
    method: 'POST',
    headers: { authorization: `Bearer ${f.manifest.profiles.owner!.credential}`, 'content-type': 'application/json' },
    body: JSON.stringify({ threadId: 'disconnect-thread', resourceId: 'default', withInitialHistory: false }),
    signal: subscriptionController.signal,
  });
  expect(subscription.status).toBe(200);
  const reader = subscription.body!.getReader();
  void reader.read().catch(() => {});
  f.boundary.mode('stall');
  await sendTool(server, 'disconnect-thread', 'image', {
    action: 'execute',
    prompt: 'Business work survives browser disconnect',
  });
  await f.boundary.started();
  const disconnectBusiness = (await query(f.root, "SELECT id FROM billing_executions WHERE status = 'running'"))[0];
  const beforeDisconnect = conversationCalls();
  subscriptionController.abort();
  await new Promise(resolve => setTimeout(resolve, 100));
  expect(
    await query(f.root, 'SELECT active FROM billing_reservations WHERE execution_id = ?', [
      String(disconnectBusiness.id),
    ]),
  ).toMatchObject([{ active: 1 }]);
  f.boundary.release();
  await waitQuery(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', rows => rows.length === 1, [
    String(disconnectBusiness.id),
  ]);
  expect(conversationCalls()).toBe(beforeDisconnect);
  const staleControllers = [new AbortController(), new AbortController()];
  for (const controller of staleControllers) {
    const response = await fetch(server.url + `${chatAgent}/threads/subscribe`, {
      method: 'POST',
      headers: { authorization: `Bearer ${f.manifest.profiles.owner!.credential}`, 'content-type': 'application/json' },
      body: JSON.stringify({ threadId: 'new-subscription-thread', resourceId: 'default', withInitialHistory: false }),
      signal: controller.signal,
    });
    expect(response.status).toBe(200);
    void response
      .body!.getReader()
      .read()
      .catch(() => {});
  }
  f.boundary.mode('stall');
  await sendTool(server, 'new-subscription-thread', 'image', {
    action: 'execute',
    prompt: 'A newer subscription owns this activity',
  });
  await f.boundary.started();
  const staleStop = await server.call(`${chatAgent}/threads/abort`, {
    threadId: 'new-subscription-thread',
    resourceId: 'default',
    expectedRunId: replay[0].body.runId,
  });
  expect(staleStop.body).toEqual({ aborted: false });
  const beforeStaleDisconnect = conversationCalls();
  staleControllers[0].abort();
  f.boundary.release();
  await waitForHistory(server, 'new-subscription-thread', 'Saved conversation result.');
  expect(conversationCalls()).toBe(beforeStaleDisconnect + 1);
  staleControllers[1].abort();
  await sendTool(server, 'lost-workflow-output', 'image-kit-start', {
    brief: 'Recover this admitted workflow without an initial operation ID',
  });
  await waitQuery(
    f.root,
    "SELECT execution_id FROM billing_studio_operations WHERE thread_id = ? AND action = 'start'",
    rows => rows.length === 1 && !!rows[0].execution_id,
    ['lost-workflow-output'],
  );
  await server.call(`${chatAgent}/threads/abort`, { threadId: 'lost-workflow-output', resourceId: 'default' });
  await waitQuery(f.root, "SELECT status FROM billing_workflow_runs WHERE resource_id = 'image-kit'", rows =>
    rows.some(row => row.status === 'suspended'),
  );
  await sendTool(server, 'lost-workflow-output', 'image-kit-query', {});
  const recoveredWorkflowHistory = await waitForHistory(server, 'lost-workflow-output', '"operations":[');
  const recoveredWorkflow = toolResults(recoveredWorkflowHistory)
    .flatMap((result: any) => result.operations ?? [])
    .find((result: any) => result.result?.status === 'suspended');
  expect(recoveredWorkflow).toMatchObject({ billing: { billedUnits: null, settlementStatus: 'reserved' } });
  await sendTool(server, 'lost-workflow-output', 'image-kit-cancel', { operationId: recoveredWorkflow.operationId });
  await waitQuery(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', rows => rows.length === 1, [
    recoveredWorkflow.result.executionId,
  ]);
  expect(
    await query(f.root, 'SELECT units FROM billing_ledger WHERE execution_id = ?', [
      recoveredWorkflow.result.executionId,
    ]),
  ).toMatchObject([{ units: 0 }]);
  // Crash active conversation and business work; neither is automatically recomputed.
  f.boundary.mode('stall');
  await sendTool(server, 'crash-thread', 'image', {
    action: 'execute',
    prompt: 'Do not automatically recompute after restart',
  });
  await f.boundary.started();
  const crashLink = (
    await query(f.root, 'SELECT * FROM billing_studio_operations WHERE thread_id = ?', ['crash-thread'])
  )[0];
  const crashedModels = f.boundary.models.length;
  await server.close();
  f.boundary.release();
  f.boundary.mode('success');
  server = await serve(f.root, f.env);
  const imageCalls = f.boundary.images.length;
  expect(f.boundary.models).toHaveLength(crashedModels);
  await sendTool(server, 'crash-thread', 'image', { action: 'query' });
  const recovered = await waitForHistory(server, 'crash-thread', 'uncertain');
  expect(JSON.stringify(recovered)).toContain(crashLink.id);
  expect(f.boundary.images).toHaveLength(imageCalls);
  expect(
    await query(f.root, 'SELECT COUNT(*) AS count FROM billing_studio_operations WHERE thread_id = ?', [
      'crash-thread',
    ]),
  ).toMatchObject([{ count: 1 }]);
}, 240000);

it('Studio wrapper composition preserves public SDK results middleware and existing application surfaces', async () => {
  const f = await fixture();
  const application = await studioComposition(f.root, f.boundary.url);
  cleanups.push(application.close);
  const credential = f.manifest.profiles.owner!.credential;
  const call = async (path: string, body?: unknown, authenticated = true) => {
    const response = await fetch(application.url + path, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(authenticated ? { authorization: `Bearer ${credential}` } : {}),
        'content-type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
      status: response.status,
      calls: response.headers.get('x-application-calls'),
      body: await response.text().then(text => {
        try {
          return JSON.parse(text);
        } catch {
          return { raw: text };
        }
      }),
    };
  };
  expect(() => createStudioBillingWrapper({ integration: {} as any })).toThrow('Billing configuration is invalid');
  expect(() => createStudioBillingWrapper(undefined as any)).toThrow('Billing configuration is invalid');
  expect(() => createStudioBillingWrapper({ integration: application.integration, extra: true } as any)).toThrow(
    'Billing configuration is invalid',
  );
  expect(() => application.wrapper.agentTool('missing')).toThrow('Billing configuration is invalid');
  expect(() => application.wrapper.agentTool('report')).toThrow('Billing configuration is invalid');
  expect(() => application.wrapper.workflowTools('analysis')).toThrow('Billing configuration is invalid');
  expect(() => application.wrapper.workflowTools('report', { approvalSteps: ['missing'] })).toThrow(
    'Billing configuration is invalid',
  );
  expect(() => application.wrapper.workflowTools('report', { approvalSteps: ['review', 'review'] })).toThrow(
    'Billing configuration is invalid',
  );
  expect(Object.keys(application.wrapper.workflowTools('report'))).toEqual([
    'report-start',
    'report-query',
    'report-cancel',
  ]);
  expect(() => application.wrapper.decorateAgent(application.original)).toThrow('Billing configuration is invalid');
  expect(application.conversation).toBe(application.original);
  expect(await call('/status')).toMatchObject({ status: 200, calls: '1', body: { ready: true } });
  const admitted = await call('/private-api/agents/chat-alias/send-message', {
    threadId: 'composition-thread',
    resourceId: 'ignored-client-resource',
    message: 'CALL analyze {"action":"execute","prompt":"Transform once"}',
  });
  expect(admitted).toMatchObject({ status: 200, calls: '1' });
  await waitQuery(f.root, 'SELECT units FROM billing_ledger', rows => rows.length === 1);
  const modelRequest = f.boundary.models.find(
    model =>
      !model.body.stream &&
      model.body.messages?.some((message: any) => JSON.stringify(message).includes('Transform once')),
  );
  expect(JSON.stringify(modelRequest)).toContain('[prompt]Transform once');
  expect(JSON.stringify(modelRequest)).not.toContain('[prompt][prompt]');
  expect(await call('/sdk/composition-thread')).toMatchObject({
    status: 200,
    calls: '1',
    body: { answer: 'controlled', text: 'Saved conversation result.', finishReason: 'stop', hasUsage: true },
  });
  expect(await call('/private-api/agents/public/generate', { messages: 'Hello public agent' })).toMatchObject({
    status: 200,
    calls: '1',
    body: { text: 'Controlled business answer.' },
  });
  expect((await call('/private-api/agents/paid-alias/generate', { messages: 'bypass' })).status).toBe(403);
  expect((await call('/private-api/agents/chat-alias/generate', { messages: 'bypass' })).status).toBe(403);
  const beforeAliases = {
    models: f.boundary.models.length,
    ledger: await query(f.root, 'SELECT * FROM billing_ledger'),
  };
  for (const authenticated of [false, true]) {
    expect(
      (
        await call(
          '/private-api/agents/prepared-paid-alias/generate',
          { messages: 'bypass prepared alias' },
          authenticated,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await call(
          '/private-api/workflows/prepared-report-alias/start',
          { inputData: { value: 'bypass prepared workflow alias' } },
          authenticated,
        )
      ).status,
    ).toBe(403);
    expect(f.boundary.models).toHaveLength(beforeAliases.models);
    expect(await query(f.root, 'SELECT * FROM billing_ledger')).toEqual(beforeAliases.ledger);
  }
  for (const authenticated of [false, true]) {
    for (const alias of ['prepared-public-alias', 'public-alias'])
      expect(
        await call(
          `/private-api/agents/${alias}/generate`,
          { messages: 'An ordinary alias still works' },
          authenticated,
        ),
      ).toMatchObject({ status: 200, calls: '1', body: { text: 'Controlled business answer.' } });
    expect(
      await call(
        '/private-api/workflows/public-flow-alias/start',
        { inputData: { value: 'ordinary workflow alias' } },
        authenticated,
      ),
    ).toMatchObject({
      status: 200,
      calls: '1',
      body: { status: 'success', result: { value: 'ordinary workflow alias' } },
    });
  }
  expect(f.boundary.models).toHaveLength(beforeAliases.models + 4);
  expect(await query(f.root, 'SELECT * FROM billing_ledger')).toEqual(beforeAliases.ledger);

  const usage = await call('/private-api/tools/billing-account/execute', {
    data: { workspaceId: f.manifest.profiles.owner!.workspaceId },
  });
  expect(usage).toMatchObject({ status: 200, calls: '1', body: { mode: 'local' } });
  expect(await call('/billing/context')).toMatchObject({ status: 200, calls: '1' });
  await call('/private-api/agents/studio-assistant/send-message', {
    threadId: 'transform-workflow',
    resourceId: 'default',
    message: 'CALL report-start {"value":"source"}',
  });
  const pendingLinks = await waitQuery(
    f.root,
    "SELECT * FROM billing_studio_operations WHERE thread_id = ? AND action = 'start'",
    rows => rows.length === 1 && !!rows[0].execution_id,
    ['transform-workflow'],
  );
  const pending = await waitQuery(
    f.root,
    "SELECT result FROM billing_workflow_runs WHERE id = ? AND status = 'suspended'",
    rows => rows.length === 1,
    [pendingLinks[0].execution_id],
  );
  expect(JSON.stringify(pending)).toContain('[input]source');
  expect(JSON.stringify(pending)).not.toContain('[input][input]');
  const resumeRequest = await call('/private-api/agents/studio-assistant/send-message', {
    threadId: 'transform-workflow',
    resourceId: 'default',
    message: `CALL report-resume ${JSON.stringify({ operationId: pendingLinks[0].id, step: 'review', approvalData: { suffix: 'suffix' } })}`,
  });
  expect(
    resumeRequest.status,
    JSON.stringify({
      response: resumeRequest.body,
      memory: await (await application.conversation.getMemory())!.getThreadById({ threadId: 'transform-workflow' }),
      owner: await query(f.root, 'SELECT * FROM billing_studio_threads WHERE thread_id = ?', ['transform-workflow']),
    }),
  ).toBe(200);
  const approval = await waitQuery(
    f.root,
    "SELECT * FROM billing_studio_operations WHERE thread_id = ? AND action = 'resume'",
    rows => rows.length === 1,
    ['transform-workflow'],
  ).catch(async error => {
    throw new Error(
      `${error.message}: ${JSON.stringify(await call('/private-api/memory/threads/transform-workflow/messages?agentId=studio-assistant'))}`,
    );
  });
  expect(
    (
      await call('/private-api/agents/studio-assistant/send-tool-approval', {
        threadId: 'transform-workflow',
        resourceId: 'default',
        toolCallId: approval[0].tool_call_id,
        approved: true,
      })
    ).status,
  ).toBe(200);
  const transformed = await waitQuery(
    f.root,
    "SELECT result FROM billing_workflow_runs WHERE id = ? AND status = 'completed'",
    rows => rows.length === 1,
    [pendingLinks[0].execution_id],
  );
  expect(JSON.stringify(transformed)).toContain('[input]source[resume]suffix');
  expect(JSON.stringify(transformed)).not.toContain('[resume][resume]');
  expect(await query(f.root, 'SELECT units FROM billing_ledger ORDER BY units')).toMatchObject([
    { units: 1 },
    { units: 3 },
  ]);
}, 120000);
