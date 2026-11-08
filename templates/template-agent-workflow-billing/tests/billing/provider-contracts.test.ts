import { contractProviders, providerContractFixture } from '../support/provider-contracts.js';
import { stat } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeBilling } from '../../src/billing/setup.js';
import { configuration, independentClient, temporaryDatabase, usage } from '../support/billing.js';

const cleanups: (() => void | Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function fixture(input = configuration()) {
  const database = await temporaryDatabase();
  cleanups.push(database.cleanup);
  const billing = await initializeBilling({ configuration: input, storage: { url: database.url } });
  cleanups.push(billing.close);
  return { database, billing };
}

describe('local provider contracts', () => {
  it('local provider persists usage and deduplicates replay after restart', async () => {
    const { database, billing } = await fixture();
    const account = await billing.provider.ensureAccount({ workspaceId: 'team' });
    const event = usage(account);
    expect(await billing.provider.reportUsage(event)).toEqual({ status: 'accepted', eventId: event.id });
    billing.close();

    const changedSeed = configuration();
    changedSeed.localAccounts[0].meters[0].balance = 999;
    const reopened = await initializeBilling({ configuration: changedSeed, storage: { url: database.url } });
    cleanups.push(reopened.close);
    expect(await reopened.provider.ensureAccount({ workspaceId: 'team' })).toEqual(account);
    expect(await reopened.provider.reportUsage(event)).toEqual({ status: 'duplicate', eventId: event.id });
    const state = await reopened.provider.getState(account);
    expect(state.meters.find(meter => meter.key === 'credits')).toMatchObject({
      confirmedBalance: 97,
      consumedUnits: 3,
    });
    expect(state.evidence).toEqual({ version: '1' });
    expect(state.entitlements).toEqual(changedSeed.localAccounts[0].entitlements);
    expect(state.subscriptions).toEqual(changedSeed.localAccounts[0].subscriptions);
    const reconciliation = await reopened.provider.reconcile({ account, eventIds: [event.id, 'not-reported'] });
    expect(reconciliation).toMatchObject({
      status: 'confirmed',
      reflectedEventIds: [event.id],
      snapshot: { evidence: { version: '1' } },
    });
    const observer = await independentClient(database.url);
    cleanups.push(() => observer.close());
    expect((await observer.execute('SELECT id, units FROM immutable_usage')).rows).toEqual([
      { id: event.id, units: 3n },
    ]);
    expect((await observer.execute('SELECT COUNT(*) AS count FROM billing_accounts')).rows[0].count).toBe(1n);
    const foreign = await reopened.provider.ensureAccount({ workspaceId: 'other' });
    await expect(reopened.provider.reportUsage({ ...event, account: foreign })).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(reopened.provider.reconcile({ account: foreign, eventIds: [event.id] })).rejects.toMatchObject({
      code: 'conflict',
    });
    expect((await reopened.provider.getState(foreign)).meters).toEqual([]);
  });

  it('does not replace unsupported Polar mode with local accounts', async () => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const input = { ...configuration(), provider: 'polar', localAccounts: [] };
    await expect(initializeBilling({ configuration: input, storage: { url: database.url } })).rejects.toMatchObject({
      code: 'unsupported',
    });
    await expect(stat(database.filename)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('records metered consumption without creating or requiring prepaid credit', async () => {
    const { billing, database } = await fixture();
    const account = await billing.provider.ensureAccount({ workspaceId: 'team' });
    const event = usage(account, { meter: 'tokens', units: 200 });
    await billing.provider.reportUsage(event);
    billing.close();
    const reopened = await initializeBilling({ configuration: configuration(), storage: { url: database.url } });
    cleanups.push(reopened.close);
    expect((await reopened.provider.getState(account)).meters.find(meter => meter.key === 'tokens')).toMatchObject({
      funding: 'metered',
      confirmedBalance: null,
      consumedUnits: 200,
    });
    expect(await reopened.provider.reportUsage(event)).toEqual({ status: 'duplicate', eventId: event.id });
    await expect(
      reopened.provider.reportUsage(usage(account, { id: 'too-expensive', units: 101 })),
    ).rejects.toMatchObject({ code: 'insufficient_credits' });
    expect((await reopened.provider.getState(account)).meters[0].confirmedBalance).toBe(100);
    const bounded = await reopened.provider.ensureAccount({ workspaceId: 'x'.repeat(128) });
    expect(bounded.workspaceId).toHaveLength(128);
    expect((await reopened.provider.getState(bounded)).account).toEqual(bounded);
  });

  it('preserves grant validity and excludes expired or future commercial eligibility', async () => {
    const input = configuration();
    input.mappings.entitlements.push('expired', 'future');
    input.mappings.subscriptions.push('expired-subscription');
    input.localAccounts[0].entitlements.push(
      { key: 'expired', validFrom: '2000-01-01T00:00:00Z', validUntil: '2001-01-01T00:00:00Z' },
      { key: 'future', validFrom: '2098-01-01T00:00:00Z', validUntil: null },
    );
    input.localAccounts[0].subscriptions.push({
      key: 'expired-subscription',
      validFrom: '2000-01-01T00:00:00Z',
      validUntil: '2001-01-01T00:00:00Z',
    });
    const { billing, database } = await fixture(input);
    const account = await billing.provider.ensureAccount({ workspaceId: 'team' });
    billing.close();
    const reopened = await initializeBilling({ configuration: input, storage: { url: database.url } });
    cleanups.push(reopened.close);
    expect((await reopened.provider.getState(account)).entitlements.map(grant => grant.key)).toEqual(['access']);
    expect((await reopened.provider.getState(account)).subscriptions.map(grant => grant.key)).toEqual(['subscription']);
    const observer = await independentClient(database.url);
    cleanups.push(() => observer.close());
    expect(
      (
        await observer.execute(
          "SELECT valid_from, valid_until FROM commercial_grants WHERE key = 'expired-subscription'",
        )
      ).rows,
    ).toEqual([{ valid_from: '2000-01-01T00:00:00Z', valid_until: '2001-01-01T00:00:00Z' }]);
  });

  it('makes local webhook verification explicitly unavailable', async () => {
    const { billing } = await fixture();
    expect(await billing.provider.verifyWebhook({ body: new Uint8Array(), headers: {} })).toEqual({
      status: 'unsupported',
      reason: 'local_mode',
    });
    expect(billing.provider.capabilities.webhooks).toBe(false);
  });
});

describe.each(contractProviders)('%s shared provider contracts', provider => {
  async function sharedFixture() {
    const value = await providerContractFixture(provider);
    cleanups.push(value.close);
    return value;
  }

  it('settles paid work, exports exact usage and replays after restart without a second debit', async () => {
    const f = await sharedFixture();
    expect(await f.execute('paid')).toMatchObject({
      result: { answer: 'done' },
      billing: { executionStatus: 'completed', billedUnits: 3 },
    });
    const [event] = await f.events();
    expect(await f.provider().reportUsage(event)).toEqual({ status: 'accepted', eventId: event.id });
    const history = await f.history();
    await f.restart();
    expect(await f.execute('paid')).toMatchObject({ billing: { replayed: true, billedUnits: 3 } });
    expect(f.calls()).toBe(1);
    expect(await f.provider().reportUsage(event)).toEqual({ status: 'duplicate', eventId: event.id });
    expect(await f.history()).toEqual(history);
    expect((await f.provider().getState(event.account)).meters[0]).toMatchObject({
      confirmedBalance: f.initialBalance - 3,
      consumedUnits: 3,
    });

    // A second admission after reflection catches double subtraction of the
    // local reflected event while external drivers use the application ledger.
    expect(await f.execute('next')).toMatchObject({ billing: { billedUnits: 3, executionStatus: 'completed' } });
    const events = await f.events();
    expect(events).toHaveLength(2);
    expect(await f.provider().reportUsage(events[1])).toEqual({ status: 'accepted', eventId: events[1].id });
    await f.restart();
    expect((await f.provider().getState(event.account)).meters[0]).toMatchObject({
      confirmedBalance: f.initialBalance - 6,
      consumedUnits: 6,
    });
    const delivery = await f.deliveryPayloads();
    expect(delivery.sent).toEqual(delivery.retained);
    expect(await f.exported()).toEqual(
      events.map(value => ({ id: value.id, units: 3, account: value.account.externalReference })),
    );
    expect(
      (await f.observer.execute('SELECT COUNT(*) AS count, SUM(units) AS units FROM billing_ledger')).rows,
    ).toEqual([{ count: 2n, units: 6n }]);
    expect(f.calls()).toBe(2);
  });

  it('rejects changed usage and forged account scope after restart without changing financial or export history', async () => {
    const f = await sharedFixture();
    await f.execute('paid');
    const [event] = await f.events();
    await f.provider().reportUsage(event);
    await f.restart();
    const history = await f.history();
    const exported = await f.exported();
    const foreign = { ...event.account, workspaceId: 'foreign-workspace' };
    for (const changed of [
      { ...event, units: 4 },
      { ...event, executionId: 'another-execution' },
      { ...event, metadata: { resourceId: 'report' } },
      { ...event, account: foreign },
    ])
      await expect(f.provider().reportUsage(changed)).rejects.toMatchObject({ code: 'conflict' });
    await expect(f.provider().getState(foreign)).rejects.toMatchObject({
      code: provider === 'local' ? 'conflict' : 'state_unavailable',
    });
    expect(await f.history()).toEqual(history);
    expect(await f.exported()).toEqual(exported);
    expect((await f.provider().getState(event.account)).meters[0]).toMatchObject({
      confirmedBalance: f.initialBalance - 3,
      consumedUnits: 3,
    });
  });

  it('rejects unsafe usage before persisting or exporting it', async () => {
    const f = await sharedFixture();
    await f.execute('paid');
    const [event] = await f.events();
    const history = await f.history();
    for (const units of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
      await expect(f.provider().reportUsage({ ...event, units })).rejects.toMatchObject({ code: 'invalid_input' });
    for (const metadata of [{ resourceId: "x'; DROP TABLE billing_accounts; --" }, { prompt: 'private prompt' }])
      await expect(f.provider().reportUsage({ ...event, metadata } as never)).rejects.toMatchObject({
        code: 'invalid_input',
      });
    expect(await f.history()).toEqual(history);
    expect(await f.exported()).toEqual([]);
    expect(await f.provider().reportUsage(event)).toEqual({ status: 'accepted', eventId: event.id });
  });

  it('rejects unmapped paid policies before creating a database', async () => {
    const f = await sharedFixture();
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const input = structuredClone(f.configuration);
    Object.assign(input.resources[0].policy.charge, { meter: 'unmapped' });
    await expect(f.initialize(input, database.url)).rejects.toMatchObject({
      code: 'invalid_configuration',
      retryable: false,
    });
    await expect(stat(database.filename)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(await f.exported()).toEqual([]);
  });

  it('honors hosted capabilities and keeps preparation free of external session side effects', async () => {
    const f = await sharedFixture();
    await f.execute('paid');
    const [event] = await f.events();
    const account = event.account;
    const returnUrl = 'https://app.example.test/billing';
    const history = await f.history();
    const checkout = await f.provider().prepareCheckout({ account, product: 'credit-pack', returnUrl });
    const portal = await f.provider().preparePortalSession({ account, returnUrl });
    expect(f.hostedRequests()).toEqual([]);
    expect(f.provider().capabilities).toMatchObject({ checkout: provider !== 'local', portal: provider !== 'local' });
    if (provider === 'local') {
      expect(checkout).toEqual({ status: 'unsupported', reason: 'local_mode' });
      expect(portal).toEqual({ status: 'unsupported', reason: 'local_mode' });
      expect(await f.provider().createCheckout({ account, product: 'credit-pack', returnUrl })).toEqual(checkout);
      expect(await f.provider().createPortalSession({ account, returnUrl })).toEqual(portal);
    } else {
      expect(checkout.status).toBe('prepared');
      expect(portal.status).toBe('prepared');
      if (checkout.status !== 'prepared' || portal.status !== 'prepared')
        throw new Error('Expected hosted preparation');
      expect(await checkout.dispatch()).toMatchObject({ status: 'created', url: expect.stringMatching(/^https:\/\//) });
      expect(await portal.dispatch()).toMatchObject({ status: 'created', url: expect.stringMatching(/^https:\/\//) });
      const requests = f.hostedRequests();
      expect(requests).toHaveLength(2);
      if (provider === 'polar') {
        const customer = (
          await f.observer.execute({
            sql: 'SELECT customer_id FROM billing_provider_links WHERE account_id = ? AND provider = ?',
            args: [account.id, provider],
          })
        ).rows[0].customer_id;
        expect(requests.map(value => value.body)).toEqual([
          {
            products: [f.configuration.polar!.products[0].productId],
            customer_id: customer,
            return_url: returnUrl,
            success_url: returnUrl,
          },
          { customer_id: customer, return_url: returnUrl },
        ]);
      } else {
        expect(requests.map(value => value.body)).toEqual([
          { account, product: 'credit-pack', returnUrl },
          { account, returnUrl },
        ]);
      }
    }
    expect(await f.history()).toEqual(history);
    expect((await f.provider().getState(account)).meters[0].consumedUnits).toBe(provider === 'local' ? 0 : 3);
    expect((await f.observer.execute('SELECT SUM(units) AS units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
  });
});
