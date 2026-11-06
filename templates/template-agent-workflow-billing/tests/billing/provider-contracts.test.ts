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
  });

  it('invalid billing configuration fails before serving', async () => {
    const database = await temporaryDatabase();
    cleanups.push(database.cleanup);
    const input = configuration();
    Object.assign(input.resources[0].policy.charge, { meter: 'unmapped' });
    await expect(initializeBilling({ configuration: input, storage: { url: database.url } })).rejects.toMatchObject({
      code: 'invalid_configuration',
      retryable: false,
    });
    await expect(stat(database.filename)).rejects.toMatchObject({ code: 'ENOENT' });
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

  it('rejects changed event content and cross-account replay without another debit', async () => {
    const { billing } = await fixture();
    const account = await billing.provider.ensureAccount({ workspaceId: 'team' });
    const foreign = await billing.provider.ensureAccount({ workspaceId: 'other' });
    const event = usage(account);
    await billing.provider.reportUsage(event);
    for (const changed of [
      usage(account, { units: 4 }),
      usage(account, { executionId: 'another-execution' }),
      usage(account, { metadata: { resourceId: 'report' } }),
      usage(foreign),
    ]) {
      await expect(billing.provider.reportUsage(changed)).rejects.toMatchObject({ code: 'conflict' });
    }
    await expect(billing.provider.getState({ ...account, workspaceId: 'other' })).rejects.toMatchObject({
      code: 'conflict',
    });
    await expect(billing.provider.reconcile({ account: foreign, eventIds: [event.id] })).rejects.toMatchObject({
      code: 'conflict',
    });
    expect((await billing.provider.getState(account)).meters[0]).toMatchObject({
      confirmedBalance: 97,
      consumedUnits: 3,
    });
    expect((await billing.provider.getState(foreign)).meters).toEqual([]);
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

  it('makes local hosted sessions and webhook verification explicitly unavailable', async () => {
    const { billing } = await fixture();
    const account = await billing.provider.ensureAccount({ workspaceId: 'team' });
    expect(
      await billing.provider.createCheckout({ account, product: 'subscription', returnUrl: 'https://example.com' }),
    ).toEqual({ status: 'unsupported', reason: 'local_mode' });
    expect(await billing.provider.createPortalSession({ account, returnUrl: 'https://example.com' })).toEqual({
      status: 'unsupported',
      reason: 'local_mode',
    });
    expect(await billing.provider.verifyWebhook({ body: new Uint8Array(), headers: {} })).toEqual({
      status: 'unsupported',
      reason: 'local_mode',
    });
    expect(billing.provider.capabilities).toMatchObject({ checkout: false, portal: false, webhooks: false });
  });

  it('accepts maximum bounded workspace identifiers and rejects unsafe event input', async () => {
    const { billing } = await fixture();
    const account = await billing.provider.ensureAccount({ workspaceId: 'x'.repeat(128) });
    expect(account.workspaceId).toHaveLength(128);
    expect((await billing.provider.getState(account)).account).toEqual(account);
    for (const units of [-1, 0.5, Infinity, Number.MAX_SAFE_INTEGER + 1])
      await expect(billing.provider.reportUsage(usage(account, { units }))).rejects.toMatchObject({
        code: 'invalid_input',
      });
    await expect(
      billing.provider.reportUsage(usage(account, { metadata: { resourceId: "x'; DROP TABLE billing_accounts; --" } })),
    ).rejects.toMatchObject({ code: 'invalid_input' });
    await expect(
      billing.provider.reportUsage({ ...usage(account), metadata: { prompt: 'private prompt' } } as never),
    ).rejects.toMatchObject({ code: 'invalid_input' });
  });
});
