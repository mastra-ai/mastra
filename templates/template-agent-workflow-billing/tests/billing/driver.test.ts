import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MastraBilling } from '../../src/billing/mastra.js';
import { workflowResource } from '../../src/billing/mastra-resources.js';
import { WorkflowStorage } from '../../src/billing/storage/workflows.js';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { CommercialCatalog } from '../../src/billing/catalog.js';
import { temporaryDatabase, independentClient } from '../support/billing.js';
import { removeDriverMigration } from '../support/billing.js';
import { polarFixture } from '../support/polar.js';
import { referenceDriver } from '../support/reference-driver.js';
import { BillingGateway } from '../../src/billing/gateway.js';
import { BillingService } from '../../src/billing/service.js';
import { PolarBillingDriver } from '../../src/billing/providers/polar.js';
import { LocalBillingStorage } from '../../src/billing/storage/libsql.js';
import { AccountingStorage } from '../../src/billing/storage/accounting.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});
async function fixture(options: Parameters<typeof polarFixture>[0] = {}) {
  const f = await polarFixture(options);
  cleanups.push(f.close);
  const reference = await referenceDriver(f.configuration.catalog);
  cleanups.push(reference.close);
  const polar = new PolarBillingDriver(
    f.configuration.polar!,
    f.configuration.catalog,
    'loopback-test-token',
    async () => ({ email: 'trusted@example.test' }),
  );
  const open = async (withPolar = true, catalog = f.configuration.catalog, legacySourceKeys = false) => {
    const service = await BillingService.connect({
      url: f.database.url,
      catalog,
      activeProvider: 'reference',
      drivers: withPolar
        ? [{ ...reference.driver, legacySourceKeys }, polar]
        : [{ ...reference.driver, legacySourceKeys }],
    });
    cleanups.push(() => service.close());
    return service;
  };
  const configuration = { ...f.configuration, provider: 'reference', polar: undefined };
  const gateway = (service: BillingService, storage = f.accounting) =>
    new BillingGateway(f.organizations, storage, service, configuration, [
      {
        resourceId: 'assistant',
        operation: 'generate',
        measurements: [],
        execute: async () => ({ status: 'succeeded', result: { answer: 'reference' } }),
      },
    ]);
  const execute = (gateway: BillingGateway, key: string) =>
    gateway.execute(f.owner.context, {
      resourceId: 'assistant',
      operation: 'generate',
      idempotencyKey: key,
      input: {},
    });
  return { f, reference, open, gateway, execute, configuration };
}

