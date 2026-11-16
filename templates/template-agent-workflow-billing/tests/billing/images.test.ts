import { removeConversationMigration } from '../support/billing.js';
import { configurationFile } from '../support/configuration-files.js';
import { AutumnBillingProvider } from '../../src/billing/providers/autumn/index.js';
import { afterEach, expect, it, vi } from 'vitest';
import filesystem from 'node:fs/promises';
import { Server } from 'node:http';
import { tmpdir } from 'node:os';
import { syncBuiltinESMExports } from 'node:module';
import { ExecutionArtifacts } from '../../src/billing/storage/artifacts.js';
import { readFile, writeFile, unlink, symlink, link, stat, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { LocalBillingProvider } from '../../src/billing/providers/local/index.js';
import { imageConfiguration } from '../support/image-configuration.js';
import { weatherConfiguration } from '../support/weather/configuration.js';
import { usage, temporaryDatabase, independentClient } from '../support/billing.js';
import { LocalBillingStorage } from '../../src/billing/providers/local/storage.js';
import { imageFixture, imageBoundary, pngFixture } from '../support/images.js';
import { autumnFixture } from '../support/autumn.js';
import { createBillingApplication } from '../../src/billing/application.js';
import { imageBillingCatalog } from '../support/image-application.js';
import type { Artifact } from '../../src/images/schemas.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture(options?: Parameters<typeof imageFixture>[0]) {
  const f = await imageFixture(options);
  cleanups.push(f.close);
  return f;
}
const artifacts = (response: any): Artifact[] => response.body.result.object.artifacts;

it.each([
  { stage: 'local setup', environment: { BILLING_MODE: 'production' }, code: 'invalid_configuration' },
  { stage: 'application creation', environment: { BILLING_PORT: '0' }, code: 'invalid_input' },
])('failed $stage releases the image boundary and temporary state', async ({ environment, code }) => {
  const directory = await filesystem.mkdtemp(join(tmpdir(), 'image-fixture-cleanup-'));
  vi.stubEnv('TMPDIR', directory);
  // Observe real listening sockets without replacing their implementation.
  const listening = vi.spyOn(Server.prototype, 'listen');
  const servers = listening.mock.contexts as Server[];
  try {
    await expect(imageFixture({ environment })).rejects.toMatchObject({ code });
    expect(servers.length).toBeGreaterThan(0);
    expect(servers.every(server => !server.listening)).toBe(true);
    expect(await readdir(directory)).toEqual([]);
  } finally {
    listening.mockRestore();
    vi.unstubAllEnvs();
    // A failing regression must also release any leaked servers before Vitest exits.
    for (const server of servers) {
      const closed = new Promise<void>(resolve => server.close(() => resolve()));
      server.closeAllConnections();
      await closed;
    }
    await filesystem.rm(directory, { recursive: true, force: true });
  }
});

it('image agent persists one artifact and charges one credit exactly once', async () => {
  const f = await fixture();
  f.boundary.mode('duplicate');
  const [first, concurrent] = await Promise.all([f.generate(), f.generate()]);
  const completed = [first, concurrent].find(value => value.body.billing.executionStatus === 'completed')!;
  expect(completed).toMatchObject({
    status: 200,
    body: { result: { text: 'Image generated.' }, billing: { billedUnits: 1, settlementStatus: 'settled' } },
  });
  expect(f.boundary.images).toHaveLength(1);
  expect(f.boundary.images[0]).toMatchObject({
    model: 'gpt-image-2.5-flare',
    n: 1,
    size: '1024x1024',
    quality: 'low',
    output_format: 'png',
    prompt: 'A blue bird in a quiet forest',
  });
  const [artifact] = artifacts(completed);
  const slot = (
    await f.database.execute({
      sql: 'SELECT identity FROM image_slots WHERE execution_id = ?',
      args: [artifact.executionId],
    })
  ).rows[0];
  expect(JSON.parse(String(slot.identity))).toMatchObject({
    prompt: 'A blue bird in a quiet forest',
    profile: { model: 'gpt-image-2.5-flare', n: 1 },
    slot: 0,
    budget: 1,
  });
  expect(artifact).toMatchObject({
    executionId: completed.body.billing.executionId,
    creatorId: f.owner.actorId,
    workspaceId: f.owner.workspaceId,
    bytes: f.boundary.png.length,
  });
  expect((await stat(join(f.root, 'data/private-images', `${artifact.id}.png`))).mode & 0o777).toBe(0o600);
  expect(await readFile(join(f.root, 'data/private-images', `${artifact.id}.png`))).toEqual(f.boundary.png);
  await f.restart();
  const replay = await f.generate();
  expect(replay.body.result).toEqual(completed.body.result);
  expect(replay.body.billing).toMatchObject({ replayed: true, billedUnits: 1 });
  expect(f.boundary.images).toHaveLength(1);
  expect((await f.database.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 1n }]);
  f.boundary.mode('fake');
  const fake = await f.generate('fake-prose');
  expect(fake.body.billing).toMatchObject({ executionStatus: 'failed', billedUnits: 0, settlementStatus: 'released' });
  expect(fake.body.result).toBeNull();
  expect(f.boundary.images).toHaveLength(1);
});

