import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
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
  return response.body.meters.find((meter: { key: string }) => meter.key === 'image-credits');
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
  // A real invitation grants membership; Mary's own personal payer remains separate.
  expect((await server.call(`/billing/workspaces/${workspaceId}`, undefined, 'member')).status).toBe(200);
  const memberGenerated = await tool(
    server,
    'billing-image-generate',
    { workspaceId, idempotencyKey: 'shared-member-image', brief: 'Mary owns this shared image' },
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
        [member!.workspaceId, 'image-credits'],
      ),
    ).toMatchObject([{ balance: 30, consumed: 0 }]);
  }
}, 600000);
