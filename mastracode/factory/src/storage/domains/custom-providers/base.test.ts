import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';
import { createFactoryStorageForTests } from '../../test-utils.js';
import { CustomProvidersStorage } from './base.js';
import type { CustomProviderInput, CustomProviderRecord, CustomProviderWrite } from './base.js';

/**
 * File-backed store so a "pre-encryption deployment" can write rows, close,
 * and a later boot with a different encryption posture reads the same DB —
 * the exact upgrade path a live Factory takes.
 */
async function makeFileStore(url: string, encryption?: FactorySecretEncryption) {
  const backend = new LibSQLFactoryStorage({ id: 'custom-providers-migration-test', url });
  const domain = backend.registerDomain(new CustomProvidersStorage(encryption));
  await backend.init();
  onTestFinished(() => backend.close());
  return { backend, domain };
}

async function seedLegacyRawApiKeyRow(url: string, apiKey = 'sk-ant-api03-raw-legacy-key'): Promise<void> {
  // Simulate a pre-encryption deployment: the row's api_key is the bare
  // secret string, exactly as the domain wrote it before encryption existed.
  const { backend, domain } = await makeFileStore(url);
  await domain.create({
    owner: { orgId: 'org-1' },
    createdBy: 'user-1',
    input: { providerId: 'legacy-llm', name: 'Legacy LLM', url: 'https://llm.example.com/v1', models: ['m'] },
  });
  await backend.ops.updateMany(
    'custom_providers',
    { org_id: 'org-1', provider_id: 'legacy-llm' },
    {
      api_key: apiKey,
    },
  );
  await backend.close();
}

const testKey = { id: 'v1', key: new Uint8Array(32).fill(7) };

/** Unwraps a write the test expects to succeed, failing with the refusal otherwise. */
function saved(write: CustomProviderWrite): CustomProviderRecord {
  if ('refused' in write) throw new Error(`expected the write to succeed, but it was refused: ${write.refused}`);
  return write.saved;
}

const endpoint = (fields: Partial<CustomProviderInput> = {}): CustomProviderInput => ({
  providerId: 'my-llm',
  name: 'My LLM',
  url: 'https://llm.example.com/v1',
  models: ['m'],
  ...fields,
});