describe('application-owned external billing drivers', () => {
  it('admits paid work through an externally supplied SQL-free driver and replays durable usage', async () => {
    const { f, reference, open, gateway, execute } = await fixture();
    const service = await open(false);
    const result = await execute(gateway(service), 'reference');
    expect(result).toMatchObject({
      result: { answer: 'reference' },
      billing: { executionStatus: 'completed', billedUnits: 3 },
    });
    expect((await execute(gateway(service), 'reference')).billing.replayed).toBe(true);
    const event = JSON.parse(String((await f.observer.execute('SELECT payload FROM billing_outbox')).rows[0].payload));
    expect(await service.reportUsage(event)).toMatchObject({ status: 'accepted' });
    const bytes = (await f.observer.execute('SELECT payload FROM provider_usage')).rows[0].payload;
    expect(reference.data.rawRequests).toEqual([bytes]);
    service.close();
    const reopened = await open(false);
    expect(await reopened.reportUsage(event)).toMatchObject({ status: 'duplicate' });
    const account = await reopened.ensureAccount({ workspaceId: f.owner.workspaceId });
    expect((await reopened.getState(account)).meters[0]).toMatchObject({ confirmedBalance: 3, consumedUnits: 3 });
    expect((await f.observer.execute('SELECT SUM(units) AS units FROM billing_ledger')).rows[0].units).toBe(3n);
  });

  it('retains old purchases, paid access, pending bytes and admitted reservations across explicit replacement and reopen', async () => {
    const { f, reference, open, gateway, execute, configuration } = await fixture();
    await f.execute('old-completed');
    const oldAccount = await f.commercial.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
    const schema = z.object({ count: z.number().int() });
    const approval = createStep({
      id: 'approval',
      inputSchema: schema,
      outputSchema: schema,
      resumeSchema: z.object({ approved: z.boolean() }),
      suspendSchema: z.object({ reason: z.string() }),
      execute: async ({ inputData, resumeData, suspend }) =>
        resumeData?.approved ? { count: inputData.count + 1 } : suspend({ reason: 'Approval required' }),
    });
    const workflow = createWorkflow({
      id: 'report',
      inputSchema: schema,
      outputSchema: schema,
      options: { autoRestartActiveRuns: false },
    })
      .then(approval)
      .commit();
    const workflowStorage = await WorkflowStorage.open({ url: f.database.url }, f.organizations.storage);
    cleanups.push(() => workflowStorage.close());
    const snapshots = new LibSQLStore({
      id: 'driver-switch-workflow',
      url: pathToFileURL(join(f.database.directory, 'workflow.db')).href,
    });
    await snapshots.init();
    cleanups.push(() => snapshots.close());
    new Mastra({ workflows: { report: workflow }, storage: snapshots });
    const resource = {
      id: 'report',
      kind: 'workflow',
      operations: ['start', 'resume', 'cancel'],
      policy: {
        version: 'workflow-v1',
        access: { entitlement: 'access', subscription: 'subscription' },
        charge: { type: 'credits', meter: 'credits', units: 3 },
      },
    };
    const oldConfiguration = { ...f.configuration, resources: [resource] };
    const workflows = { report: workflowResource(workflow, { version: 'driver-workflow-v1' }) };
    const oldBilling = new MastraBilling({
      organizations: f.organizations,
      accounting: f.accounting,
      workflowStorage,
      provider: f.commercial.provider,
      configuration: oldConfiguration,
      agents: {},
      workflows,
    });
    const run = await oldBilling
      .workflow('report')
      .createRun({ billing: f.owner.context, idempotencyKey: 'old-create' });
    const held = await run.start({ billing: f.owner.context, idempotencyKey: 'old-start', inputData: { count: 0 } });
    expect(held.kind === 'immediate' && held.projection.status).toBe('suspended');
    expect(held.billing).toMatchObject({ executionStatus: 'running', settlementStatus: 'reserved' });
    const event = JSON.parse(String((await f.observer.execute('SELECT payload FROM billing_outbox')).rows[0].payload));
    f.wire.data.lostUsage = true;
    expect(await f.commercial.provider.reportUsage(event)).toMatchObject({ status: 'uncertain' });
    const tables = [
      'credit_grants',
      'billing_ledger',
      'billing_outbox',
      'billing_usage_bindings',
      'grant_allocations',
      'provider_usage',
      'provider_links',
    ];
    const history = () =>
      Promise.all(tables.map(async table => (await f.observer.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows));
    const before = await history();
    const checksums = (await f.observer.execute('SELECT * FROM billing_migrations WHERE version <= 10')).rows;
    reference.data.sources = false;
    reference.data.access = false;
    // Reconstruct the actually shipped v10 boundary with a suspended execution,
    // consumed purchases and an uncertain export. Migration must recover the
    // admission association before replacement can change the current provider.
    await removeDriverMigration(f.observer);
    await f.observer.execute('PRAGMA user_version = 10');
    const service = await open();
    await expect(service.ensureAccount({ workspaceId: f.owner.workspaceId })).rejects.toMatchObject({
      code: 'conflict',
    });
    const selected = await service.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'polar' });
    expect(selected).toEqual({ ...oldAccount, provider: 'reference' });
    expect(await history()).toEqual(before);
    service.close();
    const reopened = await open();
    const current = await reopened.ensureAccount({ workspaceId: f.owner.workspaceId });
    const state = await reopened.getState(current);
    expect(state.meters[0]).toMatchObject({ confirmedBalance: 7, consumedUnits: 3 });
    expect(state.entitlements.map(value => value.key)).toContain('access');
    expect(state.subscriptions.map(value => value.key)).toContain('subscription');
    expect(await history()).toEqual(before);
    expect(configuration.resources).toEqual(f.configuration.resources);
    expect(configuration.catalog).toEqual(f.configuration.catalog);
    const withoutOld = await open(false);
    await expect(withoutOld.getState(current)).rejects.toMatchObject({ code: 'state_unavailable' });
    f.wire.data.unavailable = true;
    await expect(execute(gateway(reopened), 'unavailable-history')).rejects.toMatchObject({
      code: 'state_unavailable',
    });
    f.wire.data.unavailable = false;
    expect(await history()).toEqual(before);
    const accounting = await AccountingStorage.open({ url: f.database.url }, f.organizations.storage);
    cleanups.push(() => accounting.close());
    const restartedBilling = new MastraBilling({
      organizations: f.organizations,
      accounting,
      workflowStorage,
      provider: reopened,
      configuration: { ...oldConfiguration, provider: 'reference', polar: undefined },
      agents: {},
      workflows,
    });
    const resumed = await restartedBilling
      .workflow('report')
      .getRun({ billing: f.owner.context, executionId: run.executionId });
    const finished = await resumed.resume({
      billing: f.owner.context,
      idempotencyKey: 'new-resume',
      step: 'approval',
      resumeData: { approved: true },
    });
    expect(finished.billing!).toMatchObject({ executionStatus: 'completed', billedUnits: 3 });
    const events = (await f.observer.execute('SELECT payload FROM billing_outbox ORDER BY rowid')).rows.map(row =>
      JSON.parse(String(row.payload)),
    );
    expect(events.every(value => JSON.stringify(value.account) === JSON.stringify(oldAccount))).toBe(true);
    expect(await reopened.reportUsage(events[0])).toMatchObject({ status: 'duplicate' });
    expect(await reopened.reportUsage(events[1])).toMatchObject({ status: 'accepted' });
    expect(reference.data.rawRequests).toEqual([]);
    const originalBytes = before[5][0].payload;
    expect((await f.observer.execute('SELECT payload FROM provider_usage ORDER BY rowid')).rows[0].payload).toBe(
      originalBytes,
    );
    const oldRequests = f.wire.data.requests.filter(value => value.path === '/v1/events/ingest');
    expect(oldRequests[0].body).toEqual(oldRequests[1].body);
    const paid = await execute(gateway(reopened, accounting), 'new-provider-old-credit');
    expect(paid.billing.billedUnits).toBe(3);
    const newEvent = JSON.parse(
      String(
        (await f.observer.execute('SELECT payload FROM billing_outbox ORDER BY rowid DESC LIMIT 1')).rows[0].payload,
      ),
    );
    expect(newEvent.account.provider).toBe('reference');
    expect(await reopened.reportUsage(newEvent)).toMatchObject({ status: 'accepted' });
    expect(reference.data.events.size).toBe(1);
    expect(
      (
        await f.observer.execute(
          'SELECT COUNT(*) AS count, SUM(original_units) AS original, SUM(consumed_units) AS consumed FROM credit_grants',
        )
      ).rows[0],
    ).toEqual({ count: 2n, original: 10n, consumed: 9n });
    expect((await f.observer.execute('SELECT * FROM billing_migrations WHERE version <= 10')).rows).toEqual(checksums);
  });

  it('isolates provider source identities and rejects changed terms and wrong-account observations atomically', async () => {
    const { f, reference, open, gateway, execute } = await fixture();
    await f.execute('polar-first');
    const oldSource = (await f.observer.execute('SELECT source_key FROM credit_grants ORDER BY rowid LIMIT 1')).rows[0]
      .source_key;
    reference.data.sourceKey = String(oldSource);
    const service = await open();
    const account = await service.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'polar' });
    await service.getState(account);
    expect((await f.observer.execute('SELECT COUNT(*) AS count FROM credit_grants')).rows[0].count).toBe(3n);
    const namespaced = createHash('sha256')
      .update(JSON.stringify(['reference', oldSource]))
      .digest('hex');
    expect(
      (
        await f.observer.execute({
          sql: 'SELECT provider FROM billing_source_owners WHERE source_key = ?',
          args: [namespaced],
        })
      ).rows,
    ).toEqual([{ provider: 'reference' }]);
    const before = (await f.observer.execute('SELECT * FROM credit_grants ORDER BY rowid')).rows;
    for (const mutation of ['units', 'account', 'collision'] as const) {
      reference.data.units = mutation === 'units' ? 1000 : 6;
      reference.data.wrongAccount = mutation === 'account';
      const selected = mutation === 'collision' ? await open(true, f.configuration.catalog, true) : service;
      await expect(execute(gateway(selected), mutation)).rejects.toMatchObject({ code: 'state_unavailable' });
      expect((await f.observer.execute('SELECT * FROM credit_grants ORDER BY rowid')).rows).toEqual(before);
    }
  });

  it('reverifies historical allowance revisions after a newer checkout catalog replaces current offers', async () => {
    const { f, reference, open } = await fixture();
    await f.execute('old-catalog');
    const before = (await f.observer.execute('SELECT * FROM credit_grants ORDER BY rowid')).rows;
    const catalog = structuredClone(f.configuration.catalog);
    catalog.allowances = catalog.allowances.map(value => ({ ...value, version: 'v2' }));
    catalog.offers = catalog.offers.map(value => ({
      ...value,
      version: 'v2',
      allowances: value.allowances.map(reference => ({ ...reference, version: 'v2' })),
    }));
    reference.data.sources = false;
    const service = await open(true, catalog);
    const account = await service.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'polar' });
    expect((await service.getState(account)).meters[0]).toMatchObject({ confirmedBalance: 7, consumedUnits: 3 });
    expect((await f.observer.execute('SELECT * FROM credit_grants ORDER BY rowid')).rows).toEqual(before);
    expect(
      (await f.observer.execute("SELECT COUNT(*) AS count FROM billing_catalog WHERE kind = 'allowance'")).rows[0]
        .count,
    ).toBe(4n);
  });

  it('never promotes local seed balance into a paid provider account', async () => {
    const { f, open } = await fixture();
    const local = await LocalBillingStorage.open({ url: f.database.url });
    cleanups.push(() => local.close());
    const account = await local.ensureAccount(
      { workspaceId: f.owner.workspaceId },
      {
        workspaceId: f.owner.workspaceId,
        entitlements: [],
        subscriptions: [],
        meters: [{ key: 'credits', funding: 'prepaid', balance: 99, periodStart: null, periodEnd: null }],
      },
    );
    const service = await open();
    await expect(
      service.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'local' }),
    ).rejects.toMatchObject({ code: 'conflict' });
    await expect(service.ensureAccount({ workspaceId: f.owner.workspaceId })).rejects.toMatchObject({
      code: 'conflict',
    });
    expect((await local.getState(account)).meters[0].confirmedBalance).toBe(99);
    expect((await f.observer.execute('SELECT COUNT(*) AS count FROM credit_grants')).rows[0].count).toBe(0n);
  });
});

