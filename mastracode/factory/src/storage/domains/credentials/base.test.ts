/**
 * Model-credentials domain over a real backend (libsql `:memory:`): tenancy
 * isolation, user > org resolution precedence, refresh serialization (the
 * cross-backend stand-in for the pg FOR UPDATE re-check), and login-session
 * TTL cleanup on read.
 */

import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { createFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';
import { ModelCredentialsStorage } from './base.js';

const oauth = (tag: string, expires: number) => ({
  type: 'oauth' as const,
  access: `at-${tag}`,
  refresh: `rt-${tag}`,
  expires,
});

async function makeLibsqlStore(encryption?: FactorySecretEncryption): Promise<ModelCredentialsStorage> {
  const backend = new LibSQLFactoryStorage({ id: 'credentials-test', url: ':memory:' });
  const domain = backend.registerDomain(new ModelCredentialsStorage(encryption));
  await backend.init();
  onTestFinished(() => backend.close());
  return domain;
}

describe('ModelCredentialsStorage', () => {
  it('isolates user rows per user and per org', async () => {
    const store = await makeLibsqlStore();
    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'anthropic', oauth('a', Date.now() + 60_000));

    expect(await store.getCredential({ orgId: 'org1', userId: 'alice' }, 'anthropic')).toMatchObject({
      access: 'at-a',
    });
    expect(await store.getCredential({ orgId: 'org1', userId: 'bob' }, 'anthropic')).toBeUndefined();
    expect(await store.getCredential({ orgId: 'org2', userId: 'alice' }, 'anthropic')).toBeUndefined();
    expect(await store.resolveCredential('org1', 'bob', 'anthropic', 'user')).toBeUndefined();
  });

  it('stores org-scoped OAuth credentials (org-wide sign-in)', async () => {
    const store = await makeLibsqlStore();

    await store.setCredential({ orgId: 'org1' }, 'anthropic', oauth('org', Date.now() + 60_000));
    expect(await store.getCredential({ orgId: 'org1' }, 'anthropic')).toMatchObject({ type: 'oauth' });
    // Visible to every org member through resolution.
    expect(await store.resolveCredential('org1', 'alice', 'anthropic', 'org')).toMatchObject({ scope: 'org' });
  });

  it('resolves exactly one scope and lists both scopes for management', async () => {
    const store = await makeLibsqlStore();
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
    const store = await makeLibsqlStore();
    await store.setCredential({ orgId: 'org1' }, 'openai', { type: 'api_key', key: 'sk-org' });
    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'openai', { type: 'api_key', key: 'sk-alice' });

    expect(await store.removeCredential({ orgId: 'org1', userId: 'alice' }, 'openai')).toBe(true);
    expect(await store.resolveCredential('org1', 'alice', 'openai', 'org')).toMatchObject({ scope: 'org' });
    expect(await store.removeCredential({ orgId: 'org1', userId: 'alice' }, 'openai')).toBe(false);
  });

  it('refreshOAuth returns undefined without an OAuth row', async () => {
    const store = await makeLibsqlStore();
    expect(await store.refreshOAuth({ orgId: 'org1', userId: 'alice' }, 'anthropic', async c => c)).toBeUndefined();

    await store.setCredential({ orgId: 'org1', userId: 'alice' }, 'openai', { type: 'api_key', key: 'sk' });
    expect(await store.refreshOAuth({ orgId: 'org1', userId: 'alice' }, 'openai', async c => c)).toBeUndefined();
  });

  it('serializes concurrent refreshes: the loser sees the winner result and skips its own refresh', async () => {
    const store = await makeLibsqlStore();
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
    const store = await makeLibsqlStore();
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
    const store = await makeLibsqlStore({ encrypt, decrypt });

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

// Set FACTORY_TEST_POSTGRES_URL to a disposable database to also run on PostgreSQL.
const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])(
  'ModelCredentialsStorage with several subscriptions of one provider on %s',
  backend => {
    // The Postgres database is shared across runs, so every test gets its own org.
    let org = '';
    let alice = { orgId: org, userId: 'alice' };
    beforeEach(() => {
      org = `org-${randomUUID()}`;
      alice = { orgId: org, userId: 'alice' };
    });
    const makeStore = async () => {
      if (backend !== 'postgres') return makeLibsqlStore();
      const storage = new PgFactoryStorage({ id: 'credentials-test', connectionString: postgresUrl! });
      const domain = storage.registerDomain(new ModelCredentialsStorage());
      await storage.init();
      onTestFinished(() => storage.close());
      return domain;
    };
    const fresh = () => Date.now() + 60_000;
    const codex = (tag: string, accountId: string) => ({ ...oauth(tag, fresh()), accountId });

    it('keeps a second Claude subscription beside the first, in the order they were added', async () => {
      const store = await makeStore();
      await store.addAccount(alice, 'anthropic', oauth('first', fresh()));
      await store.addAccount(alice, 'anthropic', oauth('second', fresh()), { label: 'Work' });

      const accounts = await store.listAccounts(org, 'alice');
      expect(accounts.map(a => [a.provider, a.scope, a.credential.access, a.label])).toEqual([
        ['anthropic', 'user', 'at-first', undefined],
        ['anthropic', 'user', 'at-second', 'Work'],
      ]);
      expect(await store.resolveCredential(org, 'alice', 'anthropic', 'user')).toMatchObject({
        credential: { access: 'at-first' },
      });
      expect(await store.resolveCredential(org, 'alice', 'anthropic', 'user', accounts[1]!.id)).toMatchObject({
        credential: { access: 'at-second' },
      });
    });

    it('updates a subscription it already holds instead of adding it twice', async () => {
      const store = await makeStore();
      await store.addAccount(alice, 'openai-codex', codex('first', 'acct-1'));
      await store.addAccount(alice, 'openai-codex', codex('second', 'acct-2'));
      await store.addAccount(alice, 'openai-codex', codex('second-again', 'acct-2'));

      const accounts = await store.listAccounts(org, 'alice');
      expect(accounts.map(a => a.credential.access)).toEqual(['at-first', 'at-second-again']);
    });

    it('replaces the first sign-in when the provider only had an API key at that scope', async () => {
      const store = await makeStore();
      await store.setCredential(alice, 'anthropic', { type: 'api_key', key: 'sk-alice' });
      await store.addAccount(alice, 'anthropic', oauth('plan', fresh()));

      expect(await store.getCredential(alice, 'anthropic')).toMatchObject({ type: 'oauth', access: 'at-plan' });
      expect(await store.listAccounts(org, 'alice')).toHaveLength(1);
    });

    it('signing in again to one account replaces only that account', async () => {
      const store = await makeStore();
      await store.addAccount(alice, 'anthropic', oauth('first', fresh()));
      await store.addAccount(alice, 'anthropic', oauth('second', Date.now() - 1000));
      const [first, second] = await store.listAccounts(org, 'alice');

      await store.addAccount(alice, 'anthropic', oauth('second-renewed', fresh()), { replaceAccountId: second!.id });

      const accounts = await store.listAccounts(org, 'alice');
      expect(accounts.map(a => [a.id, a.credential.access])).toEqual([
        [first!.id, 'at-first'],
        [second!.id, 'at-second-renewed'],
      ]);
    });

    it('removing the first account keeps the provider connected on the next one', async () => {
      const store = await makeStore();
      await store.addAccount(alice, 'anthropic', oauth('first', fresh()));
      await store.addAccount(alice, 'anthropic', oauth('second', fresh()), { label: 'Work' });
      const [first] = await store.listAccounts(org, 'alice');

      expect(await store.removeAccount(alice, 'anthropic', first!.id)).toBe(true);

      expect((await store.listAccounts(org, 'alice')).map(a => [a.credential.access, a.label])).toEqual([
        ['at-second', 'Work'],
      ]);
      expect(await store.getCredential(alice, 'anthropic')).toMatchObject({ access: 'at-second' });
    });

    it('signing out of the provider removes every account at that scope only', async () => {
      const store = await makeStore();
      await store.addAccount(alice, 'anthropic', oauth('first', fresh()));
      await store.addAccount(alice, 'anthropic', oauth('second', fresh()));
      await store.addAccount({ orgId: org }, 'anthropic', oauth('org', fresh()));
      await store.addAccount({ orgId: org }, 'anthropic', oauth('org-2', fresh()));

      expect(await store.removeCredential(alice, 'anthropic')).toBe(true);

      expect((await store.listAccounts(org, 'alice')).map(a => [a.scope, a.credential.access])).toEqual([
        ['org', 'at-org'],
        ['org', 'at-org-2'],
      ]);
    });

    it("never shows one member's extra subscriptions to another member", async () => {
      const store = await makeStore();
      await store.addAccount(alice, 'anthropic', oauth('first', fresh()));
      await store.addAccount(alice, 'anthropic', oauth('second', fresh()));
      const [, second] = await store.listAccounts(org, 'alice');

      expect(await store.listAccounts(org, 'bob')).toEqual([]);
      expect(await store.resolveCredential(org, 'bob', 'anthropic', 'user', second!.id)).toBeUndefined();
      expect(await store.removeAccount({ orgId: org, userId: 'bob' }, 'anthropic', second!.id)).toBe(false);
      expect(await store.listAccounts(org, 'alice')).toHaveLength(2);
    });

    it('refreshes the expired account without touching the others', async () => {
      const store = await makeStore();
      await store.addAccount(alice, 'anthropic', oauth('first', fresh()));
      await store.addAccount(alice, 'anthropic', oauth('second', Date.now() - 1000));
      const [, second] = await store.listAccounts(org, 'alice');

      const refreshed = await store.refreshOAuth(
        alice,
        'anthropic',
        async () => oauth('second-refreshed', fresh()),
        undefined,
        second!.id,
      );

      expect(refreshed).toMatchObject({ access: 'at-second-refreshed' });
      expect((await store.listAccounts(org, 'alice')).map(a => a.credential.access)).toEqual([
        'at-first',
        'at-second-refreshed',
      ]);
    });

    it('records a failed refresh on that account only', async () => {
      const store = await makeStore();
      await store.addAccount(alice, 'anthropic', oauth('first', fresh()));
      await store.addAccount(alice, 'anthropic', oauth('second', Date.now() - 1000));
      const [, second] = await store.listAccounts(org, 'alice');

      await expect(
        store.refreshOAuth(
          alice,
          'anthropic',
          async () => {
            throw new Error('invalid_grant');
          },
          undefined,
          second!.id,
        ),
      ).rejects.toThrow('invalid_grant');

      const accounts = await store.listAccounts(org, 'alice');
      expect(accounts.map(a => a.refreshFailedAt instanceof Date)).toEqual([false, true]);
    });

    it('keeps every account when sign-ins and a refresh land at the same time', async () => {
      const store = await makeStore();
      await store.addAccount(alice, 'anthropic', oauth('first', fresh()));
      await store.addAccount(alice, 'anthropic', oauth('second', Date.now() - 1000));
      const [, second] = await store.listAccounts(org, 'alice');

      await Promise.all([
        store.addAccount(alice, 'anthropic', oauth('third', fresh())),
        store.addAccount(alice, 'anthropic', oauth('fourth', fresh())),
        store.refreshOAuth(alice, 'anthropic', async () => oauth('second-refreshed', fresh()), undefined, second!.id),
      ]);

      expect((await store.listAccounts(org, 'alice')).map(a => a.credential.access).sort()).toEqual([
        'at-first',
        'at-fourth',
        'at-second-refreshed',
        'at-third',
      ]);
    });

    it('keeps the account id of a subscription promoted to first', async () => {
      const store = await makeStore();
      await store.addAccount(alice, 'anthropic', oauth('first', fresh()));
      await store.addAccount(alice, 'anthropic', oauth('second', fresh()));
      const [first, second] = await store.listAccounts(org, 'alice');

      await store.removeAccount(alice, 'anthropic', first!.id);

      expect((await store.listAccounts(org, 'alice')).map(a => a.id)).toEqual([second!.id]);
      expect(await store.resolveCredential(org, 'alice', 'anthropic', 'user', second!.id)).toMatchObject({
        accountId: second!.id,
        credential: { access: 'at-second' },
      });
    });
  },
);

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

  it('encrypts a second subscription written before encryption was enabled', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-creds-')), 'enable-encryption-accounts.db')}`;
    const tenant = { orgId: 'org-1', userId: 'user-1' };
    const boot = async (encryption?: FactorySecretEncryption) => {
      const backend = new LibSQLFactoryStorage({ id: 'credentials-accounts-migration-test', url });
      const store = backend.registerDomain(new ModelCredentialsStorage(encryption));
      await backend.init();
      return { backend, store };
    };

    {
      const { backend, store } = await boot();
      await store.addAccount(tenant, 'anthropic', oauth('first', Date.now() + 60_000));
      await store.addAccount(tenant, 'anthropic', oauth('second', Date.now() + 60_000));
      await backend.close();
    }

    const encryption = createFactorySecretEncryption({ primary: { id: 'v1', key: new Uint8Array(32).fill(7) } });
    const { backend, store } = await boot(encryption);
    expect((await store.listAccounts('org-1', 'user-1')).map(a => a.credential.access)).toEqual([
      'at-first',
      'at-second',
    ]);
    const row = await backend.ops.findOne<{ extra_accounts: string }>('model_provider_credentials', {
      provider: 'anthropic',
    });
    expect(row!.extra_accounts).toMatch(/^mastra:factory-secret:v1:/);
    expect(row!.extra_accounts).not.toContain('at-second');
    await backend.close();
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
