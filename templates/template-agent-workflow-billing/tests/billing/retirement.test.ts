import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { join } from 'node:path';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { PolarBillingDriver } from '../../src/billing/providers/polar.js';
import { pathToFileURL } from 'node:url';
import { MastraBilling } from '../../src/billing/mastra.js';
import { workflowResource } from '../../src/billing/mastra-resources.js';
import { WorkflowStorage } from '../../src/billing/storage/workflows.js';
import { afterEach, expect, it } from 'vitest';
import { BillingService } from '../../src/billing/service.js';
import { BillingGateway } from '../../src/billing/gateway.js';
import { polarFixture } from '../support/polar.js';
import { createHmac } from 'node:crypto';
import { BillingRecovery } from '../../src/billing/recovery.js';
import { RecoveryStorage } from '../../src/billing/storage/recovery.js';
import { removeEffectOwnershipMigration, removeLifecycleMigration } from '../support/billing.js';
import { referenceDriver } from '../support/reference-driver.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture() {
  const f = await polarFixture();
  cleanups.push(f.close);
  const original = await referenceDriver(f.configuration.catalog, {
    id: 'original',
    hosted: true,
    webhookSecret: 'retirement-secret',
  });
  const replacement = await referenceDriver(f.configuration.catalog, { id: 'replacement' });
  cleanups.push(original.close, replacement.close);
  const open = async (activeProvider: string, withOriginal = true) => {
    const service = await BillingService.connect({
      url: f.database.url,
      catalog: f.configuration.catalog,
      activeProvider,
      drivers: withOriginal ? [original.driver, replacement.driver] : [replacement.driver],
    });
    cleanups.push(() => service.close());
    return service;
  };
  const old = await open('original');
  const next = await open('replacement');
  const execute = (service: BillingService, key: string) =>
    new BillingGateway(
      f.organizations,
      f.accounting,
      service,
      { ...f.configuration, provider: service.id, polar: undefined },
      [
        {
          resourceId: 'assistant',
          operation: 'generate',
          measurements: [],
          execute: async () => ({ status: 'succeeded', result: { answer: 'ok' } }),
        },
      ],
    ).execute(f.owner.context, { resourceId: 'assistant', operation: 'generate', input: {}, idempotencyKey: key });
  const retire = () =>
    next.retireProvider({
      workspaceId: f.owner.workspaceId,
      provider: 'original',
      evidence: 'operator:closed-sales-and-renewals',
      externalSalesClosed: true,
    });
  const consume = async (select = true) => {
    await execute(old, 'consume-1');
    await execute(old, 'consume-2');
    for (const row of (await f.observer.execute('SELECT payload FROM billing_outbox')).rows)
      expect(await old.reportUsage(JSON.parse(String(row.payload)))).toMatchObject({ status: 'accepted' });
    original.data.access = false;
    if (select) await next.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'original' });
  };
  return { f, original, replacement, old, next, open, execute, retire, consume };
}