describe('immutable external source terms', () => {
  it.each(['purchase start', 'longer expiry', 'allowance version', 'units', 'meter', 'kind'] as const)(
    'rejects changed %s under unchanged source identity and provenance',
    async mutation => {
      const database = await temporaryDatabase();
      cleanups.push(database.cleanup);
      const start = new Date(Date.now() - 1800000).toISOString();
      const allowance = {
        key: 'purchase',
        version: 'v1',
        meter: 'credits',
        kind: 'order' as const,
        units: 6,
        expiry: { type: 'duration' as const, milliseconds: 3600000 },
      };
      const catalog: CommercialCatalog = {
        allowances: [
          allowance,
          { ...allowance, version: 'v2', expiry: { type: 'duration', milliseconds: 7200000 } },
          { ...allowance, version: 'v3' },
          { ...allowance, key: 'larger', units: 12 },
          { ...allowance, key: 'other-meter', meter: 'tasks' },
          { ...allowance, key: 'recurring', kind: 'subscription', expiry: { type: 'period' } },
        ],
        offers: [],
      };
      const reference = await referenceDriver(catalog, { validFrom: start });
      cleanups.push(reference.close);
      const service = await BillingService.connect({
        url: database.url,
        catalog,
        activeProvider: 'reference',
        drivers: [reference.driver],
      });
      cleanups.push(() => service.close());
      const client = await independentClient(database.url);
      cleanups.push(() => client.close());
      const account = await service.ensureAccount({ workspaceId: 'team' });
      expect((await service.getState(account)).meters[0].confirmedBalance).toBe(6);
      const before = (await client.execute('SELECT * FROM credit_grants')).rows;
      const stateBefore = (await client.execute('SELECT * FROM commercial_state')).rows;
      if (mutation === 'purchase start') {
        reference.data.sourceOverrides.validFrom = new Date(Date.now() - 1000).toISOString();
        reference.data.sourceOverrides.validUntil = new Date(
          Date.parse(reference.data.sourceOverrides.validFrom) + 3600000,
        ).toISOString();
      } else if (mutation === 'longer expiry') {
        reference.data.allowance.version = 'v2';
        reference.data.sourceOverrides.validUntil = new Date(Date.parse(start) + 7200000).toISOString();
      } else if (mutation === 'allowance version') reference.data.allowance.version = 'v3';
      else if (mutation === 'units') {
        reference.data.allowance.key = 'larger';
        reference.data.sourceOverrides.units = 12;
      } else if (mutation === 'meter') {
        reference.data.allowance.key = 'other-meter';
        reference.data.sourceOverrides.meter = 'tasks';
      } else {
        reference.data.allowance.key = 'recurring';
        reference.data.sourceOverrides.kind = 'subscription';
      }
      await expect(service.getState(account)).rejects.toMatchObject({ code: 'state_unavailable' });
      expect((await client.execute('SELECT * FROM credit_grants')).rows).toEqual(before);
      expect((await client.execute('SELECT * FROM commercial_state')).rows).toEqual(stateBefore);
    },
  );

  it('accepts a freshly verified subscription end refresh without changing original period terms or consumption', async () => {
    const f = await polarFixture();
    cleanups.push(f.close);
    await f.execute('consume-period');
    const account = await f.commercial.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
    const before = (await f.observer.execute("SELECT * FROM credit_grants WHERE kind = 'subscription'")).rows[0];
    const end = new Date(Date.parse(f.wire.data.subscriptions[0].current_period_end) + 3600000).toISOString();
    f.wire.data.subscriptions[0].current_period_end = end;
    expect((await f.commercial.provider.getState(account)).meters[0]).toMatchObject({
      confirmedBalance: 7,
      consumedUnits: 3,
    });
    expect((await f.observer.execute("SELECT * FROM credit_grants WHERE kind = 'subscription'")).rows).toEqual([
      { ...before, valid_until: end },
    ]);
    expect((await f.observer.execute('SELECT COUNT(*) AS count FROM credit_grants')).rows[0].count).toBe(2n);
  });
});