describe('CustomProvidersStorage', () => {
  it('creates an org-owned provider and scopes reads to the organization', async () => {
    const seed = await createFactoryStorageForTests();

    const provider = saved(
      await seed.customProviders.create({
        owner: { orgId: 'org-1' },
        createdBy: 'user-1',
        input: endpoint({ apiKey: 'sk-secret', models: ['fast', 'smart'] }),
      }),
    );

    expect(provider).toMatchObject({
      orgId: 'org-1',
      userId: null,
      createdBy: 'user-1',
      providerId: 'my-llm',
      name: 'My LLM',
      url: 'https://llm.example.com/v1',
      apiKey: 'sk-secret',
      models: ['fast', 'smart'],
    });
    expect(await seed.customProviders.list({ orgId: 'org-1' })).toHaveLength(1);
    expect(await seed.customProviders.list({ orgId: 'other-org' })).toEqual([]);
  });

  // Adding a provider under a name already in use used to replace it, along
  // with its saved key.
  it('refuses to create a provider under a name the owner already uses, even concurrently', async () => {
    const seed = await createFactoryStorageForTests();
    const owner = { orgId: 'org-1' };
    saved(await seed.customProviders.create({ owner, createdBy: 'admin', input: endpoint({ apiKey: 'sk-1' }) }));

    expect(
      await seed.customProviders.create({
        owner,
        createdBy: 'other',
        input: endpoint({ url: 'https://b.example.com' }),
      }),
    ).toEqual({ refused: 'name_taken' });
    expect(await seed.customProviders.list(owner)).toMatchObject([
      { url: 'https://llm.example.com/v1', apiKey: 'sk-1' },
    ]);

    const raced = await Promise.all([
      seed.customProviders.create({ owner, createdBy: 'a', input: endpoint({ providerId: 'race', name: 'Race' }) }),
      seed.customProviders.create({ owner, createdBy: 'b', input: endpoint({ providerId: 'race', name: 'Race' }) }),
    ]);
    expect(raced.filter(write => 'saved' in write)).toHaveLength(1);
    expect(raced.filter(write => 'refused' in write)).toEqual([{ refused: 'name_taken' }]);
  });

  it('edits a provider in place, keeping its id, its creator and its saved key', async () => {
    const seed = await createFactoryStorageForTests();
    const owner = { orgId: 'org-1' };
    const original = saved(
      await seed.customProviders.create({ owner, createdBy: 'user-1', input: endpoint({ apiKey: 'sk-kept' }) }),
    );

    const edited = saved(
      await seed.customProviders.update({
        owner,
        providerId: 'my-llm',
        input: endpoint({
          providerId: 'new-name',
          name: 'New Name',
          url: 'https://llm.example.com/v2',
          models: ['a', 'b'],
        }),
      }),
    );

    expect(edited).toMatchObject({
      id: original.id,
      createdBy: 'user-1',
      providerId: 'new-name',
      name: 'New Name',
      url: 'https://llm.example.com/v2',
      models: ['a', 'b'],
      // The settings form sends no key unless the user types a new one.
      apiKey: 'sk-kept',
    });
    expect((await seed.customProviders.list(owner)).map(provider => provider.providerId)).toEqual(['new-name']);
  });

  // A saved key is never shown again, so keeping it while the URL moves to
  // another host would let whoever edits the provider send it anywhere.
  it('asks for the key again when an edit moves a provider to another host', async () => {
    const seed = await createFactoryStorageForTests();
    const owner = { orgId: 'org-1' };
    saved(await seed.customProviders.create({ owner, createdBy: 'admin', input: endpoint({ apiKey: 'sk-secret' }) }));

    expect(
      await seed.customProviders.update({
        owner,
        providerId: 'my-llm',
        input: endpoint({ url: 'https://evil.example.com/v1' }),
      }),
    ).toEqual({ refused: 'api_key_required' });
    expect(await seed.customProviders.list(owner)).toMatchObject([
      { url: 'https://llm.example.com/v1', apiKey: 'sk-secret' },
    ]);

    // With a new key, or for a provider that never had one, the move is fine.
    expect(
      saved(
        await seed.customProviders.update({
          owner,
          providerId: 'my-llm',
          input: endpoint({ url: 'https://moved.example.com/v1', apiKey: 'sk-new' }),
        }),
      ),
    ).toMatchObject({ url: 'https://moved.example.com/v1', apiKey: 'sk-new' });
    saved(
      await seed.customProviders.create({
        owner,
        createdBy: 'admin',
        input: endpoint({ providerId: 'open', name: 'Open' }),
      }),
    );
    expect(
      saved(
        await seed.customProviders.update({
          owner,
          providerId: 'open',
          input: endpoint({ providerId: 'open', name: 'Open', url: 'https://elsewhere.example.com/v1' }),
        }),
      ),
    ).toMatchObject({ url: 'https://elsewhere.example.com/v1', apiKey: null });
  });

  // An edit that leaves the key out must not write back the key it read
  // before a concurrent rotation landed.
  it('keeps a key rotated by a concurrent edit', async () => {
    const seed = await createFactoryStorageForTests();
    const owner = { orgId: 'org-1' };
    saved(await seed.customProviders.create({ owner, createdBy: 'admin', input: endpoint({ apiKey: 'sk-old' }) }));

    await Promise.all([
      seed.customProviders.update({ owner, providerId: 'my-llm', input: endpoint({ apiKey: 'sk-rotated' }) }),
      seed.customProviders.update({ owner, providerId: 'my-llm', input: endpoint({ models: ['m', 'n'] }) }),
    ]);

    expect(await seed.customProviders.list(owner)).toMatchObject([{ apiKey: 'sk-rotated' }]);
  });

  it('refuses to rename a provider onto a name the owner already uses', async () => {
    const seed = await createFactoryStorageForTests();
    const owner = { orgId: 'org-1' };
    saved(await seed.customProviders.create({ owner, createdBy: 'admin', input: endpoint({ apiKey: 'sk-source' }) }));
    saved(
      await seed.customProviders.create({
        owner,
        createdBy: 'admin',
        input: endpoint({ providerId: 'taken', name: 'Taken', apiKey: 'sk-taken' }),
      }),
    );

    expect(
      await seed.customProviders.update({
        owner,
        providerId: 'my-llm',
        input: endpoint({ providerId: 'taken', name: 'Taken' }),
      }),
    ).toEqual({ refused: 'name_taken' });
    expect(await seed.customProviders.list(owner)).toMatchObject([
      { providerId: 'my-llm', apiKey: 'sk-source' },
      { providerId: 'taken', apiKey: 'sk-taken' },
    ]);
  });

  it('reports an edit of a provider that no longer exists', async () => {
    const seed = await createFactoryStorageForTests();

    expect(
      await seed.customProviders.update({ owner: { orgId: 'org-1' }, providerId: 'vanished', input: endpoint() }),
    ).toEqual({ refused: 'not_found' });
    expect(await seed.customProviders.list({ orgId: 'org-1' })).toEqual([]);
  });

  it("keeps a member's providers apart from the organization's and from other members'", async () => {
    const seed = await createFactoryStorageForTests();
    const organization = { orgId: 'org-1' };
    const alice = { orgId: 'org-1', userId: 'alice' };
    const bob = { orgId: 'org-1', userId: 'bob' };
    const endpoint = (url: string, apiKey: string) => ({
      providerId: 'my-llm',
      name: 'My LLM',
      url,
      apiKey,
      models: ['m'],
    });

    // The same name is free at every owner.
    await seed.customProviders.create({
      owner: organization,
      createdBy: 'admin',
      input: endpoint('https://org.example.com', 'sk-org'),
    });
    await seed.customProviders.create({
      owner: alice,
      createdBy: 'alice',
      input: endpoint('https://alice.example.com', 'sk-alice'),
    });
    await seed.customProviders.create({
      owner: bob,
      createdBy: 'bob',
      input: endpoint('https://bob.example.com', 'sk-bob'),
    });

    expect(await seed.customProviders.list(organization)).toMatchObject([
      { userId: null, url: 'https://org.example.com', apiKey: 'sk-org' },
    ]);
    expect(await seed.customProviders.list(alice)).toMatchObject([
      { userId: 'alice', url: 'https://alice.example.com', apiKey: 'sk-alice' },
    ]);
    expect(await seed.customProviders.list(bob)).toMatchObject([
      { userId: 'bob', url: 'https://bob.example.com', apiKey: 'sk-bob' },
    ]);
    // Same member id in another organization is a different owner.
    expect(await seed.customProviders.list({ orgId: 'org-2', userId: 'alice' })).toEqual([]);

    // Model resolution loads an organization once and serves every owner from it.
    const everyone = await seed.customProviders.listForOrg('org-1');
    expect(everyone.map(provider => provider.userId).sort()).toEqual(['alice', 'bob', null].sort());

    // Removing one owner's provider leaves the others in place.
    expect(await seed.customProviders.delete({ owner: alice, providerId: 'my-llm' })).toBe(true);
    expect(await seed.customProviders.list(alice)).toEqual([]);
    expect(await seed.customProviders.list(organization)).toHaveLength(1);
    expect(await seed.customProviders.list(bob)).toHaveLength(1);
  });

  it('deletes only within the org', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.customProviders.create({
      owner: { orgId: 'org-1' },
      createdBy: 'user-1',
      input: { providerId: 'my-llm', name: 'My LLM', url: 'https://a.example.com', models: [] },
    });

    expect(await seed.customProviders.delete({ owner: { orgId: 'org-2' }, providerId: 'my-llm' })).toBe(false);
    expect(await seed.customProviders.delete({ owner: { orgId: 'org-1' }, providerId: 'my-llm' })).toBe(true);
    expect(await seed.customProviders.list({ orgId: 'org-1' })).toEqual([]);
  });

  it('boots over a pre-encryption raw api_key in plaintext mode and normalizes the row', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-cp-')), 'plaintext.db')}`;
    await seedLegacyRawApiKeyRow(url);

    // Default (plaintext) posture — a local no-auth Factory upgrading in place.
    const { backend, domain } = await makeFileStore(url);

    const providers = await domain.list({ orgId: 'org-1' });
    expect(providers).toHaveLength(1);
    expect(providers[0]!.apiKey).toBe('sk-ant-api03-raw-legacy-key');

    // init() rewrote the raw string into the current JSON format.
    const row = await backend.ops.findOne<{ api_key: string }>('custom_providers', { provider_id: 'legacy-llm' });
    expect(row!.api_key).toBe(JSON.stringify('sk-ant-api03-raw-legacy-key'));
  });

  it('boots over a pre-encryption raw api_key in encrypted mode and encrypts the row', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-cp-')), 'encrypted.db')}`;
    await seedLegacyRawApiKeyRow(url);

    // Auth-enabled posture — the same upgrade with real encryption configured.
    const { backend, domain } = await makeFileStore(url, createFactorySecretEncryption({ primary: testKey }));

    const providers = await domain.list({ orgId: 'org-1' });
    expect(providers).toHaveLength(1);
    expect(providers[0]!.apiKey).toBe('sk-ant-api03-raw-legacy-key');

    // init() encrypted the legacy plaintext in place.
    const row = await backend.ops.findOne<{ api_key: string }>('custom_providers', { provider_id: 'legacy-llm' });
    expect(row!.api_key).toMatch(/^mastra:factory-secret:v1:/);
    expect(row!.api_key).not.toContain('raw-legacy-key');
  });

  it.each(['12345', 'null', '{}'])('keeps a JSON-valid raw api_key %s as a string through every boot', async rawKey => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-cp-')), 'json-valid.db')}`;
    await seedLegacyRawApiKeyRow(url, rawKey);

    for (const encryption of [undefined, createFactorySecretEncryption({ primary: testKey })]) {
      const { backend, domain } = await makeFileStore(url, encryption);
      const [provider] = await domain.list({ orgId: 'org-1' });
      expect(provider!.apiKey).toBe(rawKey);
      await backend.close();
    }
  });
});

