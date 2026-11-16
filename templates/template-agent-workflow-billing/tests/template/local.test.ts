import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { temporaryDatabase } from '../support/billing.js';
import { billingSocket } from '../support/http.js';
import { afterEach, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
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

it('personal image quickstart is repeatable and shared billing remains isolated', async () => {
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
  expect(Object.values(manifest.profiles).map(profile => [profile!.name, profile!.organizationName])).toEqual([
    ['John', "John's Org"],
    ['Emma', "Emma's Org"],
    ['Alex', "Alex's Org"],
  ]);
  expect(new Set(Object.values(manifest.profiles).map(profile => profile!.workspaceId)).size).toBe(3);
  expect(new Set(Object.values(manifest.profiles).map(profile => profile!.actorId)).size).toBe(3);
  const server = await serve(copy.root, env);
  cleanups.push(server.close);
  const base = `/billing/workspaces/${manifest.profiles.owner!.workspaceId}`;
  const opening = (await server.call(`${base}/usage`)).body.meters[0].confirmedBalance;
  expect(opening).toBe(30);
  for (const profile of ['member', 'outsider'] as const) {
    expect((await server.call(`${base}/agents/image-agent/generate`, { prompt: 'A blue bird' }, profile)).status).toBe(
      403,
    );
    const own = `/billing/workspaces/${manifest.profiles[profile]!.workspaceId}/usage`;
    expect((await server.call(own, undefined, profile)).body.meters[0]).toMatchObject({
      confirmedBalance: opening,
      consumedUnits: 0,
    });
  }
  expect(await query(copy.root, 'SELECT COUNT(*) AS count FROM memberships')).toMatchObject([{ count: 3 }]);
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
  const artifact = generated.body.result.object.artifacts[0];
  expect(artifact.downloadPath).toBe(`${base}/artifacts/${artifact.id}`);
  const downloadArgs = ['run', 'images', '--', 'download', artifact.id, 'bird.png', '--url', server.url];
  expect((await command(copy.root, downloadArgs, env)).code).toBe(0);
  const downloaded = await readFile(join(copy.root, 'bird.png'));
  expect(createHash('sha256').update(downloaded).digest('hex')).toBe(artifact.sha256);
  expect((await stat(join(copy.root, 'bird.png'))).mode & 0o777).toBe(0o600);
  expect((await command(copy.root, downloadArgs, env, false)).code).not.toBe(0);
  expect(await readFile(join(copy.root, 'bird.png'))).toEqual(downloaded);
  const deniedArgs = [
    'run',
    'images',
    '--',
    'download',
    artifact.id,
    'outsider.png',
    '--url',
    server.url,
    '--profile',
    'outsider',
  ];
  const deniedDownload = await command(copy.root, deniedArgs, env, false);
  expect(deniedDownload.code).not.toBe(0);
  await expect(readFile(join(copy.root, 'outsider.png'))).rejects.toMatchObject({ code: 'ENOENT' });
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
              ['credits', manifest.profiles.owner!.workspaceId],
            )
          )[0].balance,
        ),
      { timeout: 45000, interval: 100 },
    )
    .toBe(opening - 1);
  const history = await query(copy.root, 'SELECT * FROM billing_ledger ORDER BY execution_id');
  const membership = await query(copy.root, 'SELECT * FROM memberships ORDER BY workspace_id, identity_id');
  expect(history.map(row => Number(row.units))).toEqual([1]);
  expect(history[0].account_id).toBe(
    (
      await query(copy.root, 'SELECT id FROM billing_accounts WHERE workspace_id = ?', [
        manifest.profiles.owner!.workspaceId,
      ])
    )[0].id,
  );
  for (const profile of ['member', 'outsider'] as const) {
    const own = `/billing/workspaces/${manifest.profiles[profile]!.workspaceId}/usage`;
    expect((await server.call(own, undefined, profile)).body.meters[0]).toMatchObject({
      confirmedBalance: opening,
      consumedUnits: 0,
    });
  }
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
      ['credits', manifest.profiles.owner!.workspaceId],
    ),
  ).toMatchObject([{ balance: opening - 1 }]);
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
  expect(cli.output).toContain('credits');
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
  const legacy = structuredClone(manifest);
  legacy.profiles.member!.name = 'Mary';
  legacy.profiles.member!.organizationName = "Mary's Org";
  await writeFile(path, JSON.stringify(legacy), { mode: 0o600 });
  await query(copy.root, 'UPDATE identities SET display_name = ? WHERE id = ?', [
    'Mary',
    legacy.profiles.member!.actorId,
  ]);
  const legacyBytes = await readFile(path);
  const identities = await query(copy.root, 'SELECT * FROM identities ORDER BY id');
  await command(copy.root, ['run', 'setup'], env);
  expect(await readFile(path)).toEqual(legacyBytes);
  expect(await query(copy.root, 'SELECT * FROM identities ORDER BY id')).toEqual(identities);
  expect(await query(copy.root, 'SELECT * FROM billing_ledger ORDER BY execution_id')).toEqual(history);
  await writeFile(path, privateBytes);
  await query(copy.root, 'UPDATE local_credentials SET active = 0 WHERE identity_id = ?', [
    manifest.profiles.member!.actorId,
  ]);
  expect((await command(copy.root, ['run', 'setup'], env, false)).code).not.toBe(0);
  expect(await readFile(path)).toEqual(privateBytes);
  expect(await query(copy.root, 'SELECT * FROM billing_ledger ORDER BY execution_id')).toEqual(history);
  expect(model.models).toHaveLength(2);
}, 1200000);

