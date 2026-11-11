import { afterEach, expect, it } from 'vitest';
import { readFile, writeFile, rename, stat } from 'node:fs/promises';
import { join } from 'node:path';
import {
  command,
  templateCopy,
  profileManifest,
  query,
  sanitizedEnvironment,
  serve,
  assertNativeClosed,
  shareOwnerWorkspace,
} from '../support/template.js';
import { imageBoundary } from '../support/images.js';

const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
const semanticOnly = process.env.TEMPLATE_RUNTIME_ONLY === '1';

it('local setup is repeatable and image generation needs no payment credentials', async () => {
  const copy = await templateCopy(!semanticOnly);
  cleanups.push(copy.cleanup);
  const model = await imageBoundary();
  cleanups.push(model.close);
  const env = { ...sanitizedEnvironment(), OPENAI_API_KEY: 'controlled-not-live', OPENAI_BASE_URL: model.url };
  const setup = await command(copy.root, ['run', 'setup'], env);
  expect(setup.code).toBe(0);
  if (!semanticOnly) expect(setup.output).toContain('added');
  const manifest = await profileManifest(copy.root);
  const privateBytes = await readFile(join(copy.root, 'data/local-profiles.json'));
  const environmentBytes = await readFile(join(copy.root, '.env'));
  expect((await stat(join(copy.root, '.env'))).mode & 0o777).toBe(0o600);
  expect((await stat(join(copy.root, 'data/local-profiles.json'))).mode & 0o777).toBe(0o600);
  expect(manifest.ready).toBe(true);
  expect(new Set(Object.values(manifest.profiles).map(profile => profile!.actorId)).size).toBe(3);
  const server = await serve(copy.root, env);
  cleanups.push(server.close);
  const base = `/billing/workspaces/${manifest.profiles.owner!.workspaceId}`;
  const generated = await server.call(
    `${base}/agents/image-agent/generate`,
    { prompt: 'A blue bird' },
    'owner',
    'first-image',
  );
  expect(generated).toMatchObject({
    status: 200,
    body: { result: { text: 'Image generated.' }, billing: { executionStatus: 'completed', billedUnits: 1 } },
  });
  const generatedCli = await command(
    copy.root,
    [
      'run',
      'images',
      '--',
      'generate',
      '--key',
      'first-image',
      '--json',
      JSON.stringify({ brief: 'A blue bird' }),
      '--url',
      server.url,
    ],
    env,
  );
  expect(generatedCli.output).toContain('\"replayed\": true');
  expect(generatedCli.output).toContain('\"billedUnits\": 1');
  expect(model.models).toHaveLength(2);
  expect(model.models[0].body.model).toBe('gpt-6-luna');
  expect(model.models[0].path).toBe('/v1/responses');
  expect(JSON.stringify(model.models[0].body.input)).toContain('A blue bird');
  expect(model.models[0].body.max_output_tokens).toBe(200);
  expect(model.models[0].body).not.toHaveProperty('max_tokens');
  expect(model.models[0].body.reasoning).toMatchObject({ effort: 'none' });
  await assertNativeClosed(server);
  expect(model.models).toHaveLength(2);
  await expect
    .poll(
      async () =>
        Number(
          (
            await query(
              copy.root,
              'SELECT balance FROM commercial_meters WHERE key = ? AND account_id = (SELECT id FROM billing_accounts WHERE workspace_id = ?)',
              ['image-credits', manifest.profiles.owner!.workspaceId],
            )
          )[0].balance,
        ),
      { timeout: 45000, interval: 100 },
    )
    .toBe(29);
  const history = await query(copy.root, 'SELECT * FROM billing_ledger ORDER BY execution_id');
  const membership = await query(copy.root, 'SELECT * FROM memberships ORDER BY workspace_id, identity_id');
  expect(history.map(row => Number(row.units))).toEqual([1]);
  await server.close();
  await command(copy.root, ['run', 'setup'], env);
  expect(await readFile(join(copy.root, 'data/local-profiles.json'))).toEqual(privateBytes);
  expect(await readFile(join(copy.root, '.env'))).toEqual(environmentBytes);
  expect(await query(copy.root, 'SELECT * FROM memberships ORDER BY workspace_id, identity_id')).toEqual(membership);
  expect(await query(copy.root, 'SELECT * FROM billing_ledger ORDER BY execution_id')).toEqual(history);
  expect(
    await query(
      copy.root,
      'SELECT key, balance FROM commercial_meters WHERE key = ? AND account_id = (SELECT id FROM billing_accounts WHERE workspace_id = ?)',
      ['image-credits', manifest.profiles.owner!.workspaceId],
    ),
  ).toMatchObject([{ balance: 29 }]);
  expect(await query(copy.root, 'SELECT COUNT(*) AS count FROM billing_accounts')).toMatchObject([{ count: 3 }]);
  if (!semanticOnly) await command(copy.root, ['run', 'build'], env);
  const restarted = await serve(copy.root, env, semanticOnly ? 'dev' : 'start');
  cleanups.push(restarted.close);
  const replay = await restarted.call(
    `${base}/agents/image-agent/generate`,
    { prompt: 'A blue bird' },
    'owner',
    'first-image',
  );
  expect(replay).toMatchObject({
    status: 200,
    body: { result: { text: 'Image generated.' }, billing: { billedUnits: 1, replayed: true } },
  });
  expect(model.models).toHaveLength(2);
  await assertNativeClosed(restarted);
  const cli = await command(copy.root, ['run', 'images', '--', 'account', '--url', restarted.url], env);
  expect(cli.output).toContain('image-credits');
  for (const profile of Object.values(manifest.profiles)) expect(cli.output.includes(profile!.credential)).toBe(false);
  expect(cli.output).not.toMatch(/externalReference|providerAccount|workspace:/);
  await restarted.close();
  const path = join(copy.root, 'data/local-profiles.json');
  await rename(path, path + '.saved');
  expect((await command(copy.root, ['run', 'setup'], env, false)).code).not.toBe(0);
  await rename(path + '.saved', path);
  await writeFile(path, 'corrupt private state', { mode: 0o600 });
  expect((await command(copy.root, ['run', 'setup'], env, false)).code).not.toBe(0);
  expect(await readFile(path, 'utf8')).toBe('corrupt private state');
  await writeFile(path, privateBytes);
  expect(
    (await command(copy.root, ['run', 'setup'], { ...env, BILLING_PROVIDER: 'unsupported-provider' }, false)).code,
  ).not.toBe(0);
  expect((await command(copy.root, ['run', 'setup'], { ...env, BILLING_MODE: 'production' }, false)).code).not.toBe(0);
  await query(copy.root, 'UPDATE local_credentials SET active = 0 WHERE identity_id = ?', [
    manifest.profiles.member!.actorId,
  ]);
  expect((await command(copy.root, ['run', 'setup'], env, false)).code).not.toBe(0);
  expect(await readFile(path)).toEqual(privateBytes);
  expect(await query(copy.root, 'SELECT * FROM billing_ledger ORDER BY execution_id')).toEqual(history);
  expect(model.models).toHaveLength(2);
}, 1200000);