it('allows replacement work after explicitly retiring a fully consumed provider and reopening without its driver', async () => {
  const { f, original, next, open, execute, retire, consume } = await fixture();
  await consume();
  original.data.available = false;
  await expect(execute(next, 'unretired-outage')).rejects.toMatchObject({ code: 'state_unavailable' });
  original.data.available = true;
  const tables = [
    'billing_provider_links',
    'billing_source_owners',
    'billing_admitted_accounts',
    'billing_catalog',
    'billing_usage_bindings',
    'billing_ledger',
    'billing_outbox',
    'provider_usage',
    'grant_allocations',
  ];
  const history = () =>
    Promise.all(tables.map(async table => (await f.observer.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows));
  const before = await history();
  const grantsBefore = (
    await f.observer.execute(
      'SELECT id, source_key, fingerprint, provenance, original_units, consumed_units, valid_from, valid_until FROM credit_grants ORDER BY id',
    )
  ).rows;
  await retire();
  expect(await history()).toEqual(before);
  expect(
    (
      await f.observer.execute(
        'SELECT id, source_key, fingerprint, provenance, original_units, consumed_units, valid_from, valid_until FROM credit_grants ORDER BY id',
      )
    ).rows,
  ).toEqual(grantsBefore);
  original.data.available = false;
  const reopened = await open('replacement', false);
  expect((await execute(reopened, 'replacement-work')).billing.billedUnits).toBe(3);
  const historical = JSON.parse(String(before[6][0].payload));
  expect(await reopened.reportUsage(historical)).toMatchObject({ status: 'duplicate' });
  expect((await f.observer.execute('SELECT SUM(consumed_units) AS consumed FROM credit_grants')).rows[0].consumed).toBe(
    9n,
  );
  const audit = (await f.observer.execute('SELECT evidence FROM billing_provider_lifecycle')).rows[0];
  expect(JSON.parse(String(audit.evidence))).toMatchObject({
    reference: 'operator:closed-sales-and-renewals',
    externalSalesClosed: true,
    activeProvider: 'replacement',
  });
  expect((await f.observer.execute('SELECT state FROM billing_provider_lifecycle')).rows).toEqual([
    { state: 'retired' },
  ]);
});

const barrier = () => {
  let entered!: () => void;
  let release!: () => void;
  const reached = new Promise<void>(resolve => {
    entered = resolve;
  });
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  return {
    reached,
    release,
    wait: async () => {
      entered();
      await held;
    },
  };
};
async function recovery(f: Awaited<ReturnType<typeof fixture>>) {
  const storage = await RecoveryStorage.open({ url: f.f.database.url });
  cleanups.push(() => storage.close());
  return new BillingRecovery(storage, f.next);
}
function notification(workspaceId: string, id: string) {
  const body = Buffer.from(
    JSON.stringify({ account: `workspace:${workspaceId}`, occurredAt: new Date().toISOString() }),
  );
  const timestamp = String(Math.floor(Date.now() / 1000));
  return {
    body,
    headers: {
      'webhook-id': id,
      'webhook-timestamp': timestamp,
      'webhook-signature': createHmac('sha256', 'retirement-secret')
        .update(`${id}.${timestamp}.`)
        .update(body)
        .digest('hex'),
    },
  };
}

it.each(['active', 'local', 'unlinked', 'foreign-workspace', 'missing-attestation', 'missing-evidence'] as const)(
  'rejects %s retirement without changing lifecycle or financial history',
  async scenario => {
    const { f, next, old, consume } = await fixture();
    await consume();
    const before = (await f.observer.execute('SELECT * FROM credit_grants ORDER BY id')).rows;
    const input = {
      workspaceId: f.owner.workspaceId,
      provider: 'original',
      evidence: 'operator:closed',
      externalSalesClosed: true as const,
    };
    if (scenario === 'active') input.provider = 'replacement';
    if (scenario === 'local') input.provider = 'local';
    if (scenario === 'unlinked') input.provider = 'absent';
    if (scenario === 'foreign-workspace') input.workspaceId = 'foreign';
    if (scenario === 'missing-attestation') Object.assign(input, { externalSalesClosed: false });
    if (scenario === 'missing-evidence') input.evidence = ' ';
    await expect(next.retireProvider(input)).rejects.toMatchObject({
      code: scenario.startsWith('missing') ? 'invalid_input' : 'conflict',
    });
    await expect(
      old.retireProvider({
        ...input,
        workspaceId: f.owner.workspaceId,
        provider: 'replacement',
        evidence: 'operator:closed',
        externalSalesClosed: true,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect((await f.observer.execute('SELECT * FROM credit_grants ORDER BY id')).rows).toEqual(before);
    expect((await f.observer.execute('SELECT * FROM billing_provider_lifecycle')).rows).toEqual([]);
  },
);

it.each([
  'remaining-credit',
  'omitted-credit',
  'future-source',
  'access',
  'future-access',
  'subscription',
  'future-subscription',
  'metered',
  'future-metered',
  'unavailable',
  'foreign-account',
  'changed-terms',
] as const)('rejects retirement with %s evidence', async scenario => {
  const { f, original, next, execute, old, retire } = await fixture();
  if (scenario === 'remaining-credit' || scenario === 'omitted-credit') await execute(old, 'partial');
  else {
    await execute(old, 'full-1');
    await execute(old, 'full-2');
  }
  for (const row of (await f.observer.execute('SELECT payload FROM billing_outbox')).rows)
    await old.reportUsage(JSON.parse(String(row.payload)));
  original.data.access = false;
  await next.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'original' });
  if (scenario === 'omitted-credit') original.data.sources = false;
  if (scenario === 'future-source') {
    original.data.sourceKey = 'future-purchase';
    // The catalog has perpetual order terms, so future starts are valid evidence.
    const start = new Date(Date.now() + 3600000).toISOString();
    const provenance = JSON.stringify({
      meter: 'credits',
      kind: 'order',
      units: 6,
      version: original.data.allowance.version,
      expiry: { type: 'none' },
      validFrom: start,
    });
    original.data.sourceOverrides = {
      validFrom: start,
      provenance,
      fingerprint: (await import('node:crypto')).createHash('sha256').update(provenance).digest('hex'),
    };
  }
  const live = { key: 'access', validFrom: new Date(Date.now() - 1000).toISOString(), validUntil: null };
  if (scenario === 'access') original.data.commercialOverrides.entitlements = [live];
  if (scenario === 'future-access')
    original.data.commercialOverrides.entitlements = [
      { ...live, validFrom: new Date(Date.now() + 3600000).toISOString() },
    ];
  if (scenario === 'subscription') original.data.commercialOverrides.subscriptions = [{ ...live, key: 'subscription' }];
  if (scenario === 'future-subscription')
    original.data.commercialOverrides.subscriptions = [
      { ...live, key: 'subscription', validFrom: new Date(Date.now() + 3600000).toISOString() },
    ];
  if (scenario === 'metered') original.data.metered = true;
  if (scenario === 'future-metered')
    original.data.commercialOverrides.meters = [
      {
        key: 'tasks',
        funding: 'metered',
        confirmedBalance: null,
        consumedUnits: 0,
        periodStart: new Date(Date.now() + 3600000).toISOString(),
        periodEnd: new Date(Date.now() + 7200000).toISOString(),
      },
    ];
  if (scenario === 'unavailable') original.data.available = false;
  if (scenario === 'foreign-account') original.data.wrongAccount = true;
  if (scenario === 'changed-terms') original.data.sourceOverrides.fingerprint = '0'.repeat(64);
  const before = (await f.observer.execute('SELECT * FROM credit_grants ORDER BY id')).rows;
  await expect(retire()).rejects.toMatchObject({
    code: ['unavailable', 'foreign-account', 'changed-terms'].includes(scenario) ? 'state_unavailable' : 'conflict',
  });
  expect((await f.observer.execute('SELECT * FROM credit_grants ORDER BY id')).rows).toEqual(before);
  expect((await f.observer.execute('SELECT * FROM billing_provider_lifecycle')).rows).toEqual([]);
});

it('requires fresh signed verification after a new notification and preserves consumed credits across duplicate hints and explicit switchback', async () => {
  const f = await fixture();
  await f.consume();
  const bridge = await recovery(f);
  await f.retire();
  const ack = JSON.parse(
    String((await f.f.observer.execute('SELECT payload FROM billing_outbox LIMIT 1')).rows[0].payload),
  );
  const withoutOld = await f.open('replacement', false);
  await expect(withoutOld.reportUsage({ ...ack, units: ack.units + 1 })).rejects.toMatchObject({ code: 'conflict' });
  const hint = notification(f.f.owner.workspaceId, 'reactivate');
  expect(await bridge.intake(hint, 'original')).toEqual({ duplicate: false });
  const audit = (await f.f.observer.execute('SELECT * FROM billing_provider_lifecycle')).rows;
  expect(audit.map(row => row.state)).toEqual(['retired', 'reactivated']);
  expect(await bridge.intake(hint, 'original')).toEqual({ duplicate: true });
  expect((await f.f.observer.execute('SELECT * FROM billing_provider_lifecycle')).rows).toEqual(audit);
  await expect(f.execute(withoutOld, 'requires-old-again')).rejects.toMatchObject({ code: 'state_unavailable' });
  await f.next.getState(await f.next.ensureAccount({ workspaceId: f.f.owner.workspaceId }));
  await f.retire();
  expect(await bridge.intake(hint, 'original')).toEqual({ duplicate: true });
  expect(
    (await f.f.observer.execute('SELECT state FROM billing_provider_lifecycle ORDER BY id DESC LIMIT 1')).rows[0].state,
  ).toBe('retired');
  await expect(
    f.old.switchProvider({ workspaceId: f.f.owner.workspaceId, expectedProvider: 'replacement' }),
  ).rejects.toMatchObject({ code: 'conflict' });
  await f.old.switchProvider({
    workspaceId: f.f.owner.workspaceId,
    expectedProvider: 'replacement',
    evidence: 'operator:resume-original-sales',
  });
  expect(
    (await f.old.getState(await f.old.ensureAccount({ workspaceId: f.f.owner.workspaceId }))).meters[0],
  ).toMatchObject({ confirmedBalance: 6, consumedUnits: 6 });
  const original = (
    await f.f.observer.execute(
      "SELECT g.* FROM credit_grants g JOIN billing_source_owners o ON o.account_id = g.account_id AND o.source_key = g.source_key WHERE o.provider = 'original'",
    )
  ).rows;
  expect(original).toHaveLength(1);
  expect(original[0].consumed_units).toBe(6n);
  expect(
    (await f.f.observer.execute('SELECT state FROM billing_provider_lifecycle ORDER BY id')).rows.map(row => row.state),
  ).toEqual(['retired', 'reactivated', 'retired', 'reactivated']);
});

it('migrates a populated v12 database additively and retains immutable audit evidence', async () => {
  const { f, old, consume, open, retire } = await fixture();
  await consume();
  const event = JSON.parse(
    String((await f.observer.execute('SELECT payload FROM billing_outbox LIMIT 1')).rows[0].payload),
  );
  const directAck = { ...event, id: 'v12-direct-ack' };
  await old.reportUsage(directAck);
  const tables = [
    'credit_grants',
    'billing_ledger',
    'billing_outbox',
    'provider_usage',
    'billing_usage_bindings',
    'billing_provider_links',
    'billing_source_owners',
    'grant_allocations',
    'billing_admitted_accounts',
    'billing_catalog',
  ];
  const history = () =>
    Promise.all(tables.map(async table => (await f.observer.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows));
  const before = await history();
  const checksums = (await f.observer.execute('SELECT * FROM billing_migrations WHERE version <= 12 ORDER BY version'))
    .rows;
  await removeLifecycleMigration(f.observer);
  await f.observer.execute('PRAGMA user_version = 12');
  await open('replacement');
  expect(await history()).toEqual(before);
  expect(
    (await f.observer.execute('SELECT * FROM billing_migrations WHERE version <= 12 ORDER BY version')).rows,
  ).toEqual(checksums);
  await retire();
  expect(await old.reportUsage(directAck)).toMatchObject({ status: 'duplicate' });
  await expect(old.reportUsage({ ...directAck, units: directAck.units + 1 })).rejects.toMatchObject({
    code: 'conflict',
  });
  await expect(f.observer.execute("UPDATE billing_provider_lifecycle SET evidence = 'rewritten'")).rejects.toThrow();
  await expect(f.observer.execute('DELETE FROM billing_provider_lifecycle')).rejects.toThrow();
});

it('blocks stale hosted closures and usage while permitting acknowledgement replay after retirement', async () => {
  const { f, old, next, original, consume, retire } = await fixture();
  await consume(false);
  const account = await old.ensureAccount({ workspaceId: f.owner.workspaceId });
  const prepared = await old.prepareCheckout({
    account,
    product: f.configuration.catalog.offers[0].key,
    returnUrl: 'https://app.example.test/billing',
  });
  expect(prepared.status).toBe('prepared');
  await next.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'original' });
  await retire();
  if (prepared.status === 'prepared') await expect(prepared.dispatch()).rejects.toMatchObject({ code: 'conflict' });
  await expect(
    old.createPortalSession({ account, returnUrl: 'https://app.example.test/billing' }),
  ).rejects.toMatchObject({ code: 'conflict' });
  const event = JSON.parse(
    String((await f.observer.execute('SELECT payload FROM billing_outbox LIMIT 1')).rows[0].payload),
  );
  const before = original.data.rawRequests.length;
  expect(await old.reportUsage(event)).toMatchObject({ status: 'duplicate' });
  await expect(old.reportUsage({ ...event, id: 'new-stale-event' })).rejects.toMatchObject({ code: 'conflict' });
  expect(original.data.rawRequests).toHaveLength(before);
  expect(original.data.hostedRequests).toEqual([]);
});

it('keeps an in-flight hosted POST visible to retirement across twenty coordinated races', async () => {
  const { f, old, next, original, consume, retire } = await fixture();
  await consume(false);
  for (let iteration = 0; iteration < 20; iteration++) {
    if (iteration)
      await old.switchProvider({
        workspaceId: f.owner.workspaceId,
        expectedProvider: 'replacement',
        evidence: `operator:hosted-retry-${iteration}`,
      });
    const account = await old.ensureAccount({ workspaceId: f.owner.workspaceId });
    const gate = barrier();
    original.data.hostedGate = gate.wait;
    const posting = old.createCheckout({
      account,
      product: f.configuration.catalog.offers[0].key,
      returnUrl: 'https://app.example.test/billing',
    });
    await gate.reached;
    await next.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'original' });
    await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
    gate.release();
    expect(await posting).toMatchObject({ status: 'created' });
    await retire();
    expect(original.data.hostedRequests).toHaveLength(iteration + 1);
  }
});