it('personal demo image and kit receipts match observed one and three credit changes', async () => {
  const copy = await templateCopy();
  cleanups.push(copy.cleanup);
  const boundary = await imageBoundary();
  cleanups.push(boundary.close);
  const env = { ...sanitizedEnvironment(), OPENAI_API_KEY: 'controlled-not-live', OPENAI_BASE_URL: boundary.url };
  await command(copy.root, ['run', 'setup'], env);
  let server = await serve(copy.root, env);
  cleanups.push(() => server.close());
  const owner = server.manifest.profiles.owner!;
  const base = `/billing/workspaces/${owner.workspaceId}`;
  const account = async () => {
    const response = await server.call(`${base}/usage`);
    expect(response).toMatchObject({ status: 200, body: { mode: 'local', authority: 'provider-reservations' } });
    return response.body.meters.find((meter: { key: string }) => meter.key === 'credits');
  };
  const download = async (artifact: any) => {
    const url = `${server.url}${base}/artifacts/${artifact.id}`;
    expect((await fetch(url)).status).toBe(401);
    expect(
      (await fetch(url, { headers: { authorization: `Bearer ${server.manifest.profiles.member!.credential}` } }))
        .status,
    ).toBe(403);
    const response = await fetch(url, { headers: { authorization: `Bearer ${owner.credential}` }, redirect: 'error' });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const bytes = Buffer.from(await response.arrayBuffer());
    expect(bytes).toEqual(boundary.png);
    expect(bytes.length).toBe(artifact.bytes);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(artifact.sha256);
    const file = join(copy.root, 'data/private-images', `${artifact.id}.png`);
    expect(await readFile(file)).toEqual(bytes);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  };
  const initial = await account();
  const balance = initial.confirmedBalance;
  expect(balance).toBe(30);
  expect(initial.consumedUnits).toBe(0);
  const brief = 'A small blue bird perched on a branch in a quiet forest';
  const image = await server.call(`${base}/agents/image-agent/generate`, { prompt: brief }, 'owner', 'demo-image');
  expect(image).toMatchObject({
    status: 200,
    body: { billing: { billedUnits: 1, executionStatus: 'completed', replayed: false } },
  });
  expect(image.body.result.object.artifacts).toHaveLength(1);
  await download(image.body.result.object.artifacts[0]);
  const afterImage = await account();
  expect(afterImage).toMatchObject({ confirmedBalance: balance - 1, consumedUnits: 1 });
  const imageCalls = { images: boundary.images.length, models: boundary.models.length };
  const replay = await server.call(`${base}/agents/image-agent/generate`, { prompt: brief }, 'owner', 'demo-image');
  expect(replay.body.result).toEqual(image.body.result);
  expect(replay.body.billing).toMatchObject({ billedUnits: 1, replayed: true });
  expect(boundary.images).toHaveLength(imageCalls.images);
  expect(boundary.models).toHaveLength(imageCalls.models);
  expect(await account()).toMatchObject({ confirmedBalance: balance - 1, consumedUnits: 1 });

  const created = await server.call(`${base}/workflows/image-kit/runs`, {}, 'owner', 'demo-kit');
  const id = created.body.executionId;
  const path = `${base}/workflows/image-kit/runs/${id}`;
  const started = await server.call(`${path}/start`, { inputData: { brief } }, 'owner', 'demo-kit-start');
  expect(started).toMatchObject({
    status: 200,
    body: { result: { status: 'suspended' }, billing: { billedUnits: null, settlementStatus: 'reserved' } },
  });
  const prompts = started.body.result.pending.approval.prompts;
  expect(prompts).toHaveLength(3);
  for (const [index, style] of ['Notion-inspired style:', '3D style:', 'Vector illustration style:'].entries()) {
    expect(prompts[index]).toContain(brief);
    expect(prompts[index]).toContain(style);
  }
  const whileHeld = await account();
  expect(whileHeld).toMatchObject({ confirmedBalance: balance - 4, consumedUnits: 1 });
  expect(
    await query(copy.root, 'SELECT units, active FROM billing_reservations WHERE execution_id = ?', [id]),
  ).toMatchObject([{ units: 3, active: 1 }]);
  expect(boundary.images).toHaveLength(imageCalls.images);
  expect(boundary.models).toHaveLength(imageCalls.models);
  await server.close();
  server = await serve(copy.root, env);
  expect((await server.call(path)).body.result).toEqual(started.body.result);
  expect(await account()).toMatchObject({ confirmedBalance: balance - 4, consumedUnits: 1 });
  const approval = { step: 'approval', resumeData: { approved: true } };
  const completed = await server.call(`${path}/resume`, approval, 'owner', 'demo-approve');
  expect(completed).toMatchObject({
    status: 200,
    body: {
      result: { status: 'completed' },
      billing: { billedUnits: 3, executionStatus: 'completed' },
    },
  });
  expect(completed.body.result.output.prompts).toEqual(prompts);
  const artifacts = completed.body.result.output.artifacts;
  expect(artifacts).toHaveLength(3);
  for (const artifact of artifacts) await download(artifact);
  expect(boundary.images.slice(1).map(request => request.prompt)).toEqual(prompts);
  expect(boundary.images).toHaveLength(4);
  expect(boundary.models).toHaveLength(8);
  const afterKit = await account();
  expect(afterKit).toMatchObject({ confirmedBalance: balance - 4, consumedUnits: 4 });
  const completedCalls = { images: boundary.images.length, models: boundary.models.length };
  const ledger = await query(copy.root, 'SELECT execution_id, meter, units FROM billing_ledger ORDER BY units');
  expect(ledger.map(row => Number(row.units))).toEqual([1, 3]);
  expect(ledger[1]).toMatchObject({ execution_id: id, meter: 'credits', units: 3 });
  expect(
    await query(copy.root, 'SELECT units, active FROM billing_reservations WHERE execution_id = ?', [id]),
  ).toMatchObject([{ units: 3, active: 0 }]);
  const finalReplay = await server.call(`${path}/resume`, approval, 'owner', 'demo-approve');
  expect(finalReplay.body.result).toEqual(completed.body.result);
  expect(finalReplay.body.billing).toMatchObject({ billedUnits: 3, replayed: true });
  expect(boundary.images).toHaveLength(4);
  expect(boundary.models).toHaveLength(8);
  expect(await query(copy.root, 'SELECT execution_id, meter, units FROM billing_ledger ORDER BY units')).toEqual(
    ledger,
  );
  expect(await account()).toMatchObject({ confirmedBalance: balance - 4, consumedUnits: 4 });
  process.stdout.write(
    JSON.stringify({
      evidence: 'personal-demo-controlled',
      opening: balance,
      image: afterImage.confirmedBalance,
      held: whileHeld.confirmedBalance,
      heldUnits: 3,
      consumedWhileHeld: whileHeld.consumedUnits,
      final: afterKit.confirmedBalance,
      consumed: afterKit.consumedUnits,
      ledgerUnits: ledger.map(row => Number(row.units)),
      initialApprovalReceiptReplayed: completed.body.billing.replayed,
      approvalReplayReceiptReplayed: finalReplay.body.billing.replayed,
      imageRequests: boundary.images.length,
      modelRequests: boundary.models.length,
      approvalReplayAdditionalImageRequests: boundary.images.length - completedCalls.images,
      approvalReplayAdditionalModelRequests: boundary.models.length - completedCalls.models,
    }) + '\n',
  );
}, 600000);

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

