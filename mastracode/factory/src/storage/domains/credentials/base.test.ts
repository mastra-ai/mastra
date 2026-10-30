/**
 * Model-credentials domain over a real backend (libsql `:memory:`): tenancy
 * isolation, user > org resolution precedence, refresh serialization (the
 * cross-backend stand-in for the pg FOR UPDATE re-check), and login-session
 * TTL cleanup on read.
 */

import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { createFactorySecretEncryption } from '../../../secret-encryption.js';
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
    expect(await store.resolveCredential('org1', 'bob', 'anthropic', 'user')).toBeUndefined();
  });

  it('stores org-scoped OAuth credentials (org-wide sign-in)', async () => {
    const store = await makeStore();

    await store.setCredential({ orgId: 'org1' }, 'anthropic', oauth('org', Date.now() + 60_000));
    expect(await store.getCredential({ orgId: 'org1' }, 'anthropic')).toMatchObject({ type: 'oauth' });
    // Visible to every org member through resolution.
    expect(await store.resolveCredential('org1', 'alice', 'anthropic', 'org')).toMatchObject({ scope: 'org' });
  });

  it('resolves exactly one scope and lists both scopes for management', async () => {
    const store = await makeStore();
    await store.setCredential({ orgId: 'org1' }, 'openai', { type: 'api_key', key: 'sk-org' });
    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'openai', { type: 'api_key', key: 'sk-alice' });
    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'google', { type: 'api_key', key: 'sk-alice-g' });

    expect(await store.resolveCredential('org1', 'alice', 'openai', 'user')).toMatchObject({
      scope: 'user',
      credential: { key: 'sk-alice' },
    });
    expect(await store.resolveCredential('org1', 'alice', 'openai', 'org')).toMatchObject({
      scope: 'org',
      credential: { key: 'sk-org' },
    });
    expect(await store.resolveCredential('org1', 'bob', 'openai', 'user')).toBeUndefined();
    expect(await store.resolveCredential('org1', 'alice', 'google', 'org')).toBeUndefined();

    const aliceList = await store.listCredentials('org1', 'alice');
    expect(aliceList.map(r => r.scope).sort()).toEqual(['org', 'user', 'user']);
    const bobList = await store.listCredentials('org1', 'bob');
    expect(bobList).toHaveLength(1);
    expect(bobList[0]!.scope).toBe('org');
  });

  it('removes only the addressed scope', async () => {
    const store = await makeStore();
    await store.setCredential({ orgId: 'org1' }, 'openai', { type: 'api_key', key: 'sk-org' });
    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'openai', { type: 'api_key', key: 'sk-alice' });

    expect(await store.removeCredential({ orgId: 'org1', userId: 'alice' }, 'openai')).toBe(true);
    expect(await store.resolveCredential('org1', 'alice', 'openai', 'org')).toMatchObject({ scope: 'org' });
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

describe('ModelCredentialsStorage enabling secretEncryption', () => {
  it('encrypts credentials written without encryption and reads back the original object', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-creds-')), 'enable-encryption.db')}`;
    const tenant = { orgId: 'org-1', userId: 'user-1' };
    const credential = { type: 'api_key' as const, key: 'sk-fake-model-key' };
    const boot = async (encryption?: FactorySecretEncryption) => {
      const backend = new LibSQLFactoryStorage({ id: 'credentials-migration-test', url });
      const store = backend.registerDomain(new ModelCredentialsStorage(encryption));
      await backend.init();
      return { backend, store };
    };

    {
      const { backend, store } = await boot();
      await store.setCredential(tenant, 'openai', credential);
      await backend.close();
    }

    const encryption = createFactorySecretEncryption({ primary: { id: 'v1', key: new Uint8Array(32).fill(7) } });
    for (let i = 0; i < 2; i++) {
      const { backend, store } = await boot(encryption);
      expect(await store.getCredential(tenant, 'openai')).toEqual(credential);
      const row = await backend.ops.findOne<{ data: string }>('model_provider_accounts', { provider: 'openai' });
      expect(row!.data).toMatch(/^mastra:factory-secret:v1:/);
      await backend.close();
    }
  });

  it('refuses to read encrypted credentials on an instance booted without the key', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-creds-')), 'missing-key.db')}`;
    const tenant = { orgId: 'org-1' };
    const credential = oauth('org', Date.now() + 60_000);
    const encryption = createFactorySecretEncryption({ primary: { id: 'v1', key: new Uint8Array(32).fill(7) } });
    const boot = async (withEncryption?: FactorySecretEncryption) => {
      const backend = new LibSQLFactoryStorage({ id: 'credentials-missing-key-test', url });
      const store = backend.registerDomain(new ModelCredentialsStorage(withEncryption));
      await backend.init();
      const initError = await store.ensureReady().then(
        () => undefined,
        (error: unknown) => error,
      );
      return { backend, store, initError };
    };

    {
      const { backend, store } = await boot(encryption);
      await store.setCredential(tenant, 'anthropic', credential);
      await backend.close();
    }

    {
      const { backend, store, initError } = await boot();
      expect(String(initError)).toMatch(/encrypted.*no secret encryption key/i);
      await expect(store.listCredentials('org-1', 'user-1')).rejects.toThrow(/no secret encryption key/i);
      await backend.close();
    }

    // The keyless boot must not have rewritten the row: the keyed instance still reads it.
    const { backend, store } = await boot(encryption);
    expect(await store.getCredential(tenant, 'anthropic')).toEqual(credential);
    await backend.close();
  });

  it('repairs credentials an older keyless boot rewrote as JSON-wrapped envelopes', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-creds-')), 'wrapped-envelope.db')}`;
    const tenant = { orgId: 'org-1' };
    const credential = oauth('org', Date.now() + 60_000);
    const encryption = createFactorySecretEncryption({ primary: { id: 'v1', key: new Uint8Array(32).fill(7) } });
    const boot = async () => {
      const backend = new LibSQLFactoryStorage({ id: 'credentials-wrapped-test', url });
      const store = backend.registerDomain(new ModelCredentialsStorage(encryption));
      await backend.init();
      return { backend, store };
    };

    {
      const { backend, store } = await boot();
      await store.setCredential(tenant, 'anthropic', credential);
      // What the old plaintext migration wrote: the envelope stored as JSON text.
      const row = await backend.ops.findOne<{ id: string; data: string }>('model_provider_accounts', {});
      await backend.ops.updateAtomic<{ data: string }>('model_provider_accounts', { id: row!.id }, () => ({
        data: JSON.stringify(row!.data),
      }));
      await backend.close();
    }

    // Two keyed boots: the first re-encrypts the wrapped row (the old double-wrap path), both must read the credential.
    for (let i = 0; i < 2; i++) {
      const { backend, store } = await boot();
      expect(await store.listCredentials('org-1', 'user-1')).toEqual([
        expect.objectContaining({ scope: 'org', credential }),
      ]);
      await backend.close();
    }
  });
});