it.each(['notification', 'switch', 'refresh'] as const)(
  'fences retirement against a coordinated %s race repeated twenty times',
  async scenario => {
    const f = await fixture();
    await f.consume();
    const bridge = await recovery(f);
    for (let iteration = 0; iteration < 20; iteration++) {
      const gate = barrier();
      f.original.data.observationGate = async () => {
        f.original.data.observationGate = null;
        await gate.wait();
      };
      if (scenario === 'refresh') {
        const refreshing = f.next.getState(await f.next.ensureAccount({ workspaceId: f.f.owner.workspaceId }));
        await gate.reached;
        await f.retire();
        gate.release();
        expect((await refreshing).account.provider).toBe('replacement');
        expect(
          (await f.f.observer.execute('SELECT SUM(consumed_units) AS consumed FROM credit_grants')).rows[0].consumed,
        ).toBe(6n);
        await bridge.intake(notification(f.f.owner.workspaceId, `refresh-${iteration}`), 'original');
      } else {
        const retiring = f.retire();
        const rejection = expect(retiring).rejects.toMatchObject({ code: 'conflict' });
        await gate.reached;
        if (scenario === 'notification')
          await bridge.intake(notification(f.f.owner.workspaceId, `race-${iteration}`), 'original');
        else await f.old.switchProvider({ workspaceId: f.f.owner.workspaceId, expectedProvider: 'replacement' });
        gate.release();
        await rejection;
        if (scenario === 'switch')
          await f.next.switchProvider({ workspaceId: f.f.owner.workspaceId, expectedProvider: 'original' });
      }
      await f.next.getState(await f.next.ensureAccount({ workspaceId: f.f.owner.workspaceId }));
    }
  },
);