it('negative commands must exit normally instead of passing after a timeout or signal', async () => {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  await writeFile(
    join(database.directory, 'package.json'),
    JSON.stringify({
      scripts: {
        hang: 'node -e "setInterval(() => {}, 1000)"',
        reject: 'node -e "process.exit(2)"',
      },
    }),
  );
  await expect(command(database.directory, ['run', 'hang'], sanitizedEnvironment(), false, 100)).rejects.toThrow(
    'timed out',
  );
  // npm may translate a script signal into an exit code; terminate the npm process itself.
  await writeFile(join(database.directory, 'kill-npm.cjs'), "process.kill(process.ppid, 'SIGKILL');");
  await writeFile(
    join(database.directory, 'package.json'),
    JSON.stringify({ scripts: { signal: 'node kill-npm.cjs', reject: 'node -e "process.exit(2)"' } }),
  );
  await expect(command(database.directory, ['run', 'signal'], sanitizedEnvironment(), false)).rejects.toThrow(
    'terminated by SIGKILL',
  );
  expect((await command(database.directory, ['run', 'reject'], sanitizedEnvironment(), false)).code).toBe(2);
});

it('the image CLI exposes its generated key before a lost response and replays with clean JSON stdout', async () => {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const profile = join(database.directory, 'profile.json');
  await writeFile(profile, JSON.stringify({ workspaceId: 'team', credential: 'controlled' }));
  let stderr = '';
  let savedKey = '';
  let exposedBeforeDispatch = false;
  let requests = 0;
  const server = await billingSocket({
    fetch: async request => {
      const key = request.headers.get('idempotency-key')!;
      if (!requests++) {
        exposedBeforeDispatch = stderr.includes(`Idempotency key: ${key}`);
        savedKey = key;
        throw new Error('Response lost after saving');
      }
      expect(key).toBe(savedKey);
      return Response.json({ result: { text: 'Recovered result' }, replayed: true });
    },
  });
  cleanups.push(server.close);
  const invoke = async (key?: string) => {
    const child = spawn(
      process.execPath,
      [
        fileURLToPath(new URL('../../scripts/images.mjs', import.meta.url)),
        'generate',
        '--profile-file',
        profile,
        '--url',
        server.url,
        '--json',
        JSON.stringify({ brief: 'A blue bird in a quiet forest' }),
        ...(key ? ['--key', key] : []),
      ],
      { env: sanitizedEnvironment(), stdio: ['ignore', 'pipe', 'pipe'] },
    );
    let stdout = '';
    child.stdout.on('data', chunk => {
      stdout += chunk;
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
    });
    const [code] = await once(child, 'close');
    return { code, stdout };
  };
  expect(await invoke()).toEqual({ code: 1, stdout: '' });
  expect(exposedBeforeDispatch).toBe(true);
  expect(savedKey).toMatch(/^[0-9a-f-]{36}$/);
  const replay = await invoke(savedKey);
  expect(replay.code).toBe(0);
  expect(JSON.parse(replay.stdout)).toEqual({ result: { text: 'Recovered result' }, replayed: true });
});
