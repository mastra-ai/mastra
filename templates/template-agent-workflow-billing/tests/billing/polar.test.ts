import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { UsageBindingRecovery } from '../../src/billing/storage/usage-bindings.js';
import { stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { billingConfigurationSchema } from '../../src/billing/configuration.js';
import { initializeBilling } from '../../src/billing/setup.js';
import { CommercialService } from '../../src/billing/commercial.js';
import { CommercialStorage } from '../../src/billing/storage/commercial.js';
import { createBillingApp } from '../../src/server/billing.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { BillingGateway } from '../../src/billing/gateway.js';
import { BillingDatabase } from '../../src/billing/storage/database.js';
import { LocalBillingStorage } from '../../src/billing/storage/libsql.js';
import { polarFixture, polarWire } from '../support/polar.js';
import { httpServer } from '../support/organizations.js';

const cleanups: (() => unknown | Promise<unknown>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture(options: Parameters<typeof polarFixture>[0] = {}) {
  const value = await polarFixture(options);
  cleanups.push(value.close);
  return value;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => {
    resolve = done;
  });
  return { promise, resolve };
}

function workflowWorker(phase: 'start' | 'resume' | 'deliver', options: object, executionId = '') {
  return new Promise<any>((resolve, reject) => {
    const child = fork(
      fileURLToPath(new URL('../support/polar-workflow-worker.mjs', import.meta.url)),
      [phase, JSON.stringify(options), executionId],
      { execArgv: [], stdio: ['ignore', 'pipe', 'pipe', 'ipc'] },
    );
    let result: any;
    let stderr = '';
    child.stderr?.on('data', chunk => {
      stderr += chunk;
    });
    child.on('message', message => {
      result = message;
    });
    child.on('error', reject);
    child.on('exit', code =>
      code === 0 && !result?.error ? resolve(result) : reject(new Error(result?.error ?? stderr)),
    );
  });
}

describe('Polar commercial and authoritative prepaid journeys', () => {
  it('reopens legacy purchases through a provider-neutral catalog without rewriting financial history', async () => {
    const f = await fixture();
    await f.execute('catalog-history');
    const history = async () => {
      const tables = ['credit_grants', 'billing_ledger', 'billing_outbox', 'billing_usage_bindings'];
      return Promise.all(
        tables.map(async table => (await f.observer.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows),
      );
    };
    const before = await history();
    // Retain the historical v9 provenance contract, including exact serialized
    // field order and the original allocation version from inline Polar input.
    for (const mapping of f.legacyConfiguration.polar.grants) {
      const subscription = mapping.kind === 'subscription';
      const validFrom = subscription
        ? f.wire.data.subscriptions[0].current_period_start
        : f.wire.data.orders[0].created_at;
      const identity = {
        kind: mapping.kind,
        sourceId: subscription ? f.wire.ids.subscription : f.wire.ids.order,
        benefitId: mapping.benefitId,
        periodStart: subscription ? validFrom : null,
      };
      const provenance = JSON.stringify({
        ...identity,
        meter: mapping.meter,
        productId: mapping.productId,
        priceId: mapping.priceId,
        units: mapping.units,
        version: mapping.version,
        expiry: mapping.expiry,
        validFrom,
      });
      expect(before[0].find(row => row.kind === mapping.kind)).toMatchObject({
        source_key: createHash('sha256').update(JSON.stringify(identity)).digest('hex'),
        fingerprint: createHash('sha256').update(provenance).digest('hex'),
        provenance,
        original_units: BigInt(mapping.units),
      });
    }
    const oldChecksums = (
      await f.observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 9 ORDER BY version')
    ).rows;
    f.commercial.close();
    await f.observer.execute('DROP TABLE billing_catalog');
    await f.observer.execute('DELETE FROM billing_migrations WHERE version = 10');
    await f.observer.execute('PRAGMA user_version = 9');
    const legacyReopened = await initializeBilling(f.initialization);
    cleanups.push(legacyReopened.close);
    const normalized = billingConfigurationSchema.parse(legacyReopened.configuration);
    expect(normalized.catalog?.allowances.map(value => value.units)).toEqual([6, 4]);
    expect(normalized.polar!.grants.every(value => value.allowance && !('units' in value))).toBe(true);
    expect(normalized.catalog.offers.map(value => value.key)).toContain('credit-pack');
    legacyReopened.close();
    const reopened = await initializeBilling({ ...f.initialization, configuration: normalized });
    cleanups.push(reopened.close);
    const account = await reopened.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
    expect((await reopened.provider.getState(account)).meters[0]).toMatchObject({
      confirmedBalance: 7,
      consumedUnits: 3,
    });
    expect(reopened.configuration.resources).toEqual(f.configuration.resources);
    expect(reopened.configuration.mappings).toEqual(f.configuration.mappings);
    expect(await history()).toEqual(before);
    expect(
      (await f.observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 9 ORDER BY version'))
        .rows,
    ).toEqual(oldChecksums);
    const mismatched = structuredClone(normalized);
    mismatched.catalog.offers[0].allowances = [];
    await expect(initializeBilling({ ...f.initialization, configuration: mismatched })).rejects.toMatchObject({
      code: 'invalid_configuration',
    });
    expect(await history()).toEqual(before);
    const wrongAccess = structuredClone(normalized);
    wrongAccess.catalog.offers[0].version = 'different-benefit';
    wrongAccess.catalog.offers[0].entitlements = ['access'];
    wrongAccess.polar!.products[0].version = 'different-benefit';
    const accessProvider = await initializeBilling({ ...f.initialization, configuration: wrongAccess });
    cleanups.push(accessProvider.close);
    await expect(
      accessProvider.provider.prepareCheckout!({
        account,
        product: 'credit-pack',
        returnUrl: normalized.polar!.returnUrls[0],
      }),
    ).rejects.toMatchObject({ code: 'state_unavailable' });
    expect(f.wire.data.hosted).toBe(0);
    expect(await history()).toEqual(before);
    const future = structuredClone(normalized);
    future.catalog.allowances.push({ ...future.catalog.allowances[0], version: 'future-v2', units: 12 });
    const added = await initializeBilling({ ...f.initialization, configuration: future });
    cleanups.push(added.close);
    expect((await added.provider.getState(account)).meters[0]).toMatchObject({ confirmedBalance: 7, consumedUnits: 3 });
    expect(await history()).toEqual(before);
    const catalogBefore = (await f.observer.execute('SELECT * FROM billing_catalog ORDER BY kind, key, version')).rows;
    expect(catalogBefore.filter(row => row.kind === 'allowance')).toHaveLength(3);
    const conflict = structuredClone(normalized);
    conflict.catalog.allowances[0].units = 99;
    conflict.catalog.allowances.unshift({ ...conflict.catalog.allowances[1], key: 'rolled-back-new-revision' });
    await expect(initializeBilling({ ...f.initialization, configuration: conflict })).rejects.toMatchObject({
      code: 'conflict',
    });
    expect(await history()).toEqual(before);
    expect((await f.observer.execute('SELECT * FROM billing_catalog ORDER BY kind, key, version')).rows).toEqual(
      catalogBefore,
    );
    await expect(f.observer.execute("UPDATE billing_catalog SET terms = '{}' ")).rejects.toThrow();
    await expect(f.observer.execute('DELETE FROM billing_catalog')).rejects.toThrow();
  });

  it.each(['current', 'legacy'] as const)(
    'Polar driver preserves customer and usage identity across retries (%s)',
    async bindingEra => {
      const f = await fixture();
      const local = new OrganizationService(f.organizations.storage, { mode: 'local', provider: 'local' });
      expect(() => new BillingGateway(local, f.accounting, f.commercial.provider, f.configuration, [])).toThrow(
        expect.objectContaining({ code: 'invalid_configuration' }),
      );
      f.wire.data.lostCustomer = true;
      const account = await f.commercial.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
      expect(f.wire.data.creations).toBe(1);
      const created = f.wire.data.requests.find(value => value.method === 'POST' && value.path === '/v1/customers/');
      expect(created?.body).toMatchObject({
        email: 'trusted@example.test',
        external_id: `workspace:${f.owner.workspaceId}`,
      });
      expect(created?.body).not.toHaveProperty('organization_id');
      expect(JSON.stringify(f.wire.data.requests)).not.toContain('untrusted@example.test');
      const response = await f.execute('first');
      expect(response.billing).toMatchObject({ billedUnits: 3, executionStatus: 'completed' });
      const outbox = (await f.observer.execute('SELECT payload FROM billing_outbox')).rows[0];
      const event = JSON.parse(String(outbox.payload));
      f.wire.data.lostUsage = true;
      expect(await f.commercial.provider.reportUsage(event)).toMatchObject({ status: 'uncertain' });
      const initialWire = structuredClone(
        f.wire.data.requests.filter(value => value.path === '/v1/events/ingest')[0].body,
      );
      const durableBeforeRetry = (
        await f.observer.execute({ sql: 'SELECT payload FROM provider_usage WHERE id = ?', args: [event.id] })
      ).rows[0].payload;
      const otherWire = await polarWire();
      cleanups.push(otherWire.close);
      const redirected = structuredClone(f.configuration);
      redirected.polar!.server = otherWire.url;
      const otherDestination = await initializeBilling({ ...f.initialization, configuration: redirected });
      cleanups.push(otherDestination.close);
      await expect(otherDestination.provider.reportUsage(event)).rejects.toMatchObject({ code: 'state_unavailable' });
      expect(otherWire.data.requests).toEqual([]);
      // A normalized immutable claim from v7 remains replayable without inventing
      // a mapping or rewriting its logical/wire payload during migration.
      const originalHistory = (
        await f.observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 7')
      ).rows;
      if (bindingEra === 'legacy') {
        await f.observer.execute('DROP TABLE billing_catalog');
        await f.observer.execute('DROP TABLE billing_usage_bindings');
        await f.observer.execute('ALTER TABLE hosted_operations DROP COLUMN dispatch_state');
        await f.observer.execute('DELETE FROM billing_migrations WHERE version >= 8');
        await f.observer.execute('PRAGMA user_version = 7');
      }
      const changedExport = structuredClone(f.configuration);
      changedExport.polar!.meters[0].eventName = 'work.remapped';
      changedExport.polar!.meters[0].unitsField = 'remapped_units';
      const reopened = await initializeBilling({ ...f.initialization, configuration: changedExport });
      cleanups.push(reopened.close);
      expect(await reopened.provider.ensureAccount({ workspaceId: f.owner.workspaceId })).toEqual(account);
      expect(
        (await f.observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 7')).rows,
      ).toEqual(originalHistory);
      expect(await reopened.provider.reportUsage(event)).toEqual({ status: 'duplicate', eventId: event.id });
      expect(await reopened.provider.reportUsage(event)).toEqual({ status: 'duplicate', eventId: event.id });
      expect(f.wire.data.events.size).toBe(1);
      expect(f.wire.data.requests.filter(value => value.path === '/v1/events/ingest').map(value => value.body)).toEqual(
        [initialWire, initialWire],
      );
      expect(
        (await f.observer.execute({ sql: 'SELECT payload FROM provider_usage WHERE id = ?', args: [event.id] })).rows[0]
          .payload,
      ).toBe(durableBeforeRetry);
      expect([...f.wire.data.events.values()][0]).not.toHaveProperty('organization_id');
      expect([...f.wire.data.events.values()][0]).toMatchObject({
        external_id: event.id,
        external_customer_id: account.externalReference,
        metadata: { units: 3 },
      });
      expect((await reopened.provider.getState(account)).meters[0]).toMatchObject({
        confirmedBalance: 7,
        consumedUnits: 3,
      });
      expect(
        (
          await f.observer.execute(
            'SELECT COUNT(*) AS grants, SUM(original_units) AS original, SUM(consumed_units) AS consumed FROM credit_grants',
          )
        ).rows,
      ).toEqual([{ grants: 2n, original: 10n, consumed: 3n }]);
      await expect(reopened.provider.reportUsage({ ...event, units: 9 })).rejects.toMatchObject({ code: 'conflict' });
      expect((await f.execute('first')).billing).toMatchObject({ replayed: true, billedUnits: 3 });
      expect(f.calls()).toBe(1);
      expect(f.wire.data.requests.every(value => value.version === '2026-10')).toBe(true);
      expect(await reopened.provider.reconcile({ account, eventIds: [event.id] })).toMatchObject({
        status: 'confirmed',
        reflectedEventIds: [],
        snapshot: { prepaidAuthority: 'application-ledger' },
      });
      const localStorage = await LocalBillingStorage.open({ url: f.database.url });
      cleanups.push(() => localStorage.close());
      await expect(localStorage.ensureAccount({ workspaceId: f.owner.workspaceId })).rejects.toMatchObject({
        code: 'conflict',
      });
    },
  );

  it('settled usage keeps its admitted export mapping before the first send after restart', async () => {
    const f = await fixture();
    const response = await f.execute('settled-before-send');
    const bindings = (await f.observer.execute('SELECT * FROM billing_usage_bindings')).rows;
    expect(bindings).toHaveLength(1);
    await expect(f.observer.execute("UPDATE billing_usage_bindings SET payload = '{}'")).rejects.toThrow();
    await expect(f.observer.execute('DELETE FROM billing_usage_bindings')).rejects.toThrow();
    const before = (await f.observer.execute('SELECT * FROM billing_outbox')).rows;
    const event = JSON.parse(String(before[0].payload));
    expect((await f.observer.execute('SELECT * FROM provider_usage')).rows).toEqual([]);
    f.commercial.close();
    const changed = structuredClone(f.configuration);
    changed.polar!.meters[0].eventName = 'work.remapped';
    changed.polar!.meters[0].unitsField = 'remapped_units';
    const reopened = await initializeBilling({ ...f.initialization, configuration: changed });
    cleanups.push(reopened.close);
    expect(await reopened.provider.reportUsage(event)).toEqual({ status: 'accepted', eventId: event.id });
    expect(f.wire.data.requests.filter(value => value.path === '/v1/events/ingest').map(value => value.body)).toEqual([
      {
        events: [
          {
            name: 'work.succeeded',
            external_id: event.id,
            external_customer_id: event.account.externalReference,
            timestamp: event.occurredAt,
            metadata: {
              units: 3,
              execution_id: response.billing.executionId,
              policy_version: 'v1',
              resourceId: 'assistant',
              resourceKind: 'agent',
            },
          },
        ],
      },
    ]);
    expect((await f.observer.execute('SELECT * FROM billing_outbox')).rows).toEqual(before);
    expect((await f.observer.execute('SELECT * FROM billing_usage_bindings')).rows).toEqual(bindings);
    expect((await f.observer.execute('SELECT SUM(units) AS units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
    expect((await f.observer.execute('SELECT SUM(consumed_units) AS consumed FROM credit_grants')).rows).toEqual([
      { consumed: 3n },
    ]);
  });

  it('suspended work retains admission binding through resume and first delivery in new processes', async () => {
    const f = await fixture();
    const configuration = structuredClone(f.configuration);
    configuration.resources = [
      {
        id: 'report',
        kind: 'workflow',
        operations: ['start', 'resume', 'cancel'],
        measurements: [],
        policy: { version: 'workflow-v1', charge: { type: 'credits', meter: 'credits', units: 3 } },
      },
    ];
    const options = {
      ...f.initialization,
      configuration,
      jwks: f.jwks,
      credential: f.owner.credential,
      workspaceId: f.owner.workspaceId,
    };
    const suspended = await workflowWorker('start', options);
    expect(suspended.projection).toMatchObject({ status: 'suspended', suspendedSteps: ['approval'] });
    expect(suspended.billing).toMatchObject({ settlementStatus: 'reserved', billedUnits: null });
    const binding = (await f.observer.execute('SELECT * FROM billing_usage_bindings')).rows;
    expect(binding).toHaveLength(1);
    expect((await f.observer.execute('SELECT * FROM billing_outbox')).rows).toEqual([]);
    configuration.polar!.meters[0].eventName = 'work.remapped';
    configuration.polar!.meters[0].unitsField = 'remapped_units';
    configuration.resources[0].policy.version = 'workflow-v2';
    configuration.resources[0].policy.charge = { type: 'credits', meter: 'credits', units: 8 };
    const resumed = await workflowWorker('resume', options, suspended.executionId);
    expect(resumed.projection).toMatchObject({ status: 'completed', output: { count: 1 } });
    expect(resumed.billing).toMatchObject({
      policyVersion: 'workflow-v1',
      billedUnits: 3,
      settlementStatus: 'settled',
    });
    const before = (await f.observer.execute('SELECT * FROM billing_outbox')).rows;
    expect(before).toHaveLength(1);
    expect((await f.observer.execute('SELECT * FROM provider_usage')).rows).toEqual([]);
    await workflowWorker('deliver', options);
    const event = JSON.parse(String(before[0].payload));
    expect(
      f.wire.data.requests.filter(value => value.path === '/v1/events/ingest').map(value => value.body.events[0]),
    ).toEqual([
      {
        name: 'work.succeeded',
        external_id: event.id,
        external_customer_id: event.account.externalReference,
        timestamp: event.occurredAt,
        metadata: {
          units: 3,
          execution_id: suspended.executionId,
          policy_version: 'workflow-v1',
          resourceId: 'report',
          resourceKind: 'workflow',
        },
      },
    ]);
    expect((await f.observer.execute('SELECT * FROM billing_usage_bindings')).rows).toEqual(binding);
    expect((await f.observer.execute('SELECT * FROM billing_outbox')).rows).toEqual(before);
    expect((await f.observer.execute('SELECT status, attempts FROM billing_delivery')).rows).toEqual([
      { status: 'accepted', attempts: 1n },
    ]);
    expect((await f.observer.execute('SELECT units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
    expect((await f.observer.execute('SELECT SUM(consumed_units) AS consumed FROM credit_grants')).rows).toEqual([
      { consumed: 3n },
    ]);
  }, 30_000);

  it('legacy pending outbox requires explicit original binding evidence and preserves financial history', async () => {
    const f = await fixture();
    await f.execute('legacy-outbox');
    const before = (await f.observer.execute('SELECT * FROM billing_outbox')).rows;
    const event = JSON.parse(String(before[0].payload));
    const originalBinding = f.commercial.provider.bindUsage(event.meter);
    const checksums = (await f.observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 7'))
      .rows;
    f.commercial.close();
    // Reconstruct the actual v7 boundary: settled outbox but no first attempt,
    // so no historical normalized claim can establish the delivery mapping.
    await f.observer.execute('DROP TABLE billing_catalog');
    await f.observer.execute('DROP TABLE billing_usage_bindings');
    await f.observer.execute('ALTER TABLE hosted_operations DROP COLUMN dispatch_state');
    await f.observer.execute('DELETE FROM billing_migrations WHERE version >= 8');
    await f.observer.execute('PRAGMA user_version = 7');
    const changed = structuredClone(f.configuration);
    changed.polar!.meters[0].eventName = 'work.remapped';
    changed.polar!.meters[0].unitsField = 'remapped_units';
    const reopened = await initializeBilling({ ...f.initialization, configuration: changed });
    cleanups.push(reopened.close);
    await expect(reopened.provider.reportUsage(event)).rejects.toMatchObject({ code: 'state_unavailable' });
    expect((await f.observer.execute('SELECT * FROM provider_usage')).rows).toEqual([]);
    expect(f.wire.data.requests.filter(value => value.path === '/v1/events/ingest')).toEqual([]);
    const recovery = await UsageBindingRecovery.open(f.initialization.storage);
    cleanups.push(() => recovery.close());
    await expect(
      recovery.restore({ eventId: event.id, binding: originalBinding, evidence: ' ' }),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      recovery.restore({
        eventId: event.id,
        binding: { ...originalBinding, meter: 'wrong' },
        evidence: 'deployment archive',
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await recovery.restore({
      eventId: event.id,
      binding: originalBinding,
      evidence: 'Trusted deployment archive: original export configuration for this execution',
    });
    await expect(
      recovery.restore({ eventId: event.id, binding: originalBinding, evidence: 'replacement' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(await reopened.provider.reportUsage(event)).toEqual({ status: 'accepted', eventId: event.id });
    expect(
      f.wire.data.requests.filter(value => value.path === '/v1/events/ingest').map(value => value.body.events[0]),
    ).toEqual([expect.objectContaining({ name: 'work.succeeded', metadata: expect.objectContaining({ units: 3 }) })]);
    expect((await f.observer.execute('SELECT * FROM billing_outbox')).rows).toEqual(before);
    expect(
      (await f.observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 7')).rows,
    ).toEqual(checksums);
    expect((await f.observer.execute('SELECT SUM(units) AS units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
    expect((await f.observer.execute('SELECT SUM(consumed_units) AS consumed FROM credit_grants')).rows).toEqual([
      { consumed: 3n },
    ]);
    expect((await f.observer.execute('SELECT evidence FROM billing_usage_bindings')).rows).toEqual([
      { evidence: 'Trusted deployment archive: original export configuration for this execution' },
    ]);
  });

  it('legacy usage claims never invent an outbound payload after restart', async () => {
    const f = await fixture();
    await f.execute('legacy-pending');
    await f.execute('legacy-acknowledged');
    const events = (await f.observer.execute('SELECT payload FROM billing_outbox ORDER BY id')).rows.map(row =>
      JSON.parse(String(row.payload)),
    );
    // These are the exact logical-only records written by the prior driver.
    // Preserve its durable acknowledgement; uncertain history has no original
    // event-name/units-field evidence and must not be reconstructed by guessing.
    for (const [index, event] of events.entries())
      await f.observer.execute({
        sql: 'INSERT INTO provider_usage VALUES (?, ?, ?, ?)',
        args: [event.id, event.account.id, JSON.stringify(event), index],
      });
    const before = (await f.observer.execute('SELECT * FROM provider_usage ORDER BY id')).rows;
    f.commercial.close();
    const changed = structuredClone(f.configuration);
    changed.polar!.meters[0].eventName = 'work.remapped';
    changed.polar!.meters[0].unitsField = 'remapped_units';
    const reopened = await initializeBilling({ ...f.initialization, configuration: changed });
    cleanups.push(reopened.close);
    await expect(reopened.provider.reportUsage(events[0])).rejects.toMatchObject({ code: 'state_unavailable' });
    expect(await reopened.provider.reportUsage(events[1])).toEqual({ status: 'duplicate', eventId: events[1].id });
    await expect(reopened.provider.reportUsage({ ...events[1], units: 9 })).rejects.toMatchObject({ code: 'conflict' });
    expect(f.wire.data.requests.filter(value => value.path === '/v1/events/ingest')).toEqual([]);
    expect((await f.observer.execute('SELECT * FROM provider_usage ORDER BY id')).rows).toEqual(before);
    expect((await f.observer.execute('SELECT SUM(units) AS units FROM billing_ledger')).rows).toEqual([{ units: 6n }]);
    expect((await f.observer.execute('SELECT SUM(consumed_units) AS consumed FROM credit_grants')).rows).toEqual([
      { consumed: 6n },
    ]);
  });

  it('unavailable or unverified Polar grant state blocks new paid admission', async () => {
    const f = await fixture();
    await f.execute('funded');
    for (const property of ['unavailable', 'truncated', 'wrongVersion', 'malformed'] as const) {
      f.wire.data[property] = true;
      await expect(f.execute(property)).rejects.toMatchObject({ code: 'state_unavailable' });
      f.wire.data[property] = false;
    }
    const grant = f.wire.data.grants[0];
    grant.customer_id = randomUUID();
    await expect(f.execute('wrong-customer')).rejects.toMatchObject({ code: 'state_unavailable' });
    grant.customer_id = f.wire.ids.customer;
    f.wire.data.subscriptions[0].status = 'trialing';
    f.wire.data.grants[0].is_granted = false;
    f.wire.data.grants[0].is_revoked = true;
    await expect(f.execute('inactive')).rejects.toMatchObject({ code: 'forbidden' });
    expect(f.calls()).toBe(1);
    expect((await f.observer.execute('SELECT SUM(units) AS units FROM billing_ledger')).rows[0].units).toBe(3n);
    // The same source cannot fund again after changing mapping version or meter.
    f.wire.data.subscriptions[0].status = 'active';
    f.wire.data.grants[0].is_granted = true;
    f.wire.data.grants[0].is_revoked = false;
    const changed = structuredClone(f.configuration);
    changed.catalog.allowances[0].version = 'v2';
    changed.polar!.grants[0].allowance.version = 'v2';
    for (const offer of changed.catalog.offers) offer.version = 'v2';
    for (const product of changed.polar!.products) product.version = 'v2';
    for (const offer of changed.catalog.offers)
      for (const allowance of offer.allowances)
        if (allowance.key === changed.catalog.allowances[0].key) allowance.version = 'v2';
    const reopened = await initializeBilling({ ...f.initialization, configuration: changed });
    cleanups.push(reopened.close);
    const account = await reopened.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
    await expect(reopened.provider.getState(account)).rejects.toMatchObject({ code: 'state_unavailable' });
    expect(
      (await f.observer.execute('SELECT SUM(original_units) AS original FROM credit_grants')).rows[0].original,
    ).toBe(10n);
  });

  it.each(['archived', 'unavailable'] as const)(
    'checkout retries the same key after a %s product preflight recovers',
    async failure => {
      const f = await fixture();
      await f.commercial.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
      const app = await httpServer(createBillingApp(f.organizations, undefined, f.sessions));
      cleanups.push(app.close);
      const body = { product: 'credit-pack', returnUrl: 'https://app.example.test/billing' };
      const call = (url = app.url, input = body) =>
        fetch(`${url}/billing/workspaces/${f.owner.workspaceId}/checkout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${f.owner.credential}`,
            'Idempotency-Key': 'preflight',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(input),
        });
      f.wire.data.products[0].is_archived = failure === 'archived';
      f.wire.data.productUnavailable = failure === 'unavailable';
      expect((await call()).status).toBe(503);
      expect(f.wire.data.hosted).toBe(0);
      const before = (
        await f.observer.execute(
          "SELECT fingerprint, url, dispatch_state FROM hosted_operations WHERE key = 'preflight'",
        )
      ).rows;
      expect(before).toEqual([{ fingerprint: expect.any(String), url: null, dispatch_state: 'not_dispatched' }]);
      f.wire.data.products[0].is_archived = false;
      f.wire.data.productUnavailable = false;
      // Reopen the complete driver/database stack with a second allowed input.
      // The original claim must still conflict, even though no POST was sent.
      const configuration = structuredClone(f.configuration);
      configuration.polar!.returnUrls.push('https://app.example.test/other');
      const reopened = await initializeBilling({ ...f.initialization, configuration });
      cleanups.push(reopened.close);
      const storage = await CommercialStorage.open({ url: f.database.url }, f.organizations.storage);
      cleanups.push(() => storage.close());
      const restarted = new CommercialService(f.organizations, storage, reopened.provider, reopened.configuration);
      const retryApp = await httpServer(createBillingApp(f.organizations, undefined, restarted));
      cleanups.push(retryApp.close);
      expect((await call(retryApp.url, { ...body, returnUrl: 'https://app.example.test/other' })).status).toBe(409);
      expect((await call(retryApp.url)).status).toBe(200);
      expect((await call(retryApp.url)).status).toBe(200);
      expect(f.wire.data.hosted).toBe(1);
      expect(
        (await f.observer.execute("SELECT fingerprint, dispatch_state FROM hosted_operations WHERE key = 'preflight'"))
          .rows,
      ).toEqual([{ fingerprint: before[0].fingerprint, dispatch_state: 'dispatched' }]);
    },
  );

  it.each(['checkout', 'portal'] as const)(
    '%s preparation freezes the validated return destination before awaiting storage',
    async operation => {
      const f = await fixture();
      const account = await f.commercial.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
      const request = { account, product: 'credit-pack', returnUrl: 'https://app.example.test/billing' };
      const preparation =
        operation === 'checkout'
          ? f.commercial.provider.prepareCheckout(request)
          : f.commercial.provider.preparePortalSession(request);
      request.returnUrl = 'https://untrusted.example.test';
      request.product = 'unmapped';
      const prepared = await preparation;
      expect(f.wire.data.hosted).toBe(0);
      if (prepared.status !== 'prepared') throw new Error('Expected hosted preparation');
      expect(await prepared.dispatch()).toMatchObject({ status: 'created' });
      const posted = f.wire.data.requests.find(
        value =>
          value.method === 'POST' &&
          value.path === (operation === 'checkout' ? '/v1/checkouts/' : '/v1/customer-sessions/'),
      );
      expect(posted?.body.return_url).toBe('https://app.example.test/billing');
      if (operation === 'checkout') expect(posted?.body.products).toEqual([f.wire.ids.orderProduct]);
      expect(f.wire.data.hosted).toBe(1);
    },
  );

  it.each(['checkout', 'portal'] as const)(
    '%s dispatches once across concurrent requests and never repeats a lost response',
    async operation => {
      const f = await fixture();
      await f.commercial.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
      const reopened = await initializeBilling(f.initialization);
      cleanups.push(reopened.close);
      const storage = await CommercialStorage.open({ url: f.database.url }, f.organizations.storage);
      cleanups.push(() => storage.close());
      const second = new CommercialService(f.organizations, storage, reopened.provider, reopened.configuration);
      const apps = await Promise.all(
        [f.sessions, second].map(service => httpServer(createBillingApp(f.organizations, undefined, service))),
      );
      cleanups.push(...apps.map(app => app.close));
      const body =
        operation === 'checkout'
          ? { product: 'credit-pack', returnUrl: 'https://app.example.test/billing' }
          : { returnUrl: 'https://app.example.test/billing' };
      const call = (index: number, key: string) =>
        fetch(`${apps[index].url}/billing/workspaces/${f.owner.workspaceId}/${operation}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${f.owner.credential}`,
            'Idempotency-Key': key,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
      for (let index = 0; index < 20; index++) {
        const reached = deferred<void>(),
          release = deferred<void>();
        f.wire.data.pause = {
          path: operation === 'checkout' ? `/v1/products/${f.wire.ids.orderProduct}` : '/v1/customer-sessions/',
          reached: () => reached.resolve(),
          release: release.promise,
        };
        const pending = call(0, `race-${index}`);
        await reached.promise;
        try {
          expect((await call(1, `race-${index}`)).status).toBe(operation === 'checkout' ? 200 : 503);
        } finally {
          release.resolve();
        }
        expect((await pending).status).toBe(200);
        expect((await call(1, `race-${index}`)).status).toBe(200);
        expect(f.wire.data.hosted).toBe(index + 1);
      }
      f.wire.data.lostHosted = true;
      expect((await call(0, 'lost')).status).toBe(503);
      expect((await call(1, 'lost')).status).toBe(503);
      expect(f.wire.data.hosted).toBe(21);
      expect(
        (await f.observer.execute("SELECT url, dispatch_state FROM hosted_operations WHERE key = 'lost'")).rows,
      ).toEqual([{ url: null, dispatch_state: 'dispatched' }]);
    },
  );

  it('owner revocation during checkout preparation blocks dispatch and keeps the claim recoverable', async () => {
    const f = await fixture();
    const successor = await f.profile('successor');
    await f.organizations.convert(f.owner.context, 'share');
    const invitation = await f.organizations.invite(f.owner.context, 'invite-successor', {
      recipientId: successor.identity.id,
      role: 'owner',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    await f.organizations.accept(successor.context, 'accept-successor', { token: invitation.token! });
    const successorContext = await f.organizations.context({
      credential: successor.credential,
      workspaceId: f.owner.workspaceId,
    });
    const reached = deferred<void>(),
      release = deferred<void>();
    f.wire.data.pause = {
      path: `/v1/products/${f.wire.ids.orderProduct}`,
      reached: () => reached.resolve(),
      release: release.promise,
    };
    const body = { product: 'credit-pack', returnUrl: 'https://app.example.test/billing' };
    const pending = f.sessions.checkout(f.owner.context, 'revoked-preflight', body);
    await reached.promise;
    try {
      await f.organizations.changeMember(successorContext, 'demote-owner', {
        memberId: f.owner.identity.id,
        role: 'member',
      });
    } finally {
      release.resolve();
    }
    await expect(pending).rejects.toMatchObject({ code: 'forbidden' });
    expect(f.wire.data.hosted).toBe(0);
    expect(
      (await f.observer.execute("SELECT url, dispatch_state FROM hosted_operations WHERE key = 'revoked-preflight'"))
        .rows,
    ).toEqual([{ url: null, dispatch_state: 'not_dispatched' }]);
    await f.organizations.changeMember(successorContext, 'restore-owner', {
      memberId: f.owner.identity.id,
      role: 'owner',
    });
    expect(await f.sessions.checkout(f.owner.context, 'revoked-preflight', body)).toMatchObject({ status: 'created' });
    expect(f.wire.data.hosted).toBe(1);
  });

  it('checkout and portal enforce workspace billing permissions and allowed destinations', async () => {
    const f = await fixture();
    const member = await f.profile('member');
    const outsider = await f.profile('outsider');
    await f.organizations.convert(f.owner.context, 'share');
    const invitation = await f.organizations.invite(f.owner.context, 'invite', {
      recipientId: member.identity.id,
      role: 'admin',
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    });
    await f.organizations.accept(member.context, 'accept', { token: invitation.token! });
    const app = await httpServer(createBillingApp(f.organizations, undefined, f.sessions));
    cleanups.push(app.close);
    const call = (credential: string, operation: string, key: string, body: unknown, workspace = f.owner.workspaceId) =>
      fetch(`${app.url}/billing/workspaces/${workspace}/${operation}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${credential}`, 'Idempotency-Key': key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const body = { product: 'credit-pack', returnUrl: 'https://app.example.test/billing' };
    expect((await call(member.credential, 'checkout', 'denied', body)).status).toBe(403);
    expect((await call(outsider.credential, 'checkout', 'foreign', body)).status).toBe(403);
    expect(
      (await call(f.owner.credential, 'checkout', 'arbitrary', { ...body, returnUrl: `${body.returnUrl}/evil` }))
        .status,
    ).toBe(400);
    expect((await call(f.owner.credential, 'checkout', 'product', { ...body, product: 'unmapped' })).status).toBe(400);
    expect(f.wire.data.hosted).toBe(0);
    const first = await call(f.owner.credential, 'checkout', 'one', body);
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual(await (await call(f.owner.credential, 'checkout', 'one', body)).json());
    expect(f.wire.data.hosted).toBe(1);
    expect((await call(f.owner.credential, 'portal', 'portal', { returnUrl: body.returnUrl })).status).toBe(200);
    f.wire.data.lostHosted = true;
    expect((await call(f.owner.credential, 'checkout', 'ambiguous', body)).status).toBe(503);
    expect((await call(f.owner.credential, 'checkout', 'ambiguous', body)).status).toBe(503);
    expect(f.wire.data.hosted).toBe(3);
    expect((await f.observer.execute("SELECT url FROM hosted_operations WHERE key = 'ambiguous'")).rows).toEqual([
      { url: null },
    ]);
    const usage = await fetch(`${app.url}/billing/workspaces/${f.owner.workspaceId}/usage`, {
      headers: { Authorization: `Bearer ${f.owner.credential}` },
    });
    expect(await usage.json()).toMatchObject({ mode: 'polar', authority: 'application-ledger' });
    const legacyHistory = (
      await f.observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 8')
    ).rows;
    await f.observer.execute('ALTER TABLE hosted_operations DROP COLUMN dispatch_state');
    await f.observer.execute('DROP TABLE billing_catalog');
    await f.observer.execute('DELETE FROM billing_migrations WHERE version >= 9');
    await f.observer.execute('PRAGMA user_version = 8');
    const storage = await CommercialStorage.open({ url: f.database.url }, f.organizations.storage);
    cleanups.push(() => storage.close());
    expect(
      (await f.observer.execute('SELECT version, checksum FROM billing_migrations WHERE version <= 8')).rows,
    ).toEqual(legacyHistory);
    expect((await f.observer.execute('SELECT DISTINCT dispatch_state FROM hosted_operations')).rows).toEqual([
      { dispatch_state: 'dispatched' },
    ]);
    const restarted = new CommercialService(
      f.organizations,
      storage,
      f.commercial.provider,
      f.commercial.configuration,
    );
    expect(await restarted.checkout(f.owner.context, 'one', body)).toMatchObject({ status: 'created' });
    await expect(restarted.checkout(f.owner.context, 'ambiguous', body)).rejects.toMatchObject({
      code: 'state_unavailable',
    });
    expect(f.wire.data.hosted).toBe(3);
  });

  it('verified prepaid grants survive replay expiry revocation and concurrent spending', async () => {
    const f = await fixture({ units: 6 });
    // Two independently opened driver/database stacks race the same shared
    // sources and SQL reservations, repeatedly rather than relying on timing once.
    const second = await initializeBilling(f.initialization);
    cleanups.push(second.close);
    const gateway = new BillingGateway(f.organizations, f.accounting, second.provider, f.configuration, [
      {
        resourceId: 'assistant',
        operation: 'generate',
        measurements: [],
        execute: async () => ({ status: 'succeeded', result: { answer: 'done' } }),
      },
    ]);
    for (let round = 0; round < 21; round++) {
      if (round) f.wire.data.addOrder();
      const results = await Promise.allSettled([
        f.execute(`race-a-${round}`),
        gateway.execute(f.owner.context, {
          resourceId: 'assistant',
          operation: 'generate',
          idempotencyKey: `race-b-${round}`,
          input: {},
        }),
      ]);
      expect(results.filter(value => value.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter(value => value.status === 'rejected').map(value => value.reason.code)).toEqual([
        'insufficient_credits',
      ]);
    }
    expect(
      (
        await f.observer.execute(
          'SELECT SUM(original_units) AS original, SUM(consumed_units) AS consumed FROM credit_grants',
        )
      ).rows,
    ).toEqual([{ original: 130n, consumed: 126n }]);
    expect(
      (await f.observer.execute('SELECT COUNT(*) AS count, SUM(units) AS units FROM billing_ledger')).rows,
    ).toEqual([{ count: 21n, units: 126n }]);
    expect(
      (await f.observer.execute('SELECT COUNT(*) AS count FROM grant_allocations WHERE committed_units IS NULL'))
        .rows[0].count,
    ).toBe(0n);
    const before = (
      await f.observer.execute('SELECT id, fingerprint, original_units, consumed_units FROM credit_grants ORDER BY id')
    ).rows;
    f.wire.data.subscriptions[0].current_period_end = new Date(Date.now() - 1000).toISOString();
    if (f.wire.data.subscriptions[0].current_meter_period_start !== null)
      f.wire.data.subscriptions[0].current_meter_period_end = f.wire.data.subscriptions[0].current_period_end;
    for (const grant of f.wire.data.grants) {
      grant.is_granted = false;
      grant.is_revoked = true;
    }
    await expect(f.execute('revoked')).rejects.toMatchObject({ code: 'forbidden' });
    expect(
      (
        await f.observer.execute(
          'SELECT id, fingerprint, original_units, consumed_units FROM credit_grants ORDER BY id',
        )
      ).rows,
    ).toEqual(before);
    expect((await f.observer.execute('SELECT SUM(available) AS available FROM credit_grants')).rows[0].available).toBe(
      0n,
    );
    await expect(
      f.observer.execute('UPDATE credit_grants SET original_units = original_units + 1'),
    ).rejects.toMatchObject({ extendedCode: 'SQLITE_CONSTRAINT_TRIGGER' });
  }, 60000);

  it('revoked reservations can settle or release without resurrecting invalid credit', async () => {
    const entered = deferred<void>();
    const finish = deferred<void>();
    const f = await fixture({
      executor: async input => {
        entered.resolve();
        await finish.promise;
        return { status: input === null ? 'failed' : 'succeeded', result: {} };
      },
    });
    const pending = f.execute('admitted');
    await Promise.race([
      entered.promise,
      pending.then(() => {
        throw new Error('The admitted executor did not pause.');
      }),
    ]);
    expect((await f.sessions.usage(f.owner.context)).allowance).toEqual([
      { meter: 'credits', granted: 10, consumed: 0, reserved: 3, unavailable: 0, spendable: 7 },
    ]);
    for (const grant of f.wire.data.grants) {
      grant.is_granted = false;
      grant.is_revoked = true;
    }
    await expect(f.execute('new')).rejects.toMatchObject({ code: 'forbidden' });
    finish.resolve();
    expect((await pending).billing.billedUnits).toBe(3);
    const account = await f.commercial.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
    expect((await f.commercial.provider.getState(account)).meters).toEqual([]);
    expect(
      (
        await f.observer.execute(
          'SELECT SUM(consumed_units) AS consumed, SUM(available) AS available FROM credit_grants',
        )
      ).rows,
    ).toEqual([{ consumed: 3n, available: 0n }]);
    // Publicly confirmed failure releases only its allocation; a later source
    // refresh, rather than release, is the only way to restore unused capacity.
    for (const grant of f.wire.data.grants) {
      grant.is_granted = true;
      grant.is_revoked = false;
    }
    const failing = new BillingGateway(f.organizations, f.accounting, f.commercial.provider, f.configuration, [
      {
        resourceId: 'assistant',
        operation: 'generate',
        measurements: [],
        execute: async () => {
          for (const grant of f.wire.data.grants) {
            grant.is_granted = false;
            grant.is_revoked = true;
          }
          await f.commercial.provider.getState(account);
          return { status: 'failed' };
        },
      },
    ]);
    expect(
      (
        await failing.execute(f.owner.context, {
          resourceId: 'assistant',
          operation: 'generate',
          idempotencyKey: 'failure',
          input: {},
        })
      ).billing,
    ).toMatchObject({ billedUnits: 0, settlementStatus: 'released' });
    expect(
      (
        await f.observer.execute(
          'SELECT SUM(consumed_units) AS consumed, SUM(available) AS available FROM credit_grants',
        )
      ).rows,
    ).toEqual([{ consumed: 3n, available: 0n }]);
    expect(
      (await f.observer.execute('SELECT COUNT(*) AS count FROM grant_allocations WHERE committed_units IS NULL'))
        .rows[0].count,
    ).toBe(0n);
    expect((await f.sessions.usage(f.owner.context)).allowance).toEqual([
      { meter: 'credits', granted: 10, consumed: 3, reserved: 0, unavailable: 7, spendable: 0 },
    ]);
    const database = await BillingDatabase.open({ url: f.database.url });
    cleanups.push(() => database.close());
    expect((await f.observer.execute('PRAGMA foreign_key_check')).rows).toEqual([]);
  });
  it('metered usage requires a verified active product and never debits prepaid grants', async () => {
    const f = await fixture();
    const productId = randomUUID(),
      priceId = randomUUID(),
      meterId = randomUUID();
    const product = {
      ...f.wire.data.products[1],
      id: productId,
      benefits: [],
      prices: [{ id: priceId, amount_type: 'metered_unit', price_amount: 0, meter_id: meterId }],
    };
    f.wire.data.products.push(product);
    const subscription = {
      ...f.wire.data.subscriptions[0],
      id: randomUUID(),
      product_id: productId,
      prices: product.prices,
    };
    f.wire.data.subscriptions.push(subscription);
    const configuration = structuredClone(f.configuration);
    configuration.mappings.meters.push({ key: 'tokens', unit: 'tokens', funding: ['metered'] });
    configuration.polar!.meters.push({
      key: 'tokens',
      eventName: 'tokens.succeeded',
      unitsField: 'tokens',
      funding: 'metered',
      productId,
      priceId,
      meterId,
    });
    configuration.resources[0].measurements = [{ key: 'tokens', unit: 'tokens', enforceableBound: false }];
    configuration.resources[0].policy.charge = {
      type: 'usage',
      meter: 'tokens',
      measure: 'tokens',
      maxUnits: 20,
      funding: 'metered',
    };
    const initialized = await initializeBilling({ ...f.initialization, configuration });
    cleanups.push(initialized.close);
    let calls = 0;
    const gateway = new BillingGateway(f.organizations, f.accounting, initialized.provider, configuration, [
      {
        resourceId: 'assistant',
        operation: 'generate',
        measurements: [{ key: 'tokens', maxUnits: 20, enforceableBound: false }],
        execute: async () => {
          calls++;
          return {
            status: 'succeeded',
            result: {},
            measurements: [{ id: 'call', measure: 'tokens', units: 7 }],
            measurementComplete: true,
          };
        },
      },
    ]);
    const request = { resourceId: 'assistant', operation: 'generate', idempotencyKey: 'metered', input: {} };
    expect((await gateway.execute(f.owner.context, request)).billing).toMatchObject({
      billedUnits: 7,
      settlementStatus: 'settled',
    });
    expect((await f.observer.execute('SELECT COUNT(*) AS count FROM grant_allocations')).rows[0].count).toBe(0n);
    expect(
      (await f.observer.execute('SELECT SUM(consumed_units) AS consumed FROM credit_grants')).rows[0].consumed,
    ).toBe(0n);
    const event = JSON.parse(String((await f.observer.execute('SELECT payload FROM billing_outbox')).rows[0].payload));
    expect(await initialized.provider.reportUsage(event)).toMatchObject({ status: 'accepted' });
    expect([...f.wire.data.events.values()][0]).toMatchObject({ name: 'tokens.succeeded', metadata: { tokens: 7 } });
    const account = await initialized.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
    expect((await initialized.provider.getState(account)).meters.find(meter => meter.key === 'tokens')).toMatchObject({
      confirmedBalance: null,
      consumedUnits: 7,
    });
    subscription.status = 'past_due';
    await expect(
      gateway.execute(f.owner.context, { ...request, idempotencyKey: 'inactive-metered' }),
    ).rejects.toMatchObject({ code: 'forbidden' });
    expect(calls).toBe(1);
  });
  it('expired recurring periods cannot roll unused credit into their replacement', async () => {
    const f = await fixture();
    const account = await f.commercial.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
    await f.commercial.provider.getState(account);
    const oldPeriod = (await f.observer.execute("SELECT id FROM credit_grants WHERE kind = 'subscription'")).rows[0].id;
    const subscription = f.wire.data.subscriptions[0];
    subscription.current_period_end = new Date(Date.now() - 1000).toISOString();
    if (subscription.current_meter_period_start !== null)
      subscription.current_meter_period_end = subscription.current_period_end;
    expect((await f.sessions.usage(f.owner.context)).allowance).toEqual([
      { meter: 'credits', granted: 10, consumed: 0, reserved: 0, unavailable: 4, spendable: 6 },
    ]);
    subscription.current_period_start = new Date(Date.now() - 500).toISOString();
    subscription.current_period_end = new Date(Date.now() + 3600000).toISOString();
    subscription.current_meter_period_start = subscription.current_period_start;
    subscription.current_meter_period_end = subscription.current_period_end;
    for (let refresh = 0; refresh < 3; refresh++) await f.commercial.provider.getState(account);
    expect(
      (
        await f.observer.execute(
          'SELECT kind, original_units, consumed_units, available FROM credit_grants ORDER BY kind, available',
        )
      ).rows,
    ).toEqual([
      { kind: 'order', original_units: 6n, consumed_units: 0n, available: 1n },
      { kind: 'subscription', original_units: 4n, consumed_units: 0n, available: 0n },
      { kind: 'subscription', original_units: 4n, consumed_units: 0n, available: 1n },
    ]);
    await f.execute('replacement');
    expect(
      (
        await f.observer.execute({
          sql: 'SELECT consumed_units, available FROM credit_grants WHERE id = ?',
          args: [oldPeriod],
        })
      ).rows,
    ).toEqual([{ consumed_units: 0n, available: 0n }]);
    expect(
      (
        await f.observer.execute(
          'SELECT g.kind, g.id, a.committed_units FROM grant_allocations a JOIN credit_grants g ON g.id = a.grant_id',
        )
      ).rows,
    ).toEqual([{ kind: 'subscription', id: expect.not.stringMatching(String(oldPeriod)), committed_units: 3n }]);
    const renamed = structuredClone(f.configuration);
    renamed.mappings.meters[0].key = 'renamed';
    renamed.resources[0].policy.charge = { type: 'credits', meter: 'renamed', units: 3 };
    for (const allowance of renamed.catalog.allowances) {
      allowance.meter = 'renamed';
      allowance.version = 'renamed-v1';
    }
    for (const mapping of renamed.polar!.grants) mapping.allowance.version = 'renamed-v1';
    for (const offer of renamed.catalog.offers) {
      offer.version = 'renamed-v1';
      for (const allowance of offer.allowances) allowance.version = 'renamed-v1';
    }
    for (const mapping of renamed.polar!.products) mapping.version = 'renamed-v1';
    renamed.polar!.meters[0].key = 'renamed';
    const changed = await initializeBilling({ ...f.initialization, configuration: renamed });
    cleanups.push(changed.close);
    await expect(changed.provider.getState(account)).rejects.toMatchObject({ code: 'state_unavailable' });
    expect(
      (await f.observer.execute('SELECT COUNT(*) AS count, SUM(original_units) AS original FROM credit_grants')).rows,
    ).toEqual([{ count: 3n, original: 14n }]);
  });
});