const apiKey = (key: string) => ({ type: 'api_key' as const, key });

describe('ModelCredentialsStorage account pools', () => {
  const alice = { orgId: 'org1', userId: 'alice' };
  const org = { orgId: 'org1' };

  it('keeps personal and Factory-wide pools separate', async () => {
    const store = await makeStore();
    const personal = await store.addAccount(alice, 'anthropic', { credential: oauth('alice-1', Date.now() + 60_000) });
    await store.addAccount(alice, 'anthropic', { credential: oauth('alice-2', Date.now() + 60_000), activate: true });
    const shared = await store.addAccount(org, 'anthropic', { credential: oauth('org-1', Date.now() + 60_000) });

    expect(personal.active).toBe(true);
    expect(shared).toMatchObject({ active: true, providerId: 'anthropic', type: 'oauth', status: 'ok' });
    expect(shared.id).toMatch(/^anthropic:[0-9a-f-]{36}$/);
    expect((await store.listAccounts(alice)).map(a => [a.label, a.active])).toEqual([
      ['anthropic', false],
      ['anthropic', true],
    ]);
    expect(await store.listAccounts(org)).toEqual([shared]);
    expect(await store.listAccounts({ orgId: 'org1', userId: 'bob' })).toEqual([]);

    // Each scope resolves its own active account; rotating one never touches the other.
    expect(await store.resolveCredential('org1', 'alice', 'anthropic', 'user')).toMatchObject({
      credential: { access: 'at-alice-2' },
    });
    expect(await store.resolveCredential('org1', 'alice', 'anthropic', 'org')).toMatchObject({
      accountId: shared.id,
      credential: { access: 'at-org-1' },
    });
    expect(await store.activateAccount(alice, shared.id)).toBe(false);
    expect(await store.removeAccount(alice, shared.id)).toBe(false);
    expect(await store.getAccountCredential(alice, shared.id)).toBeUndefined();

    // One record per scope and provider: the active account of each pool.
    expect(
      (await store.listCredentials('org1', 'alice')).map(r => [r.scope, (r.credential as { access: string }).access]),
    ).toEqual(
      expect.arrayContaining([
        ['user', 'at-alice-2'],
        ['org', 'at-org-1'],
      ]),
    );
    expect(await store.listCredentials('org1', 'alice')).toHaveLength(2);
  });

  it('mixes API keys and OAuth subscriptions in one pool', async () => {
    const store = await makeStore();
    const key = await store.addAccount(org, 'openai', { credential: apiKey('sk-1'), label: 'Team key' });
    const sub = await store.addAccount(org, 'openai', { credential: oauth('sub', Date.now() + 60_000) });

    expect((await store.listAccounts(org, 'openai')).map(a => [a.type, a.label, a.active])).toEqual([
      ['api-key', 'Team key', true],
      ['oauth', 'openai', false],
    ]);
    expect(await store.getAccountCredential(org, sub.id)).toMatchObject({ type: 'oauth', access: 'at-sub' });
    expect(JSON.stringify(await store.listAccounts(org))).not.toMatch(/sk-1|at-sub|rt-sub/);

    await store.activateAccount(org, sub.id);
    expect(await store.getCredential(org, 'openai')).toMatchObject({ type: 'oauth' });
    // OAuth refresh addresses the active account; API-key accounts are never refreshed.
    expect(await store.refreshAccountOAuth(org, key.id, async c => c, { force: true })).toBeUndefined();
  });

  it('dedupes adds by provider identity and appends without one', async () => {
    const store = await makeStore();
    const first = await store.addAccount(alice, 'openai-codex', {
      credential: oauth('v1', Date.now() + 60_000),
      identity: 'acct-1',
    });
    await store.markAccountStatus(alice, first.id, 'auth-failed');
    const again = await store.addAccount(alice, 'openai-codex', {
      credential: oauth('v2', Date.now() + 60_000),
      identity: 'acct-1',
      label: 'Work',
    });
    expect(again).toMatchObject({ id: first.id, label: 'Work', status: 'ok', active: true });
    expect(await store.getAccountCredential(alice, first.id)).toMatchObject({ access: 'at-v2' });

    await store.addAccount(alice, 'openai-codex', { credential: oauth('v3', Date.now() + 60_000), identity: 'acct-2' });
    await store.addAccount(alice, 'openai-codex', { credential: oauth('v4', Date.now() + 60_000) });
    await store.addAccount(alice, 'openai-codex', { credential: oauth('v5', Date.now() + 60_000) });
    expect(await store.listAccounts(alice, 'openai-codex')).toHaveLength(4);

    // The same identity in another scope is a different account.
    const shared = await store.addAccount(org, 'openai-codex', {
      credential: oauth('org', Date.now() + 60_000),
      identity: 'acct-1',
    });
    expect(shared.id).not.toBe(first.id);

    // Concurrent adds of one identity converge on one account.
    await Promise.all(
      [1, 2, 3].map(i =>
        store.addAccount(org, 'anthropic', { credential: oauth(`race-${i}`, Date.now() + 60_000), identity: 'same' }),
      ),
    );
    expect(await store.listAccounts(org, 'anthropic')).toHaveLength(1);
  });

  it('activates, renames and removes accounts, promoting the next usable account', async () => {
    const store = await makeStore();
    const a = await store.addAccount(alice, 'anthropic', { credential: oauth('a', Date.now() + 60_000) });
    const b = await store.addAccount(alice, 'anthropic', { credential: oauth('b', Date.now() + 60_000) });
    const c = await store.addAccount(alice, 'anthropic', { credential: oauth('c', Date.now() + 60_000) });

    expect(await store.renameAccount(alice, b.id, 'Personal Max')).toBe(true);
    expect(await store.renameAccount(org, b.id, 'nope')).toBe(false);
    expect(await store.activateAccount(alice, c.id)).toBe(true);
    expect(await store.getCredential(alice, 'anthropic')).toMatchObject({ access: 'at-c' });

    // Removing the active account promotes the oldest usable one, skipping a cooling-down account.
    expect(await store.markAccountStatus(alice, a.id, 'cooldown', Date.now() + 60_000)).toBe(true);
    expect(await store.removeAccount(alice, c.id)).toBe(true);
    const listed = await store.listAccounts(alice, 'anthropic');
    expect(listed.map(x => [x.id, x.label, x.active, x.status])).toEqual([
      [a.id, 'anthropic', false, 'cooldown'],
      [b.id, 'Personal Max', true, 'ok'],
    ]);
    expect(listed[0]!.cooldownUntil).toBeGreaterThan(Date.now());

    // A lapsed cooldown reads as ok.
    await store.markAccountStatus(alice, a.id, 'cooldown', Date.now() - 1);
    expect((await store.listAccounts(alice, 'anthropic'))[0]).toMatchObject({ status: 'ok' });
    expect((await store.listAccounts(alice, 'anthropic'))[0]!.cooldownUntil).toBeUndefined();

    expect(await store.removeAccount(alice, b.id)).toBe(true);
    expect(await store.getCredential(alice, 'anthropic')).toMatchObject({ access: 'at-a' });
    expect(await store.removeAccount(alice, a.id)).toBe(true);
    expect(await store.getCredential(alice, 'anthropic')).toBeUndefined();
    expect(await store.removeAccount(alice, a.id)).toBe(false);

    // A new account starts an emptied pool as its active account.
    const d = await store.addAccount(alice, 'anthropic', { credential: apiKey('sk-d') });
    expect(d.active).toBe(true);
  });

  it('setCredential replaces the active account in place', async () => {
    const store = await makeStore();
    const a = await store.addAccount(alice, 'openai', { credential: apiKey('sk-a') });
    const b = await store.addAccount(alice, 'openai', { credential: apiKey('sk-b'), activate: true });
    await store.markAccountStatus(alice, b.id, 'auth-failed');

    await store.setCredential(alice, 'openai', apiKey('sk-b2'));
    expect(await store.listAccounts(alice, 'openai')).toEqual([
      expect.objectContaining({ id: a.id, active: false }),
      expect.objectContaining({ id: b.id, active: true, status: 'ok' }),
    ]);
    expect(await store.getAccountCredential(alice, b.id)).toEqual(apiKey('sk-b2'));
  });

  it('removeCredential signs out of the active account only, promoting the next by priority', async () => {
    const store = await makeStore();
    const a = await store.addAccount(alice, 'openai', { credential: apiKey('sk-a') });
    const b = await store.addAccount(alice, 'openai', { credential: apiKey('sk-b') });
    const c = await store.addAccount(alice, 'openai', { credential: apiKey('sk-c'), activate: true });
    await store.reorderAccounts(alice, 'openai', [c.id, b.id, a.id]);
    const other = await store.addAccount(alice, 'anthropic', { credential: apiKey('sk-anthropic') });
    const org = await store.addAccount({ orgId: 'org1' }, 'openai', { credential: apiKey('sk-org') });

    expect(await store.removeCredential(alice, 'openai')).toBe(true);
    expect(await store.listAccounts(alice, 'openai')).toEqual([
      expect.objectContaining({ id: b.id, active: true }),
      expect.objectContaining({ id: a.id, active: false }),
    ]);
    expect(await store.getCredential(alice, 'openai')).toEqual(apiKey('sk-b'));
    expect(await store.getAccountCredential(alice, a.id)).toEqual(apiKey('sk-a'));
    // Other providers and the Factory-wide pool are untouched.
    expect((await store.listAccounts(alice, 'anthropic')).map(row => row.id)).toEqual([other.id]);
    expect((await store.listAccounts({ orgId: 'org1' }, 'openai')).map(row => row.id)).toEqual([org.id]);

    expect(await store.removeCredential(alice, 'openai')).toBe(true);
    expect(await store.listAccounts(alice, 'openai')).toEqual([expect.objectContaining({ id: a.id, active: true })]);
    expect(await store.removeCredential(alice, 'openai')).toBe(true);
    expect(await store.listAccounts(alice, 'openai')).toEqual([]);
    expect(await store.getCredential(alice, 'openai')).toBeUndefined();
    expect(await store.removeCredential(alice, 'openai')).toBe(false);
  });

  it('serializes per-account refreshes and honours force for the 401 path', async () => {
    const store = await makeStore();
    await store.addAccount(alice, 'anthropic', { credential: oauth('active', Date.now() + 60_000) });
    const spare = await store.addAccount(alice, 'anthropic', { credential: oauth('old', Date.now() - 1000) });

    let refreshes = 0;
    const refreshFn = vi.fn(async () => oauth(`new-${++refreshes}`, Date.now() + 60_000));
    const [first, second] = await Promise.all([
      store.refreshAccountOAuth(alice, spare.id, refreshFn),
      store.refreshAccountOAuth(alice, spare.id, refreshFn),
    ]);
    expect(refreshFn).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ access: 'at-new-1' });
    expect(second).toMatchObject({ access: 'at-new-1' });
    // The active account was not touched.
    expect(await store.getCredential(alice, 'anthropic')).toMatchObject({ access: 'at-active' });

    // Unexpired: a plain refresh is a no-op, a forced one refreshes.
    expect(await store.refreshAccountOAuth(alice, spare.id, refreshFn)).toMatchObject({ access: 'at-new-1' });
    expect(refreshFn).toHaveBeenCalledTimes(1);
    // Two 401 handlers holding the same rejected token: only the first refreshes.
    const forced = await Promise.all([
      store.refreshAccountOAuth(alice, spare.id, refreshFn, { force: true, staleAccess: 'at-new-1' }),
      store.refreshAccountOAuth(alice, spare.id, refreshFn, { force: true, staleAccess: 'at-new-1' }),
    ]);
    expect(refreshFn).toHaveBeenCalledTimes(2);
    expect(forced).toEqual([
      expect.objectContaining({ access: 'at-new-2' }),
      expect.objectContaining({ access: 'at-new-2' }),
    ]);
    // A stale rejected token never keeps an expired one: it is still refreshed.
    const expiredSpare = await store.addAccount(alice, 'anthropic', { credential: oauth('lapsed', Date.now() - 1000) });
    expect(
      await store.refreshAccountOAuth(alice, expiredSpare.id, refreshFn, { force: true, staleAccess: 'at-other' }),
    ).toMatchObject({ access: 'at-new-3' });
    expect(refreshFn).toHaveBeenCalledTimes(3);

    // A failed refresh is recorded and rethrown; a successful one clears auth-failed.
    await store.markAccountStatus(alice, spare.id, 'auth-failed');
    await store.activateAccount(alice, spare.id);
    await expect(
      store.refreshOAuth(alice, 'anthropic', async () => Promise.reject(new Error('invalid_grant')), { force: true }),
    ).rejects.toThrow('invalid_grant');
    expect((await store.listCredentials('org1', 'alice'))[0]!.refreshFailedAt).toBeInstanceOf(Date);
    await store.refreshOAuth(alice, 'anthropic', refreshFn, { force: true });
    expect((await store.listCredentials('org1', 'alice'))[0]!.refreshFailedAt).toBeUndefined();
    expect((await store.listAccounts(alice)).find(a => a.id === spare.id)).toMatchObject({ status: 'ok' });
  });
});

