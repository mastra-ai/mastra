import { rawConfigurationFile } from '../support/configuration-files.js';
import { providerContractFixture } from '../support/provider-contracts.js';
import { stat } from 'node:fs/promises';
import { afterEach, describe, expect, it } from 'vitest';
import { initializeBilling } from '../../src/billing/configuration/providers.js';
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

  it('does not replace an unsupported provider with local accounts', async () => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const input = { ...configuration(), provider: 'unsupported-provider', localAccounts: [] };
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
    input.billingKeys.entitlements.push('expired', 'future');
    input.billingKeys.subscriptions.push('expired-subscription');
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

describe('local reservation provider contracts', () => {
  async function sharedFixture() {
    const value = await providerContractFixture();
    cleanups.push(value.close);
    return value;
  }

  it('settles prepaid work and replays after restart without a second debit', async () => {
    const f = await sharedFixture();
    expect(await f.execute('paid')).toMatchObject({
      result: { answer: 'done' },
      billing: { executionStatus: 'completed', billedUnits: 3 },
    });
    expect(await f.events()).toEqual([]);
    const account = await f.account();
    expect((await f.provider().getState(account)).meters[0]).toMatchObject({
      confirmedBalance: f.initialBalance - 3,
      consumedUnits: 3,
    });
    const history = await f.history();
    await f.restart();
    expect(await f.execute('paid')).toMatchObject({ billing: { replayed: true, billedUnits: 3 } });
    expect(await f.history()).toEqual(history);
    expect(f.calls()).toBe(1);
    expect(await f.execute('next')).toMatchObject({ billing: { billedUnits: 3 } });
    expect((await f.provider().getState(account)).meters[0]).toMatchObject({
      confirmedBalance: f.initialBalance - 6,
      consumedUnits: 6,
    });
    expect(await f.events()).toEqual([]);
    expect(await f.exported()).toEqual([]);
  });

  it('rejects changed usage and forged account scope after restart without changing financial or export history', async () => {
    const f = await sharedFixture();
    await f.execute('paid');
    const account = await f.account();
    const history = await f.history();
    await f.restart();
    const foreign = { ...account, workspaceId: 'foreign-workspace' };
    await expect(f.provider().getState(foreign)).rejects.toMatchObject({ code: 'conflict' });
    const row = (await f.observer.execute('SELECT payload, terminal_payload FROM billing_remote_operations')).rows[0];
    const reservation = JSON.parse(String(row.payload));
    expect(await f.provider().reservations!.reserve(JSON.stringify({ ...reservation, units: 4 }))).toMatchObject({
      status: 'uncertain',
    });
    const terminal = JSON.parse(String(row.terminal_payload));
    await expect(
      f
        .provider()
        .reservations!.finalize(
          JSON.stringify({ ...terminal, reservation: { ...terminal.reservation, account: foreign } }),
        ),
    ).rejects.toMatchObject({ code: 'conflict' });
    expect(await f.history()).toEqual(history);
    expect(await f.exported()).toEqual([]);
  });

  it('rejects unsafe usage before persisting or exporting it', async () => {
    const f = await sharedFixture();
    await f.execute('paid');
    const event = usage(await f.account());
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
    Object.assign(input.resourcePolicies[0].policy.charge, { meter: 'unmapped' });
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
    const account = await f.account();
    const returnUrl = 'https://app.example.test/billing';
    const history = await f.history();
    const checkout = await f.provider().prepareCheckout({ account, product: 'credit-pack', returnUrl });
    const portal = await f.provider().preparePortalSession({ account, returnUrl });
    expect(f.provider().capabilities).toMatchObject({ checkout: false, portal: false });
    expect(checkout).toEqual({ status: 'unsupported', reason: 'local_mode' });
    expect(portal).toEqual({ status: 'unsupported', reason: 'local_mode' });
    expect(await f.provider().createCheckout({ account, product: 'credit-pack', returnUrl })).toEqual(checkout);
    expect(await f.provider().createPortalSession({ account, returnUrl })).toEqual(portal);
    expect(await f.history()).toEqual(history);
    expect((await f.provider().getState(account)).meters[0].consumedUnits).toBe(3);
    expect((await f.observer.execute('SELECT SUM(units) AS units FROM billing_ledger')).rows).toEqual([{ units: 3n }]);
  });
});

it.each([undefined, '', '{invalid-json', 'null', '{}'])(
  'invalid Autumn environment bindings cannot initialize local billing as a fallback (%s)',
  async bindings => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const input = { ...configuration(), provider: 'autumn', localAccounts: [] };
    await expect(
      initializeBilling({
        configuration: input,
        storage: { url: database.url },
        environment: {
          BILLING_PROVIDER: 'autumn',
          AUTUMN_SECRET_KEY: 'controlled',
          AUTUMN_CONFIG_FILE: rawConfigurationFile(database.directory, bindings),
        },
      }),
    ).rejects.toMatchObject({ code: 'invalid_configuration' });
    await expect(stat(database.filename)).rejects.toMatchObject({ code: 'ENOENT' });
  },
);

it('usage cannot spend capacity already held for another execution', async () => {
  const input = configuration();
  input.localAccounts[0].meters[0].balance = 10;
  const { billing, database } = await fixture(input);
  const account = await billing.provider.ensureAccount({ workspaceId: 'team' });
  const protocol = billing.provider.reservations!;
  const now = Date.now();
  const request = {
    id: 'held-work',
    account,
    meter: 'credits',
    units: 8,
    executionCutoff: now + 60000,
    confirmationCutoff: now + 90000,
    expiresAt: now + 120000,
  };
  const payload = protocol.prepareReservation(request);
  expect(await protocol.reserve(payload)).toMatchObject({ status: 'reserved' });
  await expect(billing.provider.reportUsage(usage(account, { units: 4 }))).rejects.toMatchObject({
    code: 'insufficient_credits',
  });
  const observer = await independentClient(database.url);
  cleanups.push(() => observer.close());
  expect((await observer.execute('SELECT * FROM immutable_usage')).rows).toEqual([]);
  const event = usage(account, { units: 2 });
  expect(await billing.provider.reportUsage(event)).toMatchObject({ status: 'accepted' });
  expect(await billing.provider.reportUsage(event)).toMatchObject({ status: 'duplicate' });
  expect(
    await protocol.finalize(
      protocol.prepareFinalization({ reservation: request, action: 'confirm', units: 8 }, payload),
    ),
  ).toMatchObject({ status: 'confirmed' });
  expect((await billing.provider.getState(account)).meters[0]).toMatchObject({
    confirmedBalance: 0,
    consumedUnits: 10,
  });
});