it.each(['pending', 'uncertain', 'failed'] as const)(
  'retains the historical driver while an export is %s',
  async scenario => {
    const f = await fixture();
    await f.execute(f.old, 'unacknowledged-1');
    await f.execute(f.old, 'unacknowledged-2');
    f.original.data.access = false;
    await f.next.switchProvider({ workspaceId: f.f.owner.workspaceId, expectedProvider: 'original' });
    const bridge = await recovery(f);
    f.original.data.usageUncertain = scenario === 'uncertain';
    f.original.data.usageRejected = scenario === 'failed';
    if (scenario !== 'pending') await bridge.runOnce();
    const before = (await f.f.observer.execute('SELECT * FROM billing_outbox ORDER BY id')).rows;
    await expect(f.retire()).rejects.toMatchObject({ code: 'conflict' });
    expect((await f.f.observer.execute('SELECT * FROM billing_outbox ORDER BY id')).rows).toEqual(before);
    if (scenario !== 'failed') {
      f.original.data.usageUncertain = false;
      for (const row of before) await f.old.reportUsage(JSON.parse(String(row.payload)));
      await f.retire();
    }
  },
);

it('blocks unresolved legacy external writes whose opaque payload has no retained provider association', async () => {
  const { f, consume, retire } = await fixture();
  await consume();
  const accountId = (await f.observer.execute('SELECT id FROM billing_accounts')).rows[0].id;
  await f.observer.execute({
    sql: "INSERT INTO provider_usage VALUES ('legacy-ambiguous', ?, 'opaque-provider-payload', 0)",
    args: [accountId],
  });
  await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
  await f.observer.execute({ sql: "UPDATE provider_usage SET delivered = 1 WHERE id = 'legacy-ambiguous'", args: [] });
  const actorId = (await f.observer.execute('SELECT id FROM identities LIMIT 1')).rows[0].id;
  await f.observer.execute({
    sql: "INSERT INTO hosted_operations VALUES (?, ?, 'checkout', 'legacy-checkout', 'legacy-fingerprint', NULL, 'dispatched')",
    args: [actorId, f.owner.workspaceId],
  });
  await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
});