describe('ModelCredentialsStorage account priority', () => {
  const alice = { orgId: 'org1', userId: 'alice' };
  const org = { orgId: 'org1' };

  it('appends new accounts at max priority + 1 per pool, even when added concurrently', async () => {
    const store = await makeStore();
    const a = await store.addAccount(alice, 'anthropic', { credential: oauth('a', Date.now() + 60_000) });
    const b = await store.addAccount(alice, 'anthropic', { credential: apiKey('sk-b') });
    // Other pools (scope or provider) number independently.
    const shared = await store.addAccount(org, 'anthropic', { credential: apiKey('sk-org') });
    const other = await store.addAccount(alice, 'openai', { credential: apiKey('sk-openai') });
    expect([a.priority, b.priority, shared.priority, other.priority]).toEqual([0, 1, 0, 0]);

    await Promise.all([1, 2, 3, 4].map(i => store.addAccount(alice, 'anthropic', { credential: apiKey(`sk-c${i}`) })));
    expect((await store.listAccounts(alice, 'anthropic')).map(acc => acc.priority)).toEqual([0, 1, 2, 3, 4, 5]);

    // A gap left by removal is not reused: new accounts still go last.
    await store.removeAccount(alice, b.id);
    const last = await store.addAccount(alice, 'anthropic', { credential: apiKey('sk-last') });
    expect(last.priority).toBe(6);
  });

  it('lists by priority, then creation time, and falls back along that order', async () => {
    const store = await makeStore();
    const first = await store.addAccount(org, 'openai', { credential: apiKey('sk-1') });
    const second = await store.addAccount(org, 'openai', { credential: apiKey('sk-2') });
    const third = await store.addAccount(org, 'openai', { credential: apiKey('sk-3') });

    await store.reorderAccounts(org, 'openai', [third.id, first.id, second.id]);
    expect((await store.listAccounts(org, 'openai')).map(acc => [acc.id, acc.priority])).toEqual([
      [third.id, 0],
      [first.id, 1],
      [second.id, 2],
    ]);

    // Removing the active account promotes the first remaining account in priority order.
    await store.removeAccount(org, first.id);
    expect(await store.getCredential(org, 'openai')).toEqual(apiKey('sk-3'));
  });

  it('moves a partial reorder list to the front and keeps the rest in their current order', async () => {
    const store = await makeStore();
    const ids: string[] = [];
    for (const key of ['a', 'b', 'c', 'd']) {
      ids.push((await store.addAccount(org, 'openai', { credential: apiKey(`sk-${key}`) })).id);
    }
    const [ia, ib, ic, id] = ids as [string, string, string, string];
    // Current order differs from creation order, so "the rest" must follow priority, not createdAt.
    await store.reorderAccounts(org, 'openai', [id, ib, ia, ic]);

    await store.reorderAccounts(org, 'openai', [ic, ia]);
    expect((await store.listAccounts(org, 'openai')).map(acc => [acc.id, acc.priority])).toEqual([
      [ic, 0],
      [ia, 1],
      [id, 2],
      [ib, 3],
    ]);

    // An empty list just renumbers the pool in its current order.
    await store.reorderAccounts(org, 'openai', []);
    expect((await store.listAccounts(org, 'openai')).map(acc => acc.id)).toEqual([ic, ia, id, ib]);
  });

  it('breaks priority ties by creation time', async () => {
    const backend = new LibSQLFactoryStorage({ id: 'credentials-test', url: ':memory:' });
    const store = backend.registerDomain(new ModelCredentialsStorage());
    await backend.init();
    onTestFinished(() => backend.close());
    const older = await store.addAccount(org, 'openai', { credential: apiKey('sk-old') });
    const newer = await store.addAccount(org, 'openai', { credential: apiKey('sk-new') });
    // Tie both at 0 so only created_at orders them; flipping created_at flips the order.
    await backend.ops.updateMany(
      'model_provider_accounts',
      { id: older.id },
      { priority: 0, created_at: new Date(1_000) },
    );
    await backend.ops.updateMany(
      'model_provider_accounts',
      { id: newer.id },
      { priority: 0, created_at: new Date(2_000) },
    );
    expect((await store.listAccounts(org, 'openai')).map(acc => acc.id)).toEqual([older.id, newer.id]);
    await backend.ops.updateMany('model_provider_accounts', { id: older.id }, { created_at: new Date(3_000) });
    expect((await store.listAccounts(org, 'openai')).map(acc => acc.id)).toEqual([newer.id, older.id]);
  });

  it('rejects reorders naming foreign, unknown, duplicate or missing ids, leaving order unchanged', async () => {
    const store = await makeStore();
    const one = await store.addAccount(alice, 'anthropic', { credential: apiKey('sk-1') });
    const two = await store.addAccount(alice, 'anthropic', { credential: apiKey('sk-2') });
    const orgAccount = await store.addAccount(org, 'anthropic', { credential: apiKey('sk-org') });
    const otherProvider = await store.addAccount(alice, 'openai', { credential: apiKey('sk-openai') });
    const bobs = await store.addAccount({ orgId: 'org1', userId: 'bob' }, 'anthropic', {
      credential: apiKey('sk-bob'),
    });

    await expect(store.reorderAccounts(alice, 'anthropic', [two.id, orgAccount.id, one.id])).rejects.toThrow(
      /not in this pool/,
    );
    await expect(store.reorderAccounts(alice, 'anthropic', [two.id, bobs.id, one.id])).rejects.toThrow(
      /not in this pool/,
    );
    await expect(store.reorderAccounts(alice, 'anthropic', [two.id, otherProvider.id, one.id])).rejects.toThrow(
      /not in this pool/,
    );
    await expect(store.reorderAccounts(alice, 'anthropic', [two.id, 'anthropic:nope', one.id])).rejects.toThrow(
      /not in this pool/,
    );
    await expect(store.reorderAccounts(alice, 'anthropic', [two.id, two.id, one.id])).rejects.toThrow(/duplicate/);
    // A partial list with one bad id is rejected whole.
    await expect(store.reorderAccounts(alice, 'anthropic', [two.id, 'anthropic:nope'])).rejects.toThrow(
      /not in this pool/,
    );
    expect((await store.listAccounts(alice, 'anthropic')).map(acc => [acc.id, acc.priority])).toEqual([
      [one.id, 0],
      [two.id, 1],
    ]);
    // The org pool was not touched by the rejected attempts.
    expect((await store.listAccounts(org, 'anthropic'))[0]).toMatchObject({ id: orgAccount.id, priority: 0 });
  });
});

