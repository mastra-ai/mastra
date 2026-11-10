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
      const row = await backend.ops.findOne<{ data: string }>('model_provider_credentials', { provider: 'openai' });
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
      const row = await backend.ops.findOne<{ id: string; data: string }>('model_provider_credentials', {});
      await backend.ops.updateAtomic<{ data: string }>('model_provider_credentials', { id: row!.id }, () => ({
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
