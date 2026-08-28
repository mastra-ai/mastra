/**
 * Model-credentials domain over a real backend (libsql `:memory:`): tenancy
 * isolation, user > org resolution precedence, refresh serialization (the
 * cross-backend stand-in for the pg FOR UPDATE re-check), and login-session
 * TTL cleanup on read.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { FactorySecretEncryption } from '../../../secret-encryption.js';
import { ModelCredentialsStorage } from './base.js';

const oauth = (tag: string, expires: number) => ({
  type: 'oauth' as const,
  access: `at-${tag}`,
  refresh: `rt-${tag}`,
  expires,
});

async function makeStore(encryption?: FactorySecretEncryption): Promise<ModelCredentialsStorage> {
  const backend = new LibSQLFactoryStorage({ id: 'credentials-test', url: ':memory:' });
  const domain = backend.registerDomain(new ModelCredentialsStorage(encryption));
  await backend.init();
  onTestFinished(() => backend.close());
  return domain;
}

describe('ModelCredentialsStorage', () => {
  it('isolates user rows per user and per org', async () => {
    const store = await makeStore();
    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'anthropic', oauth('a', Date.now() + 60_000));

    expect(await store.getCredential({ orgId: 'org1', userId: 'alice' }, 'anthropic')).toMatchObject({
      access: 'at-a',
    });
    expect(await store.getCredential({ orgId: 'org1', userId: 'bob' }, 'anthropic')).toBeUndefined();
    expect(await store.getCredential({ orgId: 'org2', userId: 'alice' }, 'anthropic')).toBeUndefined();
    expect(await store.resolveCredential('org1', 'bob', 'anthropic')).toBeUndefined();
  });

  it('stores org-scoped OAuth credentials (org-wide sign-in)', async () => {
    const store = await makeStore();

    await store.setCredential({ orgId: 'org1' }, 'anthropic', oauth('org', Date.now() + 60_000));
    expect(await store.getCredential({ orgId: 'org1' }, 'anthropic')).toMatchObject({ type: 'oauth' });
    // Visible to every org member through resolution.
    expect(await store.resolveCredential('org1', 'alice', 'anthropic')).toMatchObject({ scope: 'org' });
  });

  it('resolves user > org and lists both scopes for a member', async () => {
    const store = await makeStore();
    await store.setCredential({ orgId: 'org1' }, 'openai', { type: 'api_key', key: 'sk-org' });
    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'openai', { type: 'api_key', key: 'sk-alice' });

    expect(await store.resolveCredential('org1', 'alice', 'openai')).toMatchObject({
      scope: 'user',
      credential: { key: 'sk-alice' },
    });
    // Bob has no personal row — inherits the org key.
    expect(await store.resolveCredential('org1', 'bob', 'openai')).toMatchObject({
      scope: 'org',
      credential: { key: 'sk-org' },
    });

    const aliceList = await store.listCredentials('org1', 'alice');
    expect(aliceList.map(r => r.scope).sort()).toEqual(['org', 'user']);
    const bobList = await store.listCredentials('org1', 'bob');
    expect(bobList).toHaveLength(1);
    expect(bobList[0]!.scope).toBe('org');
  });

  it("resolves org > user when precedence is 'org' (factory runs)", async () => {
    const store = await makeStore();
    await store.setCredential({ orgId: 'org1' }, 'openai', { type: 'api_key', key: 'sk-org' });
    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'openai', { type: 'api_key', key: 'sk-alice' });
    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'google', { type: 'api_key', key: 'sk-alice-g' });

    expect(await store.resolveCredential('org1', 'alice', 'openai', 'org')).toMatchObject({
      scope: 'org',
      credential: { key: 'sk-org' },
    });
    // No org row — falls back to the user's personal key.
    expect(await store.resolveCredential('org1', 'alice', 'google', 'org')).toMatchObject({
      scope: 'user',
      credential: { key: 'sk-alice-g' },
    });
  });

  it('removes only the addressed scope', async () => {
    const store = await makeStore();
    await store.setCredential({ orgId: 'org1' }, 'openai', { type: 'api_key', key: 'sk-org' });
    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'openai', { type: 'api_key', key: 'sk-alice' });

    expect(await store.removeCredential({ orgId: 'org1', userId: 'alice' }, 'openai')).toBe(true);
    expect(await store.resolveCredential('org1', 'alice', 'openai')).toMatchObject({ scope: 'org' });
    expect(await store.removeCredential({ orgId: 'org1', userId: 'alice' }, 'openai')).toBe(false);
  });

  it('refreshOAuth returns undefined without an OAuth row', async () => {
    const store = await makeStore();
    expect(await store.refreshOAuth({ orgId: 'org1', userId: 'alice' }, 'anthropic', async c => c)).toBeUndefined();

    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'openai', { type: 'api_key', key: 'sk' });
    expect(await store.refreshOAuth({ orgId: 'org1', userId: 'alice' }, 'openai', async c => c)).toBeUndefined();
  });

  it('serializes concurrent refreshes: the loser sees the winner result and skips its own refresh', async () => {
    const store = await makeStore();
    const tenant = { orgId: 'org1', userId: 'alice' };
    await store.setCredential(tenant, 'anthropic', oauth('old', Date.now() - 1000));

    let refreshes = 0;
    const refreshFn = vi.fn(async () => {
      refreshes += 1;
      return oauth(`new-${refreshes}`, Date.now() + 60_000);
    });

    const [first, second] = await Promise.all([
      store.refreshOAuth(tenant, 'anthropic', refreshFn),
      store.refreshOAuth(tenant, 'anthropic', refreshFn),
    ]);

    // Only one upstream refresh; the second call re-checked expiry after the
    // first completed and returned the already-fresh credential.
    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ access: 'at-new-1' });
    expect(second).toMatchObject({ access: 'at-new-1' });
    expect(await store.getCredential(tenant, 'anthropic')).toMatchObject({ access: 'at-new-1' });
  });

  it('expires login sessions on read and honors touch updates', async () => {
    const store = await makeStore();
    await store.createLoginSession({
      sessionId: 's-1',
      orgId: 'org1',
      userId: 'alice',
      provider: 'openai',
      kind: 'device-code',
      pending: { deviceAuthId: 'd-1' },
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(await store.getLoginSession('s-1')).toMatchObject({ pending: { deviceAuthId: 'd-1' }, nextPollAt: null });

    const nextPollAt = new Date(Date.now() + 5_000);
    await store.touchLoginSession('s-1', { nextPollAt, pending: { deviceAuthId: 'd-1', polls: 1 } });
    expect(await store.getLoginSession('s-1')).toMatchObject({ nextPollAt, pending: { polls: 1 } });

    await store.createLoginSession({
      sessionId: 's-expired',
      orgId: 'org1',
      userId: 'alice',
      provider: 'openai',
      kind: 'device-code',
      pending: {},
      expiresAt: new Date(Date.now() - 1),
    });
    expect(await store.getLoginSession('s-expired')).toBeUndefined();

    await store.deleteLoginSession('s-1');
    expect(await store.getLoginSession('s-1')).toBeUndefined();
  });

  it('encrypts credential payloads before storage and decrypts them on read', async () => {
    const envelope = 'mastra:factory-secret:v1:test-envelope';
    const encrypt = vi.fn(async () => envelope);
    const decrypt = vi.fn(async () => ({
      value: { type: 'api_key' as const, key: 'sk-secret' },
      needsReencryption: false,
    }));
    const store = await makeStore({ encrypt, decrypt });

    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'openai', {
      type: 'api_key',
      key: 'sk-secret',
    });
    expect(encrypt).toHaveBeenCalledWith({ type: 'api_key', key: 'sk-secret' });

    expect(await store.getCredential({ orgId: 'org1', userId: 'alice' }, 'openai')).toEqual({
      type: 'api_key',
      key: 'sk-secret',
    });
    expect(decrypt).toHaveBeenCalledWith(envelope);
  });
});