describe('ModelCredentialsStorage legacy migration', () => {
  type LegacyRow = { id: string; updated_at: Date; migrated_at: Date | null };

  async function bootFile(url: string, encryption?: FactorySecretEncryption) {
    const backend = new LibSQLFactoryStorage({ id: 'credentials-legacy-test', url });
    const store = backend.registerDomain(new ModelCredentialsStorage(encryption));
    await backend.init();
    await store.ensureReady();
    return { backend, store };
  }

  async function seedLegacy(url: string) {
    const { backend } = await bootFile(url);
    const at = new Date(Date.now() - 60_000);
    const insert = (userId: string | null, provider: string, data: unknown) =>
      backend.ops.insertOne('model_provider_credentials', {
        org_id: 'org1',
        user_id: userId,
        provider,
        type: (data as { type: string }).type,
        data,
        created_at: at,
        updated_at: at,
        refresh_failed_at: null,
        migrated_at: null,
      });
    await insert('alice', 'anthropic', oauth('legacy-alice', Date.now() + 60_000));
    await insert(null, 'anthropic', oauth('legacy-org', Date.now() + 60_000));
    await insert(null, 'openai', apiKey('sk-legacy'));
    // Seeding happened after this boot's migration; drop what the boot created.
    await backend.ops.deleteMany('model_provider_accounts', {});
    await backend.ops.deleteMany('model_provider_account_pools', {});
    await backend.close();
  }

  const tmpUrl = (name: string) => `file:${join(mkdtempSync(join(tmpdir(), 'factory-creds-')), name)}`;

  it('copies legacy rows into one-account pools, idempotently across boots', async () => {
    const url = tmpUrl('legacy.db');
    await seedLegacy(url);

    for (let i = 0; i < 2; i++) {
      const { backend, store } = await bootFile(url);
      const personal = await store.listAccounts({ orgId: 'org1', userId: 'alice' });
      expect(personal).toEqual([
        expect.objectContaining({ providerId: 'anthropic', type: 'oauth', active: true, priority: 0 }),
      ]);
      expect((await store.listAccounts({ orgId: 'org1' })).map(a => a.priority)).toEqual([0, 0]);
      expect((await store.listAccounts({ orgId: 'org1' })).map(a => [a.providerId, a.type, a.active])).toEqual(
        expect.arrayContaining([
          ['anthropic', 'oauth', true],
          ['openai', 'api-key', true],
        ]),
      );
      expect(await store.listAccounts({ orgId: 'org1' })).toHaveLength(2);
      expect(await store.resolveCredential('org1', 'alice', 'anthropic', 'user')).toMatchObject({
        accountId: personal[0]!.id,
        credential: { access: 'at-legacy-alice' },
      });
      expect(await store.resolveCredential('org1', 'bob', 'openai', 'org')).toMatchObject({
        credential: { key: 'sk-legacy' },
      });
      const legacy = await backend.ops.findMany<LegacyRow>('model_provider_credentials', {});
      expect(legacy.every(row => row.migrated_at?.getTime() === row.updated_at.getTime())).toBe(true);
      await backend.close();
    }
  });

  it('converges when replicas migrate concurrently', async () => {
    const url = tmpUrl('legacy-concurrent.db');
    await seedLegacy(url);
    const { backend, store } = await bootFile(url);
    await backend.ops.updateMany('model_provider_credentials', {}, { migrated_at: null });
    await backend.ops.deleteMany('model_provider_accounts', {});
    await backend.ops.deleteMany('model_provider_account_pools', {});

    await Promise.all([store.init(), store.init(), store.init()]);
    expect(await store.listAccounts({ orgId: 'org1' })).toHaveLength(2);
    expect(await store.listAccounts({ orgId: 'org1', userId: 'alice' })).toEqual([
      expect.objectContaining({ active: true }),
    ]);
    await backend.close();
  });

  it('does not resurrect removed accounts and picks up newer legacy writes', async () => {
    const url = tmpUrl('legacy-changes.db');
    await seedLegacy(url);
    {
      const { backend, store } = await bootFile(url);
      const [personal] = await store.listAccounts({ orgId: 'org1', userId: 'alice' });
      expect(await store.removeAccount({ orgId: 'org1', userId: 'alice' }, personal!.id)).toBe(true);
      // The deprecated source row goes too, so resetting `migrated_at` could not bring it back.
      expect(await backend.ops.findMany('model_provider_credentials', { user_id: 'alice' })).toEqual([]);
      // An older replica (still on the single-row table) rotates the org OAuth token after the copy.
      await backend.ops.updateMany(
        'model_provider_credentials',
        { user_id: null, provider: 'anthropic' },
        { data: oauth('legacy-org-rotated', Date.now() + 60_000), updated_at: new Date() },
      );
      await backend.close();
    }

    const { backend, store } = await bootFile(url);
    expect(await store.listAccounts({ orgId: 'org1', userId: 'alice' })).toEqual([]);
    expect(await store.getCredential({ orgId: 'org1' }, 'anthropic')).toMatchObject({
      access: 'at-legacy-org-rotated',
    });
    expect(await store.listAccounts({ orgId: 'org1' }, 'anthropic')).toHaveLength(1);
    await backend.close();
  });

  it('signing out of a migrated account keeps the rest of the pool across reboots', async () => {
    const url = tmpUrl('legacy-signout.db');
    await seedLegacy(url);
    const org = { orgId: 'org1' };
    let added: string;
    {
      const { backend, store } = await bootFile(url);
      // Signing out of a newer active account leaves the migrated account and its source row.
      const extra = await store.addAccount(org, 'openai', { credential: apiKey('sk-extra'), activate: true });
      expect(await store.removeCredential(org, 'openai')).toBe(true);
      expect((await store.listAccounts(org, 'openai')).map(row => row.id)).not.toContain(extra.id);
      expect(
        await backend.ops.findMany('model_provider_credentials', { user_id: null, provider: 'openai' }),
      ).toHaveLength(1);
      added = (await store.addAccount(org, 'openai', { credential: apiKey('sk-second') })).id;
      expect(await store.removeCredential(org, 'openai')).toBe(true);
      expect(await backend.ops.findMany('model_provider_credentials', { user_id: null, provider: 'openai' })).toEqual(
        [],
      );
      await backend.close();
    }

    const { backend, store } = await bootFile(url);
    expect(await store.listAccounts(org, 'openai')).toEqual([expect.objectContaining({ id: added, active: true })]);
    expect(await store.getCredential(org, 'openai')).toEqual(apiKey('sk-second'));
    await backend.close();
  });

  it('encrypts legacy rows and their copies when secretEncryption is enabled', async () => {
    const url = tmpUrl('legacy-encrypt.db');
    await seedLegacy(url);
    const encryption = createFactorySecretEncryption({ primary: { id: 'v1', key: new Uint8Array(32).fill(7) } });
    const { backend, store } = await bootFile(url, encryption);
    expect(await store.getCredential({ orgId: 'org1' }, 'openai')).toEqual(apiKey('sk-legacy'));
    for (const collection of ['model_provider_credentials', 'model_provider_accounts']) {
      const rows = await backend.ops.findMany<{ data: unknown }>(collection, {});
      expect(rows).toHaveLength(3);
      for (const row of rows) expect(row.data).toMatch(/^mastra:factory-secret:v1:/);
    }
    await backend.close();
  });
});