it('image kit reserves three credits and confirms once after approved full success', async () => {
  const f = await fixture();
  const brief = 'A blue bird perched on a branch in a quiet forest';
  const { id, response } = await f.start('kit-once', brief);
  expect(response.body).toMatchObject({
    result: { status: 'suspended', pending: { approval: { prompts: expect.any(Array) } } },
    billing: { settlementStatus: 'reserved' },
  });
  const approvedPrompts: string[] = response.body.result.pending.approval.prompts;
  expect(approvedPrompts).toHaveLength(3);
  expect(new Set(approvedPrompts).size).toBe(3);
  for (const prompt of approvedPrompts) {
    expect(prompt).toContain(`<subject>${brief}</subject>`);
    expect(prompt.length).toBeLessThanOrEqual(2000);
  }
  expect(approvedPrompts[0]).toMatch(/Notion-inspired.*minimal black-and-white hand-drawn line art.*light background/);
  expect(approvedPrompts[1]).toMatch(/3D.*volume.*soft lighting/);
  expect(approvedPrompts[2]).toMatch(/Vector illustration.*flat shapes.*crisp edges/);
  expect(f.boundary.images).toHaveLength(0);
  expect(f.boundary.models).toHaveLength(0);
  expect((await f.database.execute('SELECT units FROM billing_reservations WHERE active = 1')).rows).toEqual([
    { units: 3n },
  ]);
  await f.restart();
  const status = await f.call(`${f.base}/workflows/image-kit/runs/${id}`);
  expect(status.body.result).toEqual(response.body.result);
  const completed = await f.resume(id);
  expect(completed.body).toMatchObject({
    result: { status: 'completed', output: { artifacts: expect.any(Array) } },
    billing: { billedUnits: 3, settlementStatus: 'settled' },
  });
  expect(completed.body.result.output.artifacts).toHaveLength(3);
  expect(f.boundary.images).toEqual(
    approvedPrompts.map(prompt => ({
      model: 'gpt-image-2.5-flare',
      n: 1,
      size: '1024x1024',
      quality: 'low',
      output_format: 'png',
      prompt,
    })),
  );
  const slots = (
    await f.database.execute({
      sql: 'SELECT slot, identity, state, artifact_id FROM image_slots WHERE execution_id = ? ORDER BY slot',
      args: [id],
    })
  ).rows;
  expect(slots.map(row => ({ slot: row.slot, identity: JSON.parse(String(row.identity)), state: row.state }))).toEqual(
    approvedPrompts.map((prompt, slot) => ({
      slot: BigInt(slot),
      identity: {
        prompt,
        profile: { model: 'gpt-image-2.5-flare', n: 1, size: '1024x1024', quality: 'low', output_format: 'png' },
        slot,
        budget: 3,
      },
      state: 'completed',
    })),
  );
  expect(completed.body.result.output.artifacts.map((artifact: Artifact) => artifact.id)).toEqual(
    slots.map(row => row.artifact_id),
  );
  expect(completed.body.result.output.artifacts.map((artifact: Artifact) => artifact.filename)).toEqual([
    'image-1.png',
    'image-2.png',
    'image-3.png',
  ]);
  expect((await f.database.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
  expect((await f.database.execute('SELECT COUNT(*) AS count FROM billing_executions')).rows[0].count).toBe(1n);
  const replay = await f.resume(id);
  expect(replay.body.result).toEqual(completed.body.result);
  expect(f.boundary.images).toHaveLength(3);
  for (const artifact of completed.body.result.output.artifacts) {
    const read = await fetch(`${f.url()}${f.base}/artifacts/${artifact.id}`, {
      headers: { authorization: `Bearer ${f.owner.credential}` },
    });
    expect(read.status).toBe(200);
    expect(Buffer.from(await read.arrayBuffer())).toEqual(f.boundary.png);
  }
});

it('a brief asking for several styles still sends one single-panel illustration per image request', async () => {
  const f = await fixture();
  // A live Studio brief describing the whole kit made each image a collage.
  const brief =
    'Create a three-style kit of a blue bird in a quiet forest with watercolor, gouache and vector variants.';
  const { id, response } = await f.start('single-panel-kit', brief);
  const prompts = response.body.result.pending.approval.prompts;
  const completed = await f.resume(id);
  expect(completed.body.billing).toMatchObject({ billedUnits: 3, settlementStatus: 'settled' });
  expect(f.boundary.images).toHaveLength(3);
  for (const [index, image] of f.boundary.images.entries()) {
    expect(image.n).toBe(1);
    expect(image.prompt).toBe(prompts[index]);
    expect(image.prompt).toContain(brief);
    expect(image.prompt).toMatch(/^ONE illustration\./);
    expect(image.prompt).toContain('No text/collage/panels');
    expect(image.prompt).toContain('Ignore styles/variants in <subject>');
    expect(image.prompt).toContain(`<subject>${brief}</subject>`);
  }
});

it('image kit preserves a maximum-length subject in all three approval prompts', async () => {
  const f = await fixture();
  const brief = `${'A blue bird perched on a branch in a quiet forest. '.repeat(40).slice(0, 1799)}.`;
  expect(brief).toHaveLength(1800);
  const { id, response } = await f.start('long-kit', brief);
  expect(response.body.result.status).toBe('suspended');
  const prompts: string[] = response.body.result.pending.approval.prompts;
  expect(prompts).toHaveLength(3);
  for (const prompt of prompts) {
    expect(prompt).toContain(`<subject>${brief}</subject>`);
    expect(prompt.length).toBeLessThanOrEqual(2000);
  }
  expect(prompts[0]).toContain('Notion-inspired style');
  expect(prompts[1]).toContain('3D style');
  expect(prompts[2]).toContain('Vector illustration style');
  expect(f.boundary.images).toHaveLength(0);
  expect(f.boundary.models).toHaveLength(0);
  const canceled = await f.call(`${f.base}/workflows/image-kit/runs/${id}/cancel`, {}, 'long-kit-cancel');
  expect(canceled.body.billing).toMatchObject({ billedUnits: 0, settlementStatus: 'released' });
});

it('image kit cancellation partial failure expiry and restart preserve one billing outcome', async () => {
  const f = await fixture({ ttl: 1000 });
  for (const action of ['cancel', 'reject'] as const) {
    const { id } = await f.start(action);
    if (action === 'reject') {
      expect((await f.resume(id, false, 'reject-once')).status).toBe(400);
      expect((await f.call(`${f.base}/workflows/image-kit/runs/${id}`)).body.result.status).toBe('suspended');
    }
    const response = await f.call(`${f.base}/workflows/image-kit/runs/${id}/cancel`, {}, `${action}-cancel`);
    expect(response.body.billing).toMatchObject({ billedUnits: 0, settlementStatus: 'released' });
    expect(f.boundary.images).toHaveLength(0);
  }
  const expired = await f.start('expired');
  await setTimeout(1100);
  await f.application().runtime.billing.expireSuspensions();
  expect((await f.resume(expired.id)).status).toBe(409);
  const expiry = await f.call(`${f.base}/workflows/image-kit/runs/${expired.id}`);
  expect(expiry.body.billing).toMatchObject({ billedUnits: 0, settlementStatus: 'released' });
  expect(f.boundary.images).toHaveLength(0);
  f.boundary.mode('partial');
  const partial = await f.start('partial');
  const failed = await f.resume(partial.id);
  expect(failed.body.billing).toMatchObject({ billedUnits: 0, settlementStatus: 'released' });
  expect(f.boundary.images).toHaveLength(2);
  expect(
    (
      await f.database.execute({
        sql: 'SELECT state FROM image_slots WHERE execution_id = ? ORDER BY slot',
        args: [partial.id],
      })
    ).rows,
  ).toEqual([{ state: 'completed' }, { state: 'uncertain' }]);
  await f.restart();
  await f.resume(partial.id);
  expect(f.boundary.images).toHaveLength(2);
  for (const mode of ['lost', 'malformed', 'oversized', 'refusal'] as const) {
    f.boundary.mode(mode);
    const response = await f.generate(mode);
    expect(response.body.billing).toMatchObject({ billedUnits: 0, settlementStatus: 'released' });
    const count = f.boundary.images.length;
    await f.restart();
    await f.generate(mode);
    expect(f.boundary.images).toHaveLength(count);
  }
  const rows = (await f.database.execute('SELECT units FROM billing_ledger')).rows;
  expect(rows.length).toBe(8);
  expect(rows.every(row => row.units === 0n)).toBe(true);
});

it('private artifacts enforce ownership integrity and replay without regeneration', async () => {
  const f = await fixture();
  const completed = await f.generate();
  const [artifact] = artifacts(completed);
  const path = `${f.base}/artifacts/${artifact.id}`;
  const read = (credential?: string, target = path) =>
    fetch(`${f.url()}${target}`, { headers: credential ? { authorization: `Bearer ${credential}` } : {} });
  expect((await read()).status).toBe(401);
  expect((await read(f.outsider.credential)).status).toBe(403);
  const owner = await f.application().organizations.context({ credential: f.owner.credential });
  await f.application().organizations.convert(owner, 'share');
  const invitation = await f.application().organizations.invite(owner, 'invite', {
    recipientId: f.member.actorId,
    role: 'member',
    expiresAt: new Date(Date.now() + 60000).toISOString(),
  });
  await f
    .application()
    .organizations.acceptInvitation({ credential: f.member.credential, key: 'accept', token: invitation.token! });
  expect((await read(f.member.credential)).status).toBe(403);
  const authorized = await read(f.owner.credential);
  expect(authorized.status).toBe(200);
  expect(authorized.headers.get('cache-control')).toBe('private, no-store');
  expect(authorized.headers.get('content-disposition')).toBe('attachment; filename="image-1.png"');
  expect(Buffer.from(await authorized.arrayBuffer())).toEqual(f.boundary.png);
  expect((await read(f.owner.credential, `${f.base}/artifacts/%2e%2e%2fsecret`)).status).toBe(400);
  const filename = join(f.root, 'data/private-images', `${artifact.id}.png`);
  for (const damage of ['corrupt', 'missing', 'symlink', 'hardlink'] as const) {
    await unlink(filename).catch(() => {});
    if (damage === 'corrupt') await writeFile(filename, Buffer.alloc(f.boundary.png.length), { mode: 0o600 });
    if (damage === 'symlink') await symlink(join(f.root, 'data/local-profiles.json'), filename);
    if (damage === 'hardlink') {
      const other = join(f.root, 'private-copy.png');
      await writeFile(other, f.boundary.png, { mode: 0o600 });
      await link(other, filename);
    }
    expect((await read(f.owner.credential)).status).toBe(410);
    const replay = await f.generate();
    expect(replay.body.result).toEqual(completed.body.result);
    expect(replay.body.billing.billedUnits).toBe(1);
  }
  await f.database.execute({
    sql: 'DELETE FROM memberships WHERE workspace_id = ? AND identity_id = ?',
    args: [f.owner.workspaceId, f.owner.actorId],
  });
  expect((await read(f.owner.credential)).status).toBe(403);
  expect(f.boundary.images).toHaveLength(1);
  expect((await f.database.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 1n }]);
});

it('recognized v1 image migration preserves financial workflow and request identities and rejects tampering', async () => {
  const f = await fixture();
  const { id } = await f.start('pre-migration-kit');
  await f.stop();
  const tables = [
    'identities',
    'local_credentials',
    'memberships',
    'billing_operations',
    'billing_remote_operations',
    'billing_workflow_runs',
    'billing_workflow_operations',
    'billing_admitted_accounts',
    'billing_reservations',
  ];
  const snapshot = () =>
    Promise.all(tables.map(async table => (await f.database.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows));
  const before = await snapshot();
  // Removing only the empty additive tables reconstructs the exact recognized v1 catalog.
  await removeConversationMigration(f.database);
  for (const table of ['local_credit_migrations', 'image_artifacts', 'image_slots', 'local_image_credit_migrations'])
    await f.database.execute(`DROP TABLE ${table}`);
  await f.database.execute('DELETE FROM billing_migrations WHERE version >= 2');
  await f.database.execute('PRAGMA user_version = 1');
  await f.database.execute('CREATE TABLE unexpected_data (value TEXT) STRICT');
  await f.database.execute("INSERT INTO unexpected_data VALUES ('retain me')");
  await expect(LocalBillingStorage.open({ url: f.manifest.databaseUrl })).rejects.toMatchObject({
    code: 'storage_incompatible',
  });
  expect((await f.database.execute('PRAGMA user_version')).rows[0].user_version).toBe(1n);
  expect((await f.database.execute('SELECT * FROM unexpected_data')).rows).toEqual([{ value: 'retain me' }]);
  expect(await snapshot()).toEqual(before);
  await f.database.execute('DROP TABLE unexpected_data');
  await f.restart();
  expect((await f.database.execute('PRAGMA user_version')).rows[0].user_version).toBe(6n);
  expect(await snapshot()).toEqual(before);
  expect((await f.call(`${f.base}/workflows/image-kit/runs`, {}, 'pre-migration-kit')).body.executionId).toBe(id);
  expect(f.boundary.images).toHaveLength(0);
  const completed = await f.resume(id);
  expect(completed.body.billing).toMatchObject({ billedUnits: 3, settlementStatus: 'settled' });
  expect(f.boundary.images).toHaveLength(3);
});

it('image dispatch stops at the persisted cutoff and concurrent cancellation never starts a later slot', async () => {
  const f = await fixture({ executionMs: 250 });
  f.boundary.mode('stall');
  const { id } = await f.start('cancel-during-image');
  const pending = f.resume(id);
  await f.boundary.started();
  const cancel = await f.call(`${f.base}/workflows/image-kit/runs/${id}/cancel`, {}, 'concurrent-cancel');
  expect([200, 409]).toContain(cancel.status);
  await pending;
  f.boundary.release();
  await setTimeout(100);
  expect(f.boundary.images).toHaveLength(1);
  const remote = (
    await f.database.execute({
      sql: 'SELECT segment_deadline, terminal_request FROM billing_remote_operations WHERE execution_id = ?',
      args: [id],
    })
  ).rows[0];
  await setTimeout(Math.max(0, Number(remote.segment_deadline) - Date.now()) + 20);
  expect(Number(remote.segment_deadline)).toBeLessThanOrEqual(Date.now());
  const calls = f.boundary.images.length;
  await f.restart();
  await f.resume(id, true, 'after-cutoff');
  const final = await f.call(`${f.base}/workflows/image-kit/runs/${id}`);
  expect(['canceled', 'uncertain']).toContain(final.body.result.status);
  if (final.body.billing.billedUnits === null)
    expect(['pending', 'uncertain']).toContain(final.body.billing.settlementStatus);
  else expect(final.body.billing).toMatchObject({ billedUnits: 0, settlementStatus: 'released' });
  const recovered = (
    await f.database.execute({
      sql: 'SELECT terminal_request FROM billing_remote_operations WHERE execution_id = ?',
      args: [id],
    })
  ).rows[0];
  expect(JSON.parse(String(recovered.terminal_request))).toMatchObject({ action: 'release', units: 0 });
  expect(f.boundary.images).toHaveLength(calls);
  expect(
    (
      await f.database.execute({ sql: 'SELECT units FROM billing_ledger WHERE execution_id = ?', args: [id] })
    ).rows.every(row => row.units === 0n),
  ).toBe(true);
  expect((await f.database.execute('SELECT COUNT(*) AS count FROM image_artifacts')).rows[0].count).toBe(0n);
});

it('model text alone cannot certify image completion or charge a credit', async () => {
  const f = await fixture();
  f.boundary.mode('fake');
  const response = await f.generate('fabricated-image');
  expect(response.body.billing).toMatchObject({
    executionStatus: 'failed',
    billedUnits: 0,
    settlementStatus: 'released',
  });
  expect(response.body.result).toBeNull();
  expect(f.boundary.images).toHaveLength(0);
  expect((await f.database.execute('SELECT COUNT(*) AS count FROM image_artifacts')).rows[0].count).toBe(0n);
});

it('a lost financial confirmation reconciles the saved artifact after restart without another debit or image', async () => {
  const autumn = await autumnFixture();
  cleanups.push(autumn.close);
  const boundary = await imageBoundary();
  cleanups.push(boundary.close);
  const environment = {
    BILLING_PROVIDER: 'autumn',
    BILLING_MODE: 'production',
    BILLING_IDENTITY_CONFIG_FILE: configurationFile(autumn.database.directory, autumn.jwtConfiguration),
    BILLING_DATABASE_URL: autumn.database.url,
    BILLING_PROJECT_ROOT: autumn.database.directory,
    OPENAI_API_KEY: 'controlled',
    OPENAI_BASE_URL: boundary.url,
  };
  const catalog = imageBillingCatalog(environment);
  const options = {
    catalog,
    driverOptions: {
      ...autumn.options,
      bindings: {
        ...autumn.options.bindings,
        meters: autumn.options.bindings.meters.map(meter => ({ ...meter, key: 'credits' })),
      },
    },
  };
  let app = await createBillingApplication({
    environment,
    ...options,
    billingProvider: await AutumnBillingProvider.open({ url: autumn.database.url }, options.driverOptions),
  });
  cleanups.push(() => app.close());
  const context = () => app.organizations.context({ credential: autumn.owner.credential });
  autumn.behavior.dropFinalize = true;
  autumn.behavior.visibleLogs = false;
  const response = await app.runtime.billing
    .agent('image-agent')
    .generate('A blue bird', { billing: await context(), idempotencyKey: 'lost-image-confirm' });
  if (response.kind === 'nested') throw new Error('Unexpected nested response');
  expect(response.billing).toMatchObject({
    executionStatus: 'completed',
    billedUnits: null,
    settlementStatus: 'pending',
  });
  const projection = response.kind === 'immediate' ? response.projection : response.result;
  expect(projection?.object?.artifacts).toHaveLength(1);
  const artifact = projection!.object!.artifacts[0];
  expect(autumn.behavior.balance).toBe(9);
  expect(boundary.images).toHaveLength(1);
  await app.close();
  app = await createBillingApplication({
    environment,
    ...options,
    billingProvider: await AutumnBillingProvider.open({ url: autumn.database.url }, options.driverOptions),
  });
  const replay = await app.runtime.billing
    .agent('image-agent')
    .generate('A blue bird', { billing: await context(), idempotencyKey: 'lost-image-confirm' });
  if (replay.kind !== 'replay') throw new Error('Expected saved replay');
  expect(replay.result).toEqual(projection);
  expect(replay.billing.settlementStatus).toBe('pending');
  autumn.behavior.visibleLogs = true;
  await app.runtime.recovery.runOnce();
  const settled = await app.runtime.billing
    .agent('image-agent')
    .generate('A blue bird', { billing: await context(), idempotencyKey: 'lost-image-confirm' });
  if (settled.kind !== 'replay') throw new Error('Expected saved replay');
  expect(settled.billing).toMatchObject({ billedUnits: 1, settlementStatus: 'settled' });
  expect(settled.result).toEqual(projection);
  const bytes = await app.artifacts!.read(await app.organizations.accountingIdentity(await context()), artifact.id);
  expect(bytes?.bytes).toEqual(boundary.png);
  expect(autumn.behavior.balance).toBe(9);
  expect(autumn.requests.filter(request => request.path === '/v1/balances.finalize')).toHaveLength(1);
  expect(boundary.images).toHaveLength(1);
});

it('local legacy credit transition preserves spent balances once and never seeds damaged or unresolved accounts', async () => {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  let storage = await LocalBillingStorage.open({ url: database.url });
  const provider = new LocalBillingProvider(storage, weatherConfiguration(['spent', 'unresolved', 'autumn-customer']));
  const spent = await provider.ensureAccount({ workspaceId: 'spent' });
  const unresolved = await provider.ensureAccount({ workspaceId: 'unresolved' });
  const remote = await provider.ensureAccount({ workspaceId: 'autumn-customer' });
  await provider.reportUsage(usage(spent, { id: 'legacy-spend', meter: 'weather-credits', units: 6 }));
  const now = Date.now();
  expect(
    await provider.reservations.reserve(
      provider.reservations.prepareReservation({
        id: 'expired-unresolved',
        account: unresolved,
        meter: 'weather-credits',
        units: 2,
        executionCutoff: now + 100,
        confirmationCutoff: now + 150,
        expiresAt: now + 200,
      }),
    ),
  ).toMatchObject({ status: 'reserved' });
  await setTimeout(220);
  storage.close();
  const observer = await independentClient(database.url);
  cleanups.push(async () => observer.close());
  await observer.execute({ sql: "UPDATE billing_accounts SET provider = 'autumn' WHERE id = ?", args: [remote.id] });
  await removeConversationMigration(observer);
  for (const table of ['local_credit_migrations', 'image_artifacts', 'image_slots', 'local_image_credit_migrations'])
    await observer.execute(`DROP TABLE ${table}`);
  await observer.execute('DELETE FROM billing_migrations WHERE version >= 2');
  await observer.execute('PRAGMA user_version = 1');
  const history = (await observer.execute('SELECT * FROM immutable_usage')).rows;
  storage = await LocalBillingStorage.open({ url: database.url });
  const current = new LocalBillingProvider(storage, imageConfiguration(['spent', 'unresolved']));
  expect(await current.ensureAccount({ workspaceId: 'spent' })).toEqual(spent);
  expect(
    (
      await observer.execute({
        sql: 'SELECT key, balance, consumed FROM commercial_meters WHERE account_id = ? AND key IN (?, ?) ORDER BY key',
        args: [spent.id, 'credits', 'weather-credits'],
      })
    ).rows,
  ).toEqual([
    { key: 'credits', balance: 24n, consumed: 6n },
    { key: 'weather-credits', balance: 24n, consumed: 6n },
  ]);
  expect((await observer.execute('SELECT * FROM immutable_usage')).rows).toEqual(history);
  expect(
    (await current.getState(spent)).meters
      .filter(meter => meter.key === 'credits' || meter.key.endsWith('-credits'))
      .map(meter => meter.key),
  ).toEqual(['credits']);
  const fresh = Date.now();
  expect(
    await current.reservations.reserve(
      current.reservations.prepareReservation({
        id: 'retired-source',
        account: spent,
        meter: 'weather-credits',
        units: 1,
        executionCutoff: fresh + 1000,
        confirmationCutoff: fresh + 2000,
        expiresAt: fresh + 3000,
      }),
    ),
  ).toMatchObject({ status: 'denied' });
  await expect(
    current.reportUsage(usage(spent, { id: 'retired-new-spend', meter: 'weather-credits', units: 1 })),
  ).rejects.toMatchObject({ code: 'conflict' });
  expect(
    await current.reportUsage(usage(spent, { id: 'legacy-spend', meter: 'weather-credits', units: 6 })),
  ).toMatchObject({ status: 'duplicate' });
  expect(
    (await observer.execute('SELECT account_id, balance, consumed FROM local_image_credit_migrations')).rows,
  ).toEqual([{ account_id: spent.id, balance: 24n, consumed: 6n }]);
  expect((await current.getState(unresolved)).meters.some(meter => meter.key === 'credits')).toBe(false);
  expect(
    (
      await observer.execute({
        sql: "SELECT key FROM commercial_meters WHERE account_id = ? AND key = 'credits'",
        args: [remote.id],
      })
    ).rows,
  ).toEqual([]);
  await expect(observer.execute('DELETE FROM local_image_credit_migrations')).rejects.toBeDefined();
  await observer.execute({
    sql: "DELETE FROM commercial_meters WHERE account_id = ? AND key = 'credits'",
    args: [spent.id],
  });
  storage.close();
  storage = await LocalBillingStorage.open({ url: database.url });
  const reopened = new LocalBillingProvider(storage, imageConfiguration(['spent', 'unresolved']));
  await reopened.ensureAccount({ workspaceId: 'spent' });
  expect((await reopened.getState(spent)).meters.some(meter => meter.key === 'credits')).toBe(false);
  expect((await observer.execute('SELECT account_id FROM local_image_credit_migrations')).rows).toEqual([
    { account_id: spent.id },
  ]);
  // The v1 account was skipped while its provider hold was active. Once released,
  // a later account lookup must retry both transitions without granting credits.
  const held = (
    await observer.execute("SELECT payload FROM local_provider_reservations WHERE id = 'expired-unresolved'")
  ).rows[0];
  const release = reopened.reservations.prepareFinalization(
    { reservation: JSON.parse(String(held.payload)), action: 'release', units: 0 },
    String(held.payload),
  );
  expect(await reopened.reservations.finalize(release)).toMatchObject({ status: 'released' });
  await reopened.ensureAccount({ workspaceId: 'unresolved' });
  expect((await reopened.getState(unresolved)).meters.find(meter => meter.key === 'credits')).toMatchObject({
    key: 'credits',
    confirmedBalance: 30,
    consumedUnits: 0,
  });
  await reopened.ensureAccount({ workspaceId: 'unresolved' });
  expect(
    (
      await observer.execute({
        sql: 'SELECT balance, consumed FROM local_image_credit_migrations WHERE account_id = ?',
        args: [unresolved.id],
      })
    ).rows,
  ).toEqual([{ balance: 30n, consumed: 0n }]);
  storage.close();
});

it.each(['1024x1024', '1536x1024', '1024x1536'])(
  'operator image settings reach the provider and replay preserves the saved artifact (%s)',
  async size => {
    const f = await fixture({
      environment: {
        OPENAI_IMAGE_MODEL: 'operator-image-model',
        OPENAI_IMAGE_QUALITY: 'medium',
        OPENAI_IMAGE_SIZE: size,
      },
    });
    const result = await f.generate();
    expect(result).toMatchObject({ status: 200, body: { billing: { billedUnits: 1, settlementStatus: 'settled' } } });
    expect(f.boundary.images).toHaveLength(1);
    expect(f.boundary.images[0]).toMatchObject({
      model: 'operator-image-model',
      quality: 'medium',
      size,
      n: 1,
      output_format: 'png',
    });
    const artifact = artifacts(result)[0];
    const [width, height] = size.split('x').map(Number);
    expect(artifact).toMatchObject({ width, height });
    const slot = (
      await f.database.execute({
        sql: 'SELECT identity FROM image_slots WHERE execution_id = ?',
        args: [artifact.executionId],
      })
    ).rows[0];
    expect(JSON.parse(String(slot.identity)).profile).toMatchObject({
      model: 'operator-image-model',
      quality: 'medium',
    });
    await f.restart();
    expect((await f.generate()).body.result).toEqual(result.body.result);
    expect(f.boundary.images).toHaveLength(1);
    const download = await fetch(`${f.url()}${f.base}/artifacts/${artifact.id}`, {
      headers: { authorization: `Bearer ${f.owner.credential}` },
    });
    expect(download.status).toBe(200);
    expect(Buffer.from(await download.arrayBuffer())).toEqual(pngFixture(width, height));
  },
);

it('rejects high-bit PNG chunk types even when their CRC and compressed pixels are valid', async () => {
  const { validatePng, crc32 } = await import('../../src/images/png-validation.js');
  const png = pngFixture(1024, 1024);
  expect(validatePng(png)).toEqual({ width: 1024, height: 1024 });
  const damaged = Buffer.from(png);
  const offset = damaged.indexOf(Buffer.from('IDAT'));
  const length = damaged.readUInt32BE(offset - 4);
  damaged[offset] = 0xc9;
  damaged.writeUInt32BE(crc32(damaged.subarray(offset, offset + 4 + length)), offset + 4 + length);
  expect(() => validatePng(damaged)).toThrow(expect.objectContaining({ code: 'state_unavailable' }));
});

it('an uncertain image slot cannot publish metadata or charge', async () => {
  const f = await fixture();
  f.boundary.mode('stall');
  const pending = f.generate('fenced-uncertain');
  await f.boundary.started();
  await f.database.execute("UPDATE image_slots SET state = 'uncertain'");
  f.boundary.release();
  const result = await pending;
  expect((await f.database.execute('SELECT id FROM image_artifacts')).rows).toEqual([]);
  expect(result.body.billing).toMatchObject({
    executionStatus: 'failed',
    billedUnits: 0,
    settlementStatus: 'released',
  });
});

it('approval contracts reject a negative resume before changing a suspended image kit', async () => {
  const f = await fixture();
  const { id } = await f.start('negative-approval');
  const before = (await f.database.execute('SELECT status, version FROM billing_workflow_runs')).rows;
  expect((await f.resume(id, false, 'negative-resume')).status).toBe(400);
  expect((await f.database.execute('SELECT status, version FROM billing_workflow_runs')).rows).toEqual(before);
  expect((await f.database.execute('SELECT units FROM billing_ledger')).rows).toEqual([]);
  expect(f.boundary.images).toHaveLength(0);
  const canceled = await f.call(`${f.base}/workflows/image-kit/runs/${id}/cancel`, {}, 'explicit-decline');
  expect(canceled.body.billing).toMatchObject({
    executionStatus: 'canceled',
    billedUnits: 0,
    settlementStatus: 'released',
  });
});

it.each(['open', 'sync'] as const)(
  'a directory %s failure removes the renamed image before artifact registration',
  async failure => {
    const f = await fixture();
    const directory = join(f.root, 'data/private-images');
    const open = filesystem.open;
    let failed = false;
    const opening = vi.spyOn(filesystem, 'open').mockImplementation(async (...args) => {
      if (args[0] === directory && failure === 'open') {
        failed = true;
        throw Object.assign(new Error('Controlled directory open failure'), { code: 'EIO' });
      }
      const handle = await open(...args);
      if (args[0] === directory && failure === 'sync') {
        handle.sync = async () => {
          failed = true;
          throw Object.assign(new Error('Controlled directory sync failure'), { code: 'EIO' });
        };
      }
      return handle;
    });
    syncBuiltinESMExports();
    try {
      const result = await f.generate('directory-failure');
      expect(failed).toBe(true);
      expect(result.body.billing).toMatchObject({
        executionStatus: 'failed',
        billedUnits: 0,
        settlementStatus: 'released',
      });
      expect(await readdir(directory)).toEqual([]);
      expect((await f.database.execute('SELECT id FROM image_artifacts')).rows).toEqual([]);
      expect((await f.database.execute('SELECT state FROM image_slots')).rows).toEqual([{ state: 'uncertain' }]);
    } finally {
      opening.mockRestore();
      syncBuiltinESMExports();
    }
    await f.restart();
    await f.generate('directory-failure');
    expect(f.boundary.images).toHaveLength(1);
  },
);

it('a lost artifact registration acknowledgement retains the committed PNG without generating it again', async () => {
  const f = await fixture();
  const complete = ExecutionArtifacts.prototype.complete;
  const registration = vi.spyOn(ExecutionArtifacts.prototype, 'complete').mockImplementation(async function (
    this: ExecutionArtifacts,
    ...args
  ) {
    await complete.call(this, ...args);
    throw new Error('Lost artifact registration acknowledgement');
  });
  try {
    const result = await f.generate('lost-artifact-registration');
    expect(result.body.billing).toMatchObject({
      executionStatus: 'completed',
      billedUnits: 1,
      settlementStatus: 'settled',
    });
  } finally {
    registration.mockRestore();
  }
  const rows = (await f.database.execute('SELECT id FROM image_artifacts')).rows;
  expect(rows).toHaveLength(1);
  expect(await readFile(join(f.root, 'data/private-images', `${rows[0].id}.png`))).toEqual(f.boundary.png);
  await f.restart();
  await f.generate('lost-artifact-registration');
  expect(f.boundary.images).toHaveLength(1);
});

it('one release resumes every simultaneous stalled image request and leaves the next gate reusable', async () => {
  const boundary = await imageBoundary();
  const requests: Promise<unknown>[] = [];
  boundary.mode('stall');
  try {
    for (let round = 0; round < 2; round++) {
      const pending = [0, 1].map(index =>
        fetch(`${boundary.url}/images/generations`, {
          method: 'POST',
          signal: AbortSignal.timeout(2000),
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ size: '1024x1024', prompt: `round-${round}-image-${index}` }),
        }).then(async response => ({
          status: response.status,
          body: (await response.json()) as { data: { b64_json: string }[] },
        })),
      );
      requests.push(...pending);
      for (let attempt = 0; attempt < 100 && boundary.images.length !== (round + 1) * 2; attempt++) await setTimeout(5);
      expect(boundary.images).toHaveLength((round + 1) * 2);
      boundary.release();
      const responses = await Promise.all(pending);
      expect(responses.map(response => response.status)).toEqual([200, 200]);
      for (const response of responses)
        expect(Buffer.from(response.body.data[0].b64_json, 'base64')).toEqual(boundary.png);
      boundary.release();
    }
  } finally {
    await boundary.close();
    await Promise.allSettled(requests);
  }
});
