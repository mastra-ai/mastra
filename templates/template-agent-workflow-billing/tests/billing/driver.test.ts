import { createWeatherApplication } from '../../src/mastra/setup.js';
import { weatherConfiguration } from '../../src/weather/configuration.js';
import { observations } from '../support/template.js';
import { weatherPrompt } from '../../src/weather/observations.js';
import { Agent } from '@mastra/core/agent';
import { modelBoundary } from '../support/mastra.js';
import { billingSocket } from '../support/http.js';
import { initializeMastraBilling } from '../../src/billing/mastra-setup.js';
import { agentResource } from '../../src/billing/mastra-resources.js';
import { OrganizationService } from '../../src/billing/organizations.js';
import { RecoveryStorage } from '../../src/billing/storage/recovery.js';
import { BillingRecovery } from '../../src/billing/recovery.js';
import { createBillingApp } from '../../src/server/billing.js';
import { removeWebhookMigration } from '../support/billing.js';
import { Mastra } from '@mastra/core/mastra';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { MastraBilling } from '../../src/billing/mastra.js';
import { workflowResource } from '../../src/billing/mastra-resources.js';
import { WorkflowStorage } from '../../src/billing/storage/workflows.js';
import { createHash, createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import type { CommercialCatalog } from '../../src/billing/catalog.js';
import { temporaryDatabase, independentClient } from '../support/billing.js';
import { removeDriverMigration, restoreLegacyProviderProjection } from '../support/billing.js';
import { polarFixture } from '../support/polar.js';
import { referenceDriver } from '../support/reference-driver.js';
import { BillingGateway } from '../../src/billing/gateway.js';
import { initializeBilling } from '../../src/billing/setup.js';
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
  it('initializes an alternate external driver through the public bootstrap', async () => {
    const { f, reference, configuration } = await fixture();
    const initialized = await initializeBilling({
      configuration,
      storage: { url: f.database.url },
      drivers: [reference.driver],
    });
    cleanups.push(initialized.close);
    const account = await initialized.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
    expect((await initialized.provider.getState(account)).meters[0]).toMatchObject({ confirmedBalance: 6 });
  });

  it('rejects invalid registrations, bindings, capabilities and hosted destinations before storing driver configuration', async () => {
    const { f, reference, configuration } = await fixture();
    const before = (await f.observer.execute('SELECT * FROM billing_driver_configurations')).rows;
    const cases = [
      { configuration: { ...configuration, provider: 'unknown' }, drivers: [reference.driver] },
      { configuration, drivers: [reference.driver, reference.driver] },
      {
        configuration,
        drivers: [{ ...reference.driver, capabilities: { ...reference.driver.capabilities, prepaid: false } }],
      },
      {
        configuration,
        drivers: [
          {
            ...reference.driver,
            bindUsage: (meter: string) => ({ ...reference.driver.bindUsage(meter), provider: 'wrong' }),
          },
        ],
      },
      {
        configuration: { ...configuration, hosted: { returnUrls: [] } },
        drivers: [{ ...reference.driver, capabilities: { ...reference.driver.capabilities, checkout: true } }],
      },
      {
        configuration: { ...configuration, mappings: { ...configuration.mappings, meters: [] } },
        drivers: [reference.driver],
      },
    ];
    for (const input of cases)
      await expect(initializeBilling({ ...input, storage: { url: f.database.url } })).rejects.toMatchObject({
        code: 'invalid_configuration',
      });
    expect((await f.observer.execute('SELECT * FROM billing_driver_configurations')).rows).toEqual(before);
  });

  it('uses the registered external driver for paid Mastra HTTP work and hosted sessions with trusted identity', async () => {
    const f = await polarFixture();
    cleanups.push(f.close);
    const reference = await referenceDriver(f.configuration.catalog, { hosted: true });
    cleanups.push(reference.close);
    const model = await modelBoundary();
    cleanups.push(model.close);
    const configuration = { ...f.configuration, provider: 'reference', polar: undefined };
    const agent = new Agent({
      id: 'assistant',
      name: 'Assistant',
      instructions: 'Reply briefly.',
      model: { id: 'billing-test/model', url: model.url, apiKey: 'controlled', api: 'chat' },
      maxRetries: 0,
    });
    const agents = { assistant: agentResource(agent, { version: 'v1' }) };
    const localOrganizations = new OrganizationService(f.organizations.storage, { mode: 'local', provider: 'local' });
    expect(() => new OrganizationService(f.organizations.storage, { mode: 'local', provider: 'reference' })).toThrow();
    await expect(
      initializeMastraBilling({
        organizations: localOrganizations,
        configuration,
        agents,
        workflows: {},
        databaseUrl: f.database.url,
        drivers: [reference.driver],
      }),
    ).rejects.toMatchObject({ code: 'invalid_configuration' });
    const initialized = await initializeMastraBilling({
      organizations: f.organizations,
      configuration,
      agents,
      workflows: {},
      databaseUrl: f.database.url,
      drivers: [reference.driver],
    });
    cleanups.push(initialized.close);
    new Mastra({ agents: { assistant: agent }, storage: initialized.storage });
    expect(initialized.configuration.resources).toEqual(f.configuration.resources);
    expect(initialized.configuration.catalog).toEqual(f.configuration.catalog);
    const server = await billingSocket(
      createBillingApp(f.organizations, initialized.billing.http, initialized.commercial, initialized.recovery),
    );
    cleanups.push(server.close);
    const call = (path: string, key: string, body: unknown, credential = f.owner.credential) =>
      fetch(`${server.url}/billing/workspaces/${f.owner.workspaceId}/${path}`, {
        method: 'POST',
        headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json', 'idempotency-key': key },
        body: JSON.stringify(body),
      });
    expect((await call('agents/assistant/generate', 'paid', { prompt: 'Hello' }, 'development-key')).status).toBe(401);
    const paid = await call('agents/assistant/generate', 'paid', { prompt: 'Hello' });
    expect(paid.status).toBe(200);
    expect(await paid.json()).toMatchObject({ billing: { executionStatus: 'completed', billedUnits: 3 } });
    const replay = await call('agents/assistant/generate', 'paid', { prompt: 'Hello' });
    expect(await replay.json()).toMatchObject({ billing: { replayed: true, billedUnits: 3 } });
    expect(model.requests).toHaveLength(1);
    expect((await call('agents/assistant/generate', 'paid', { prompt: 'Changed' })).status).toBe(409);
    const body = { product: 'credit-pack', returnUrl: 'https://app.example.test/billing' };
    for (const [operation, input] of [
      ['checkout', body],
      ['portal', { returnUrl: body.returnUrl }],
    ] as const) {
      const first = await call(operation, operation, input);
      expect(first.status).toBe(200);
      const session = await first.json();
      expect(session).toMatchObject({ status: 'created', url: expect.stringContaining('/reference/') });
      expect(await (await call(operation, operation, input)).json()).toEqual(session);
    }
    expect(reference.data.hostedRequests.map(value => value.operation)).toEqual(['/checkout', '/portal']);
    expect((await call('checkout', 'checkout', { ...body, product: 'unknown' })).status).toBe(400);
    expect((await call('checkout', 'checkout', { ...body, returnUrl: 'https://foreign.example.test' })).status).toBe(
      400,
    );
    expect(reference.data.hostedRequests).toHaveLength(2);
    await initialized.recovery.runOnce();
    expect(reference.data.events.size).toBe(1);
    expect((await f.observer.execute('SELECT SUM(units) AS units FROM billing_ledger')).rows[0].units).toBe(3n);
  });

  it.each(['reference', 'polar'] as const)(
    'registers an injected %s driver at the weather application composition root',
    async provider => {
      const f = await polarFixture();
      cleanups.push(f.close);
      const reference = await referenceDriver(f.configuration.catalog);
      cleanups.push(reference.close);
      const model = await modelBoundary();
      cleanups.push(model.close);
      const driver =
        provider === 'reference'
          ? reference.driver
          : new PolarBillingDriver(
              f.configuration.polar!,
              f.configuration.catalog,
              'loopback-test-token',
              async () => ({ email: 'trusted@example.test' }),
            );
      const configuration = {
        ...f.configuration,
        provider: driver.id,
        polar: undefined,
        resources: weatherConfiguration().resources.map(resource => ({
          ...resource,
          policy: f.configuration.resources[0].policy,
        })),
      };
      const application = await createWeatherApplication(
        {
          BILLING_PROVIDER: driver.id,
          BILLING_MODE: 'production',
          BILLING_DATABASE_URL: f.database.url,
          BILLING_CONFIGURATION: JSON.stringify(configuration),
          BILLING_JWT_CONFIGURATION: JSON.stringify({
            issuer: 'https://identity.example.test',
            audience: 'billing',
            algorithms: ['EdDSA'],
            jwks: f.jwks,
          }),
          OPENAI_API_KEY: 'controlled',
          OPENAI_BASE_URL: model.url,
        },
        { drivers: [driver] },
      );
      cleanups.push(application.close);
      const server = await billingSocket(
        createBillingApp(
          application.organizations,
          application.execution,
          application.runtime.commercial,
          application.runtime.recovery,
        ),
      );
      cleanups.push(server.close);
      const response = await fetch(
        `${server.url}/billing/workspaces/${f.owner.workspaceId}/agents/weather-agent/generate`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${f.owner.credential}`,
            'content-type': 'application/json',
            'idempotency-key': 'weather-external',
          },
          body: JSON.stringify({ prompt: weatherPrompt(observations, 'summary') }),
        },
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ billing: { executionStatus: 'completed', billedUnits: 3 } });
      expect(application.runtime.configuration.provider).toBe(driver.id);
      expect(model.requests).toHaveLength(1);
      expect((await f.observer.execute('SELECT SUM(units) AS units FROM billing_ledger')).rows[0].units).toBe(3n);
    },
  );

  it('namespaces signed notifications across retained drivers and preserves pre-migration Polar duplicate detection', async () => {
    const secret = 'whsec_' + Buffer.from('a-test-only-32-byte-signing-secret').toString('base64');
    const f = await polarFixture({ webhookSecret: secret });
    cleanups.push(f.close);
    const account = await f.commercial.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
    await f.commercial.provider.getState(account);
    const oldRecords = await RecoveryStorage.open({ url: f.database.url });
    const oldWorker = new BillingRecovery(oldRecords, f.commercial.provider);
    const signed = (
      provider: 'polar' | 'reference',
      id: string,
      accountReference: string,
      seconds = Math.floor(Date.now() / 1000),
    ) => {
      const now = new Date().toISOString();
      const body = Buffer.from(
        (provider === 'polar'
          ? JSON.stringify(
              {
                api_version: '2026-10',
                type: 'customer.state_changed',
                timestamp: now,
                data: { id: accountReference, note: 'São Paulo' },
              },
              null,
              2,
            )
          : JSON.stringify({ account: accountReference, occurredAt: now }, null, 2)) + '\n',
      );
      const signature = createHmac(
        'sha256',
        provider === 'polar' ? Buffer.from(secret.replace(/^whsec_/, ''), 'base64') : 'reference-secret',
      )
        .update(`${id}.${seconds}.`)
        .update(body)
        .digest(provider === 'polar' ? 'base64' : 'hex');
      return {
        body,
        headers: {
          'webhook-id': id,
          'webhook-timestamp': String(seconds),
          'webhook-signature': provider === 'polar' ? `v1,${signature}` : signature,
          'webhook-api-version': '2026-10',
        },
      };
    };
    const original = signed('polar', 'colliding-id', f.wire.ids.customer);
    expect(await oldWorker.intake(original)).toEqual({ duplicate: false });
    await oldWorker.stop();
    oldRecords.close();
    await removeWebhookMigration(f.observer);
    await f.observer.execute('PRAGMA user_version = 11');
    const columns = 'id, digest, event_type, account_id, occurred_at, received_at, generation, status';
    const before = (await f.observer.execute(`SELECT ${columns} FROM billing_inbox`)).rows;
    const checksums = (await f.observer.execute('SELECT * FROM billing_migrations')).rows;
    const reference = await referenceDriver(f.configuration.catalog, { webhookSecret: 'reference-secret' });
    cleanups.push(reference.close);
    const polar = new PolarBillingDriver(
      f.configuration.polar!,
      f.configuration.catalog,
      'loopback-test-token',
      async () => ({ email: 'trusted@example.test' }),
      secret,
    );
    const initialized = await initializeBilling({
      storage: { url: f.database.url },
      configuration: { ...f.configuration, provider: 'reference', polar: undefined },
      drivers: [reference.driver, polar],
    });
    cleanups.push(initialized.close);
    expect((await f.observer.execute(`SELECT ${columns} FROM billing_inbox`)).rows).toEqual(before);
    expect((await f.observer.execute('SELECT * FROM billing_migrations WHERE version <= 11')).rows).toEqual(checksums);
    if (!(initialized.provider instanceof BillingService)) throw new Error('Expected application billing service');
    await initialized.provider.switchProvider({ workspaceId: f.owner.workspaceId, expectedProvider: 'polar' });
    const records = await RecoveryStorage.open({ url: f.database.url });
    cleanups.push(() => records.close());
    const worker = new BillingRecovery(records, initialized.provider);
    cleanups.push(() => worker.stop());
    const server = await billingSocket(createBillingApp(f.organizations, undefined, undefined, worker));
    cleanups.push(server.close);
    const send = (provider: string, input: ReturnType<typeof signed>, path = `/billing/webhooks/${provider}`) =>
      fetch(server.url + path, { method: 'POST', headers: input.headers, body: input.body });
    const current = signed('reference', 'colliding-id', `customer:${f.owner.workspaceId}`);
    expect((await send('polar', original)).status).toBe(202);
    expect((await send('reference', current)).status).toBe(202);
    expect((await send('reference', current)).status).toBe(202);
    const historical = signed('polar', 'old-after-switch', f.wire.ids.customer);
    expect((await send('polar', historical)).status).toBe(202);
    expect(reference.data.webhookBodies.map(body => Buffer.from(body).toString())).toEqual([
      current.body.toString(),
      current.body.toString(),
    ]);
    expect(
      (await f.observer.execute('SELECT provider, id, account_id FROM billing_inbox ORDER BY provider, id')).rows,
    ).toEqual([
      { provider: 'polar', id: 'colliding-id', account_id: account.id },
      { provider: 'polar', id: 'old-after-switch', account_id: account.id },
      { provider: 'reference', id: 'colliding-id', account_id: account.id },
    ]);
    const generation = (await f.observer.execute('SELECT generation FROM billing_account_sync')).rows[0].generation;
    // One original hint, one replacement fence and two new provider hints.
    expect(generation).toBe(4n);
    expect(
      (await send('reference', { ...current, body: Buffer.concat([current.body, Buffer.from(' ')]) })).status,
    ).toBe(401);
    expect((await send('reference', signed('reference', 'colliding-id', 'foreign-account'))).status).toBe(409);
    expect(
      (
        await send(
          'reference',
          signed('reference', 'stale-id', 'foreign-account', Math.floor(Date.now() / 1000) - 3600),
        )
      ).status,
    ).toBe(401);
    expect((await send('unknown', current)).status).toBe(501);
    for (const path of ['/billing/webhooks/reference/', '/billing/webhooks/reference/extra'])
      expect((await send('reference', current, path)).status).toBe(401);
    expect((await f.observer.execute('SELECT generation FROM billing_account_sync')).rows[0].generation).toBe(
      generation,
    );
    await worker.runOnce();
    expect((await f.observer.execute('SELECT DISTINCT status FROM billing_inbox')).rows).toEqual([{ status: 'done' }]);
    // A provider can reuse a customer reference across seller namespaces.
    // Both retained links are valid; an unqualified hint must not choose either.
    const other = await f.profile('other-seller');
    await f.observer.execute({
      sql: "INSERT INTO billing_accounts (id, workspace_id, provider, external_reference, active_provider) VALUES (?, ?, 'local', ?, 'reference')",
      args: ['other-account', other.workspaceId, `workspace:${other.workspaceId}`],
    });
    await f.observer.execute({
      sql: "INSERT INTO billing_provider_links VALUES (?, 'reference', ?, 'other-seller', ?, 'namespaced')",
      args: ['other-account', `customer:${f.owner.workspaceId}`, `workspace:${other.workspaceId}`],
    });
    expect(
      (await send('reference', signed('reference', 'ambiguous-reference', `customer:${f.owner.workspaceId}`))).status,
    ).toBe(409);
    expect((await f.observer.execute('SELECT generation FROM billing_account_sync')).rows[0].generation).toBe(
      generation,
    );
    expect(
      (await f.observer.execute("SELECT COUNT(*) AS count FROM billing_inbox WHERE id = 'ambiguous-reference'")).rows[0]
        .count,
    ).toBe(0n);
    const selected = await initialized.provider.ensureAccount({ workspaceId: f.owner.workspaceId });
    expect((await initialized.provider.getState(selected)).meters[0]).toMatchObject({
      confirmedBalance: 16,
      consumedUnits: 0,
    });
  });

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
    await restoreLegacyProviderProjection(f.observer);
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