it('keeps concurrent usage POSTs fenced until every response finishes across twenty coordinated races', async () => {
  const fixtureData = await fixture();
  const { f, old, next, original, consume, retire } = fixtureData;
  await consume();
  const bridge = await recovery(fixtureData);
  const historical = JSON.parse(
    String((await f.observer.execute('SELECT payload FROM billing_outbox LIMIT 1')).rows[0].payload),
  );
  for (let iteration = 0; iteration < 20; iteration++) {
    if (iteration) await bridge.intake(notification(f.owner.workspaceId, `usage-reactivate-${iteration}`), 'original');
    original.data.usageUncertain = false;
    const event = { ...historical, id: `direct-concurrent-${iteration}` };
    const first = barrier();
    const second = barrier();
    let posts = 0;
    original.data.usageGate = async () => {
      await (++posts === 1 ? first.wait() : second.wait());
    };
    const a = old.reportUsage(event);
    await first.reached;
    const b = old.reportUsage(event);
    await second.reached;
    first.release();
    expect(await a).toMatchObject({ status: 'accepted' });
    await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
    original.data.usageUncertain = true;
    second.release();
    expect(await b).toMatchObject({ status: 'uncertain' });
    expect(
      (
        await f.observer.execute({
          sql: 'SELECT state FROM billing_external_effects WHERE external_key = ?',
          args: [event.id],
        })
      ).rows,
    ).toEqual([{ state: 'complete' }, { state: 'complete' }]);
    await retire();
    const before = original.data.rawRequests.length;
    expect(await next.reportUsage(event)).toMatchObject({ status: 'duplicate' });
    expect(original.data.rawRequests).toHaveLength(before);
  }
});

it.each(['succeeded', 'uncertain'] as const)(
  'retains historical grants reserved by a replacement-provider execution that later becomes %s',
  async outcome => {
    const f = await fixture();
    await f.execute(f.old, 'partial-original');
    const originalEvent = JSON.parse(
      String((await f.f.observer.execute('SELECT payload FROM billing_outbox')).rows[0].payload),
    );
    await f.old.reportUsage(originalEvent);
    f.original.data.access = false;
    f.replacement.data.sources = false;
    await f.next.switchProvider({ workspaceId: f.f.owner.workspaceId, expectedProvider: 'original' });
    const held = barrier();
    const gateway = new BillingGateway(
      f.f.organizations,
      f.f.accounting,
      f.next,
      { ...f.f.configuration, provider: 'replacement', polar: undefined },
      [
        {
          resourceId: 'assistant',
          operation: 'generate',
          measurements: [],
          execute: async () => {
            await held.wait();
            return { status: outcome, result: { answer: 'ok' } };
          },
        },
      ],
    );
    const running = gateway.execute(f.f.owner.context, {
      resourceId: 'assistant',
      operation: 'generate',
      input: {},
      idempotencyKey: 'holding-old-grant',
    });
    await held.reached;
    f.original.data.sourceOverrides.active = false;
    const allocations = (await f.f.observer.execute('SELECT * FROM grant_allocations WHERE committed_units IS NULL'))
      .rows;
    expect(allocations).toHaveLength(1);
    expect(allocations[0].reserved_units).toBe(3n);
    await expect(f.retire()).rejects.toMatchObject({ code: 'conflict' });
    held.release();
    expect((await running).billing.executionStatus).toBe(outcome === 'succeeded' ? 'completed' : 'uncertain');
    if (outcome === 'succeeded') await f.retire();
    else await expect(f.retire()).rejects.toMatchObject({ code: 'conflict' });
  },
);