it('image examples demonstrate shared billing suspension and organization isolation', async () => {
  const copy = await templateCopy();
  cleanups.push(copy.cleanup);
  const boundary = await imageBoundary();
  cleanups.push(boundary.close);
  const env = { ...sanitizedEnvironment(), OPENAI_API_KEY: 'controlled', OPENAI_BASE_URL: boundary.url };
  await command(copy.root, ['run', 'setup'], env);
  await shareOwnerWorkspace(copy.root);
  let server = await serve(copy.root, env);
  cleanups.push(() => server.close());
  const manifest = await profileManifest(copy.root),
    workspaceId = manifest.profiles.owner!.workspaceId;
  const base = `/billing/workspaces/${workspaceId}`;
  for (const profile of ['owner', 'member'] as const) {
    expect(
      await server.call(`${base}/agents/image-agent/generate`, { prompt: 'A blue bird' }, profile, `${profile}-image`),
    ).toMatchObject({ status: 200, body: { billing: { workspaceId, billedUnits: 1 } } });
  }
  expect((await server.call(`${base}/agents/image-agent/generate`, { prompt: 'A blue bird' }, 'outsider')).status).toBe(
    403,
  );
  expect((await server.call(`${base}/agents/image-agent/generate`, { prompt: '' })).status).toBe(400);
  expect(boundary.images).toHaveLength(2);
  const created = await server.call(`${base}/workflows/image-kit/runs`, {}, 'owner', 'shared-kit');
  const id = created.body.executionId,
    path = `${base}/workflows/image-kit/runs/${id}`;
  const started = await server.call(
    `${path}/start`,
    { inputData: { brief: 'A blue bird story' } },
    'owner',
    'shared-start',
  );
  expect(started.body).toMatchObject({
    result: { status: 'suspended', pending: { approval: { prompts: expect.any(Array) } } },
    billing: { settlementStatus: 'reserved', billedUnits: null },
  });
  expect(
    await query(copy.root, 'SELECT units, active FROM billing_reservations WHERE execution_id = ?', [id]),
  ).toMatchObject([{ units: 3, active: 1 }]);
  expect(boundary.images).toHaveLength(2);
  expect((await server.call(path, undefined, 'member')).status).toBe(403);
  const approval = { step: 'approval', resumeData: { approved: true } };
  expect((await server.call(`${path}/resume`, approval, 'member', 'steal')).status).toBe(403);
  await server.close();
  server = await serve(copy.root, env);
  expect((await server.call(path)).body.result).toEqual(started.body.result);
  await query(copy.root, 'DELETE FROM memberships WHERE workspace_id = ? AND identity_id = ?', [
    workspaceId,
    manifest.profiles.owner!.actorId,
  ]);
  expect((await server.call(`${path}/resume`, approval, 'owner', 'fresh-approval')).status).toBe(403);
  expect(boundary.images).toHaveLength(2);
  await query(copy.root, "INSERT INTO memberships VALUES (?, ?, 'owner')", [
    workspaceId,
    manifest.profiles.owner!.actorId,
  ]);
  const completed = await server.call(`${path}/resume`, approval, 'owner', 'fresh-approval');
  expect(completed.body).toMatchObject({
    result: { status: 'completed', output: { artifacts: expect.any(Array) } },
    billing: { billedUnits: 3 },
  });
  expect(completed.body.result.output.artifacts).toHaveLength(3);
  expect((await server.call(`${path}/resume`, approval, 'owner', 'fresh-approval')).body.result).toEqual(
    completed.body.result,
  );
  expect(boundary.images).toHaveLength(5);
  await assertNativeClosed(server, id);
  expect(boundary.images).toHaveLength(5);
  expect(
    (await query(copy.root, 'SELECT units FROM billing_ledger ORDER BY units')).map(row => Number(row.units)),
  ).toEqual([1, 1, 3]);
}, 600000);