describe('CustomProvidersStorage enabling secretEncryption', () => {
  it('encrypts api keys written without encryption and reads back the original key', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-cp-')), 'enable-encryption.db')}`;
    {
      const { backend, domain } = await makeFileStore(url);
      await domain.create({
        owner: { orgId: 'org-1' },
        createdBy: 'user-1',
        input: {
          providerId: 'my-llm',
          name: 'My LLM',
          url: 'https://llm.example.com/v1',
          apiKey: 'sk-fake-custom-key',
          models: ['m'],
        },
      });
      await backend.close();
    }

    for (let boot = 0; boot < 2; boot++) {
      const { backend, domain } = await makeFileStore(url, createFactorySecretEncryption({ primary: testKey }));
      const [provider] = await domain.list({ orgId: 'org-1' });
      expect(provider!.apiKey).toBe('sk-fake-custom-key');

      const row = await backend.ops.findOne<{ api_key: string }>('custom_providers', { provider_id: 'my-llm' });
      expect(row!.api_key).toMatch(/^mastra:factory-secret:v1:/);
      await backend.close();
    }
  });

  it('keeps an api key that merely looks like an encrypted value, without disabling the domain', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-cp-')), 'envelope-lookalike.db')}`;
    const lookalike = 'mastra:factory-secret:v1:not-a-real-envelope';
    const encryption = () => createFactorySecretEncryption({ primary: testKey });
    {
      const { backend, domain } = await makeFileStore(url, encryption());
      const created = saved(
        await domain.create({
          owner: { orgId: 'org-1' },
          createdBy: 'user-1',
          input: endpoint({ apiKey: lookalike }),
        }),
      );
      expect(created.apiKey).toBe(lookalike);
      await backend.close();
    }

    // A fresh boot migrates every row during init(); the lookalike must not fail it.
    const { domain } = await makeFileStore(url, encryption());
    await expect(domain.ensureReady()).resolves.toBeUndefined();
    const [provider] = await domain.list({ orgId: 'org-1' });
    expect(provider!.apiKey).toBe(lookalike);
  });
});