it('preserves a real suspended Mastra workflow and its historical grant hold until an authorized cancellation releases it', async () => {
  const f = await fixture();
  await f.execute(f.old, 'partial-before-suspension');
  const event = JSON.parse(String((await f.f.observer.execute('SELECT payload FROM billing_outbox')).rows[0].payload));
  await f.old.reportUsage(event);
  f.original.data.access = false;
  f.replacement.data.sources = false;
  await f.next.switchProvider({ workspaceId: f.f.owner.workspaceId, expectedProvider: 'original' });
  const schema = z.object({ count: z.number().int() });
  const approval = createStep({
    id: 'approval',
    inputSchema: schema,
    outputSchema: schema,
    resumeSchema: z.object({ approved: z.boolean() }),
    suspendSchema: z.object({ reason: z.string() }),
    execute: async ({ inputData, resumeData, suspend }) =>
      resumeData?.approved ? inputData : suspend({ reason: 'Approval required' }),
  });
  const workflow = createWorkflow({
    id: 'retirement-report',
    inputSchema: schema,
    outputSchema: schema,
    options: { autoRestartActiveRuns: false },
  })
    .then(approval)
    .commit();
  const workflowStorage = await WorkflowStorage.open({ url: f.f.database.url }, f.f.organizations.storage);
  cleanups.push(() => workflowStorage.close());
  const snapshots = new LibSQLStore({
    id: 'retirement-workflow',
    url: pathToFileURL(join(f.f.database.directory, 'workflow.db')).href,
  });
  await snapshots.init();
  cleanups.push(() => snapshots.close());
  new Mastra({ workflows: { report: workflow }, storage: snapshots });
  const billing = new MastraBilling({
    organizations: f.f.organizations,
    accounting: f.f.accounting,
    workflowStorage,
    provider: f.next,
    configuration: {
      ...f.f.configuration,
      provider: 'replacement',
      polar: undefined,
      resources: [
        {
          id: 'report',
          kind: 'workflow',
          operations: ['start', 'resume', 'cancel'],
          policy: {
            version: 'held-workflow-v1',
            access: { entitlement: 'access', subscription: 'subscription' },
            charge: { type: 'credits', meter: 'credits', units: 3 },
          },
        },
      ],
    },
    agents: {},
    workflows: { report: workflowResource(workflow, { version: 'held-definition-v1' }) },
  });
  const run = await billing.workflow('report').createRun({ billing: f.f.owner.context, idempotencyKey: 'create-held' });
  const started = await run.start({
    billing: f.f.owner.context,
    idempotencyKey: 'start-held',
    inputData: { count: 0 },
  });
  expect(started.kind === 'immediate' && started.projection.status).toBe('suspended');
  f.original.data.sourceOverrides.active = false;
  await expect(f.retire()).rejects.toMatchObject({ code: 'conflict' });
  expect((await run.status(f.f.owner.context)).result).toMatchObject({ status: 'suspended' });
  const canceled = await run.cancel({ billing: f.f.owner.context, idempotencyKey: 'cancel-held' });
  expect(canceled.billing).toMatchObject({ executionStatus: 'canceled', billedUnits: 0 });
  await f.retire();
  const grants = (
    await f.f.observer.execute(
      "SELECT g.* FROM credit_grants g JOIN billing_source_owners o ON o.account_id = g.account_id AND o.source_key = g.source_key WHERE o.provider = 'original'",
    )
  ).rows;
  expect(grants[0]).toMatchObject({ original_units: 6n, consumed_units: 3n, available: 0n });
  await expect(f.execute(f.next, 'no-revoked-credit-resurrection')).rejects.toMatchObject({ code: 'forbidden' });
});

it('allows retirement of explicitly expired access and metered contracts without restoring credit', async () => {
  const { original, consume, retire } = await fixture();
  await consume();
  const validFrom = new Date(Date.now() - 7200000).toISOString();
  const validUntil = new Date(Date.now() - 3600000).toISOString();
  original.data.commercialOverrides = {
    entitlements: [{ key: 'access', validFrom, validUntil }],
    subscriptions: [{ key: 'subscription', validFrom, validUntil }],
    meters: [
      {
        key: 'tasks',
        funding: 'metered',
        confirmedBalance: null,
        consumedUnits: 0,
        periodStart: validFrom,
        periodEnd: validUntil,
      },
    ],
  };
  await retire();
});

it('retains a historical provider after an uncertain hosted result without retrying the POST', async () => {
  const { f, old, next, original, consume, retire } = await fixture();
  await consume(false);
  const account = await old.ensureAccount({ workspaceId: f.owner.workspaceId });
  original.data.hostedUncertain = true;
  await expect(
    old.createCheckout({
      account,
      product: f.configuration.catalog.offers[0].key,
      returnUrl: 'https://app.example.test/billing',
    }),
  ).rejects.toMatchObject({ code: 'state_unavailable' });
  await next.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'original' });
  await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
  expect(original.data.hostedRequests).toHaveLength(1);
  expect((await f.observer.execute("SELECT state FROM billing_external_effects WHERE kind = 'checkout'")).rows).toEqual(
    [{ state: 'uncertain' }],
  );
});

it('retains the provider for interrupted workflow claims even before an accounting execution exists', async () => {
  const { f, consume, retire } = await fixture();
  await consume();
  const storage = await WorkflowStorage.open({ url: f.database.url }, f.organizations.storage);
  cleanups.push(() => storage.close());
  const identity = await f.organizations.accountingIdentity(f.owner.context);
  const record = await storage.create(
    identity,
    {
      id: 'report',
      kind: 'workflow',
      operations: ['start', 'resume', 'cancel'],
      measurements: [],
      policy: { version: 'orphan-claim-v1', charge: { type: 'none' } },
    },
    'orphan-definition-v1',
    'orphan-create',
  );
  const claim = await storage.claim(identity, record.id, 'start', 'orphan-start', { count: 0 }, 'interrupted-owner');
  expect(claim.record.status).toBe('running');
  expect(
    (await f.observer.execute({ sql: 'SELECT id FROM billing_executions WHERE id = ?', args: [record.id] })).rows,
  ).toEqual([]);
  await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
  await storage.transition(record.id, claim.record.version, 'uncertain');
  await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
});

async function interruptedDispatch(kind: 'usage' | 'checkout' = 'usage') {
  const f = await polarFixture();
  cleanups.push(f.close);
  await f.execute('charged-before-sender-death');
  const event = JSON.parse(String((await f.observer.execute('SELECT payload FROM billing_outbox')).rows[0].payload));
  if (kind === 'checkout') await f.commercial.provider.reportUsage(event);
  let signalReached!: () => void;
  let releasePost!: () => void;
  const reached = new Promise<void>(resolve => {
    signalReached = resolve;
  });
  const release = new Promise<void>(resolve => {
    releasePost = resolve;
  });
  f.wire.data.pause = {
    path: kind === 'usage' ? '/v1/events/ingest' : '/v1/checkouts/',
    reached: signalReached,
    release,
  };
  const child = fork(
    new URL('../support/usage-delivery-worker.mjs', import.meta.url),
    [
      JSON.stringify({
        url: f.database.url,
        configuration: f.configuration.polar,
        catalog: f.configuration.catalog,
        event,
        kind,
        request: {
          account: event.account,
          product: f.configuration.catalog.offers[0].key,
          returnUrl: 'https://app.example.test/billing',
        },
      }),
    ],
    { execPath: process.execPath, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] },
  );
  let stderr = '';
  child.stderr!.on('data', data => {
    stderr += data;
  });
  const exited = once(child, 'exit');
  cleanups.push(async () => {
    releasePost();
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL');
      await exited;
    }
  });
  await Promise.race([
    reached,
    exited.then(() => {
      throw new Error(`Sender exited before POST: ${stderr}`);
    }),
  ]);
  const reference = await referenceDriver(f.configuration.catalog);
  cleanups.push(reference.close);
  const polar = new PolarBillingDriver(
    f.configuration.polar!,
    f.configuration.catalog,
    'loopback-test-token',
    async () => ({ email: 'trusted@example.test' }),
  );
  const next = await BillingService.connect({
    url: f.database.url,
    catalog: f.configuration.catalog,
    activeProvider: 'reference',
    drivers: [polar, reference.driver],
  });
  cleanups.push(() => next.close());
  for (const grant of f.wire.data.grants) {
    grant.is_granted = false;
    grant.is_revoked = true;
  }
  for (const subscription of f.wire.data.subscriptions) subscription.status = 'canceled';
  await next.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'polar' });
  const retire = () =>
    next.retireProvider({
      workspaceId: f.owner.workspaceId,
      provider: 'polar',
      evidence: 'operator:closed-sales',
      externalSalesClosed: true,
    });
  const kill = async () => {
    child.kill('SIGKILL');
    await exited;
    releasePost();
  };
  return { f, event, child, reference, next, retire, kill, releasePost, exited };
}