describe('CustomProvidersStorage headers, auth scheme and last check', () => {
  const owner = { orgId: 'org-1' };
  const headers = [
    { name: 'X-Tenant', value: 'tenant-secret-value' },
    { name: 'X-Region', value: 'eu-west', secret: false },
  ];

  it('stores header values encrypted and reads them back with their secret flags', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-cp-')), 'headers.db')}`;
    const encryption = createFactorySecretEncryption({ primary: testKey });
    const { backend, domain } = await makeFileStore(url, encryption);

    saved(await domain.create({ owner, createdBy: 'admin', input: endpoint({ authScheme: 'x-api-key', headers }) }));

    expect(await domain.get({ owner, providerId: 'my-llm' })).toMatchObject({
      authScheme: 'x-api-key',
      headers: [
        // A new header without a flag is secret.
        { name: 'X-Tenant', value: 'tenant-secret-value', secret: true },
        { name: 'X-Region', value: 'eu-west', secret: false },
      ],
      lastCheck: null,
    });
    const row = await backend.ops.findOne<{ headers: string }>('custom_providers', { provider_id: 'my-llm' });
    expect(row!.headers).toMatch(/^mastra:factory-secret:v1:/);
    expect(row!.headers).not.toContain('tenant-secret-value');
  });

  it('re-encrypts header values with the new key when the key rotates', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-cp-')), 'rotation.db')}`;
    const rotated = { id: 'v2', key: new Uint8Array(32).fill(9) };
    {
      const { backend, domain } = await makeFileStore(url, createFactorySecretEncryption({ primary: testKey }));
      saved(await domain.create({ owner, createdBy: 'admin', input: endpoint({ headers }) }));
      await backend.close();
    }
    {
      const { backend } = await makeFileStore(
        url,
        createFactorySecretEncryption({ primary: rotated, previous: [testKey] }),
      );
      await backend.close();
    }

    // The old key is gone, so only a re-encrypted row can still be read.
    const { domain } = await makeFileStore(url, createFactorySecretEncryption({ primary: rotated }));
    expect((await domain.get({ owner, providerId: 'my-llm' }))!.headers).toMatchObject([
      { name: 'X-Tenant', value: 'tenant-secret-value' },
      { name: 'X-Region', value: 'eu-west' },
    ]);
  });

  // The Factory never returns a secret header value, so an edit names the
  // header without its value to keep it.
  it('keeps a saved header value by name on an edit, ignoring case', async () => {
    const seed = await createFactoryStorageForTests();
    saved(await seed.customProviders.create({ owner, createdBy: 'admin', input: endpoint({ headers }) }));

    const edited = saved(
      await seed.customProviders.update({
        owner,
        providerId: 'my-llm',
        input: endpoint({ headers: [{ name: 'x-tenant' }, { name: 'X-Region', value: 'us-east' }] }),
      }),
    );

    expect(edited.headers).toEqual([
      { name: 'x-tenant', value: 'tenant-secret-value', secret: true },
      { name: 'X-Region', value: 'us-east', secret: false },
    ]);
  });

  it.each([
    ['a header with no value and nothing saved under its name', endpoint({ headers: [{ name: 'X-New' }] })],
    [
      'a secret header turned plain without its value',
      endpoint({ headers: [{ name: 'X-Tenant', secret: false }, { name: 'X-Region' }] }),
    ],
    [
      'a kept secret header on another origin',
      endpoint({ url: 'https://other.example.com/v1', headers: [{ name: 'X-Tenant' }] }),
    ],
    ['the saved list on another origin', endpoint({ url: 'https://other.example.com/v1' })],
  ])('refuses an edit with %s and leaves the row unchanged', async (_case, input) => {
    const seed = await createFactoryStorageForTests();
    saved(await seed.customProviders.create({ owner, createdBy: 'admin', input: endpoint({ headers }) }));

    expect(await seed.customProviders.update({ owner, providerId: 'my-llm', input })).toEqual({
      refused: 'header_value_required',
    });
    expect(await seed.customProviders.get({ owner, providerId: 'my-llm' })).toMatchObject({
      url: 'https://llm.example.com/v1',
      headers: [{ value: 'tenant-secret-value' }, { value: 'eu-west' }],
    });
  });

  it('moves plain headers to another origin, and secret ones when typed again', async () => {
    const seed = await createFactoryStorageForTests();
    saved(await seed.customProviders.create({ owner, createdBy: 'admin', input: endpoint({ headers }) }));

    const moved = saved(
      await seed.customProviders.update({
        owner,
        providerId: 'my-llm',
        input: endpoint({
          url: 'https://other.example.com/v1',
          headers: [{ name: 'X-Tenant', value: 'typed-again' }, { name: 'X-Region' }],
        }),
      }),
    );

    expect(moved.headers).toEqual([
      { name: 'X-Tenant', value: 'typed-again', secret: true },
      { name: 'X-Region', value: 'eu-west', secret: false },
    ]);
  });

  // Switching to x-api-key would otherwise send a kept custom x-api-key
  // header next to the key.
  it('refuses a scheme change that a kept header collides with', async () => {
    const seed = await createFactoryStorageForTests();
    saved(
      await seed.customProviders.create({
        owner,
        createdBy: 'admin',
        input: endpoint({ headers: [{ name: 'x-api-key', value: 'gateway-key' }] }),
      }),
    );

    expect(
      await seed.customProviders.update({ owner, providerId: 'my-llm', input: endpoint({ authScheme: 'x-api-key' }) }),
    ).toEqual({ refused: 'header_refused', problem: expect.stringContaining('x-api-key') });
  });

  it('keeps the last check through edits that leave the connection alone, and clears it otherwise', async () => {
    const seed = await createFactoryStorageForTests();
    const passed = { at: '2026-11-26T10:00:00.000Z', ok: true };
    saved(
      await seed.customProviders.create({
        owner,
        createdBy: 'admin',
        input: endpoint({ apiKey: 'sk-1', headers, lastCheck: passed }),
      }),
    );
    const update = (input: CustomProviderInput) => seed.customProviders.update({ owner, providerId: 'my-llm', input });
    const keptHeaders = [{ name: 'X-Tenant' }, { name: 'X-Region' }];

    // A new model list, or the same key and headers sent again, leaves the call unchanged.
    expect(saved(await update(endpoint({ models: ['m', 'n'] }))).lastCheck).toEqual(passed);
    expect(saved(await update(endpoint({ apiKey: 'sk-1', headers: keptHeaders }))).lastCheck).toEqual(passed);

    for (const changed of [
      endpoint({ url: 'https://llm.example.com/v2' }),
      endpoint({ apiKey: 'sk-2' }),
      endpoint({ authScheme: 'x-api-key' }),
      endpoint({ headers: [{ name: 'X-Tenant' }] }),
      endpoint({ headers: [{ name: 'X-Tenant' }, { name: 'X-Region', secret: true }] }),
    ]) {
      saved(await update(endpoint({ apiKey: 'sk-1', authScheme: 'bearer', headers, lastCheck: passed })));
      expect(saved(await update(changed)).lastCheck).toBeNull();
    }
  });

  it('records a check only while the row is still the one that was checked', async () => {
    const seed = await createFactoryStorageForTests();
    const checked = saved(await seed.customProviders.create({ owner, createdBy: 'admin', input: endpoint() }));
    const failed = { at: '2026-11-26T10:00:00.000Z', ok: false, message: 'HTTP 401 Unauthorized' };

    expect(
      await seed.customProviders.recordCheck({ owner, providerId: 'my-llm', checked, lastCheck: failed }),
    ).toMatchObject({ lastCheck: failed, updatedAt: checked.updatedAt });

    // An edit lands while a second check is running against the old settings.
    const beforeEdit = (await seed.customProviders.get({ owner, providerId: 'my-llm' }))!;
    saved(
      await seed.customProviders.update({
        owner,
        providerId: 'my-llm',
        input: endpoint({ url: 'https://llm.example.com/v2' }),
      }),
    );
    expect(
      await seed.customProviders.recordCheck({
        owner,
        providerId: 'my-llm',
        checked: beforeEdit,
        lastCheck: { at: '2026-11-26T10:01:00.000Z', ok: true },
      }),
    ).toBeNull();
    expect((await seed.customProviders.get({ owner, providerId: 'my-llm' }))!.lastCheck).toBeNull();

    // A save that passed its test against the old row does not stamp the row that replaced it.
    const stale = saved(
      await seed.customProviders.update({
        owner,
        providerId: 'my-llm',
        input: endpoint({ url: 'https://llm.example.com/v2', lastCheck: { at: '2026-11-26T10:02:00.000Z', ok: true } }),
        checked: beforeEdit,
      }),
    );
    expect(stale.lastCheck).toBeNull();
  });

  it('reads and edits a row written before headers, schemes and checks existed', async () => {
    const url = `file:${join(mkdtempSync(join(tmpdir(), 'factory-cp-')), 'legacy-columns.db')}`;
    {
      const backend = new LibSQLFactoryStorage({ id: 'custom-providers-legacy-columns', url });
      await backend.init();
      await backend.ensureCollections([
        {
          name: 'custom_providers',
          columns: {
            id: { type: 'uuid-pk' },
            org_id: { type: 'text' },
            created_by: { type: 'text' },
            provider_id: { type: 'text' },
            name: { type: 'text' },
            url: { type: 'text' },
            api_key: { type: 'text', nullable: true },
            models: { type: 'json' },
            created_at: { type: 'timestamp' },
            updated_at: { type: 'timestamp' },
          },
        },
      ]);
      await backend.ops.insertOne('custom_providers', {
        org_id: 'org-1',
        created_by: 'admin',
        provider_id: 'my-llm',
        name: 'My LLM',
        url: 'https://llm.example.com/v1',
        api_key: JSON.stringify('sk-legacy'),
        models: ['m'],
        created_at: new Date(),
        updated_at: new Date(),
      });
      await backend.close();
    }

    const { domain } = await makeFileStore(url);
    await expect(domain.ensureReady()).resolves.toBeUndefined();
    expect(await domain.get({ owner, providerId: 'my-llm' })).toMatchObject({
      apiKey: 'sk-legacy',
      authScheme: null,
      headers: [],
      lastCheck: null,
    });
    expect(
      saved(await domain.update({ owner, providerId: 'my-llm', input: endpoint({ headers }) })).headers,
    ).toHaveLength(2);
  });
});