it.each(['retry', 'replay', 'retirement'] as const)(
  'recovers a killed usage sender through %s without changing financial history',
  async recovery => {
    const { f, event, reference, retire, kill } = await interruptedDispatch();
    const tables = [
      'billing_ledger',
      'billing_outbox',
      'billing_usage_events',
      'billing_usage_bindings',
      'billing_admitted_accounts',
      'billing_source_owners',
      'grant_allocations',
      'billing_catalog',
      'billing_provider_links',
    ];
    const history = () =>
      Promise.all([
        ...tables.map(async table => (await f.observer.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows),
        f.observer
          .execute('SELECT id, account_id, payload FROM provider_usage ORDER BY rowid')
          .then(result => result.rows),
        f.observer
          .execute(
            'SELECT id, account_id, source_key, fingerprint, provenance, meter, kind, original_units, consumed_units, valid_from, valid_until FROM credit_grants ORDER BY rowid',
          )
          .then(result => result.rows),
      ]);
    const before = await history();
    if (recovery !== 'retry') {
      expect(await f.commercial.provider.reportUsage(event)).toMatchObject({ status: 'accepted' });
      // A competing ACK must never clear a sender that can still finish its POST.
      await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
    }
    await kill();
    if (recovery === 'retry') {
      await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
      expect((await f.observer.execute('SELECT delivered FROM provider_usage')).rows).toEqual([{ delivered: 0n }]);
      expect(['accepted', 'duplicate']).toContain((await f.commercial.provider.reportUsage(event)).status);
    }
    if (recovery === 'replay') {
      const withoutPolar = await BillingService.connect({
        url: f.database.url,
        catalog: f.configuration.catalog,
        activeProvider: 'reference',
        drivers: [reference.driver],
      });
      cleanups.push(() => withoutPolar.close());
      for (const changed of [
        { ...event, units: event.units + 1 },
        { ...event, account: { ...event.account, provider: 'reference' } },
        { ...event, account: { ...event.account, id: 'another-account' } },
      ])
        await expect(withoutPolar.reportUsage(changed)).rejects.toMatchObject({ code: 'conflict' });
      expect(
        (await f.observer.execute("SELECT state FROM billing_external_effects WHERE kind = 'usage' ORDER BY rowid"))
          .rows,
      ).toEqual([{ state: 'pending' }, { state: 'complete' }]);
      expect(await withoutPolar.reportUsage(event)).toMatchObject({ status: 'duplicate' });
    }
    await retire();
    expect(
      (await f.observer.execute("SELECT state FROM billing_external_effects WHERE kind = 'usage' ORDER BY rowid")).rows,
    ).toEqual([{ state: 'complete' }, { state: 'complete' }]);
    expect(await history()).toEqual(before);
    expect((await f.observer.execute('SELECT delivered FROM provider_usage')).rows).toEqual([{ delivered: 1n }]);
    expect(f.wire.data.events.size).toBe(1);
    const requests = f.wire.data.requests.filter(request => request.path === '/v1/events/ingest');
    expect(requests).toHaveLength(2);
    expect(requests[0].body).toEqual(requests[1].body);
    const reopened = await BillingService.connect({
      url: f.database.url,
      catalog: f.configuration.catalog,
      activeProvider: 'reference',
      drivers: [reference.driver],
    });
    cleanups.push(() => reopened.close());
    expect(await reopened.reportUsage(event)).toMatchObject({ status: 'duplicate' });
    expect(await history()).toEqual(before);
  },
);

it('preserves ownerless schema13 dispatches and all original migration checksums after upgrade', async () => {
  const { f, event, retire, kill } = await interruptedDispatch();
  await kill();
  const checksums = (await f.observer.execute('SELECT * FROM billing_migrations WHERE version <= 13 ORDER BY version'))
    .rows;
  const effects = (await f.observer.execute('SELECT * FROM billing_external_effects ORDER BY rowid')).rows;
  const claims = (await f.observer.execute('SELECT * FROM provider_usage')).rows;
  await removeEffectOwnershipMigration(f.observer);
  await f.observer.execute('PRAGMA user_version = 13');
  const upgraded = await BillingService.connect({
    url: f.database.url,
    catalog: f.configuration.catalog,
    activeProvider: 'polar',
    drivers: [
      new PolarBillingDriver(f.configuration.polar!, f.configuration.catalog, 'loopback-test-token', async () => ({
        email: 'trusted@example.test',
      })),
    ],
  });
  cleanups.push(() => upgraded.close());
  expect(
    (await f.observer.execute('SELECT * FROM billing_migrations WHERE version <= 13 ORDER BY version')).rows,
  ).toEqual(checksums);
  expect((await f.observer.execute('SELECT * FROM billing_external_effects ORDER BY rowid')).rows).toEqual(effects);
  expect((await f.observer.execute('SELECT * FROM provider_usage')).rows).toEqual(claims);
  expect((await f.observer.execute('SELECT * FROM billing_external_effect_owners')).rows).toEqual([]);
  expect(['accepted', 'duplicate']).toContain((await upgraded.reportUsage(event)).status);
  expect(await upgraded.reportUsage(event)).toMatchObject({ status: 'duplicate' });
  await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
  expect((await f.observer.execute('SELECT state FROM billing_external_effects ORDER BY rowid')).rows).toEqual([
    { state: 'pending' },
    { state: 'complete' },
  ]);
  await expect(
    f.observer.execute("UPDATE billing_external_effect_owners SET runtime_id = 'another-owner'"),
  ).rejects.toThrow();
  await expect(f.observer.execute('DELETE FROM billing_external_effect_owners')).rejects.toThrow();
  await expect(f.observer.execute('UPDATE billing_runtimes SET pid = 1')).rejects.toThrow();
  await expect(f.observer.execute('DELETE FROM billing_runtimes')).rejects.toThrow();
});

it('retains a killed hosted sender despite unrelated acknowledged usage', async () => {
  const { f, child, retire, kill } = await interruptedDispatch('checkout');
  const owner = (
    await f.observer.execute(
      "SELECT r.pid FROM billing_external_effect_owners o JOIN billing_runtimes r ON r.id = o.runtime_id JOIN billing_external_effects e ON e.id = o.effect_id WHERE e.kind = 'checkout'",
    )
  ).rows;
  expect(owner).toEqual([{ pid: BigInt(child.pid!) }]);
  await kill();
  await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
  expect((await f.observer.execute("SELECT state FROM billing_external_effects WHERE kind = 'checkout'")).rows).toEqual(
    [{ state: 'pending' }],
  );
});

it.each(['usage', 'checkout'] as const)('retains an uncertain %s result after its sender exits', async kind => {
  const { f, event, retire, releasePost, exited } = await interruptedDispatch(kind);
  if (kind === 'usage') f.wire.data.lostUsage = true;
  else f.wire.data.lostHosted = true;
  releasePost();
  await exited;
  await expect(retire()).rejects.toMatchObject({ code: 'conflict' });
  expect(
    (await f.observer.execute({ sql: 'SELECT state FROM billing_external_effects WHERE kind = ?', args: [kind] })).rows,
  ).toEqual([{ state: 'uncertain' }]);
  if (kind === 'usage') {
    expect((await f.observer.execute('SELECT delivered FROM provider_usage')).rows).toEqual([{ delivered: 0n }]);
    expect(await f.commercial.provider.reportUsage(event)).toMatchObject({ status: 'duplicate' });
    await retire();
    expect(f.wire.data.events.size).toBe(1);
  }
});
