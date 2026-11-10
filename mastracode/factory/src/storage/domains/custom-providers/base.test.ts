import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactorySecretEncryption } from '../../../secret-encryption.js';
import { createFactoryStorageForTests } from '../../test-utils.js';
import { CustomProvidersStorage } from './base.js';

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
  // secret string, exactly as `upsert` wrote it before this change.
  const { backend, domain } = await makeFileStore(url);
  await domain.upsert({
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

describe('CustomProvidersStorage', () => {
  it('creates an org-owned provider and scopes reads to the organization', async () => {
    const seed = await createFactoryStorageForTests();

    const provider = await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-1',
      input: {
        providerId: 'my-llm',
        name: 'My LLM',
        url: 'https://llm.example.com/v1',
        apiKey: 'sk-secret',
        models: ['fast', 'smart'],
      },
    });

    expect(provider).toMatchObject({
      orgId: 'org-1',
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

  it('resolves concurrent creates of the same provider without either failing', async () => {
    const seed = await createFactoryStorageForTests();
    const input = (url: string) => ({
      providerId: 'my-llm',
      name: 'My LLM',
      url,
      apiKey: 'sk-secret',
      models: ['fast'],
    });

    const [a, b] = await Promise.all([
      seed.customProviders.upsert({
        owner: { orgId: 'org-1' },
        createdBy: 'user-1',
        input: input('https://a.example.com'),
      }),
      seed.customProviders.upsert({
        owner: { orgId: 'org-1' },
        createdBy: 'user-2',
        input: input('https://b.example.com'),
      }),
    ]);

    // Both writes succeed against the single row; the insert-race loser
    // lands as an update on the winning row.
    expect(a.providerId).toBe('my-llm');
    expect(b.providerId).toBe('my-llm');
    const rows = await seed.customProviders.list({ orgId: 'org-1' });
    expect(rows).toHaveLength(1);
    expect(['https://a.example.com', 'https://b.example.com']).toContain(rows[0]!.url);
  });

  it('replaces a provider by (org, providerId) and keeps its saved key when the edit leaves the key out', async () => {
    const seed = await createFactoryStorageForTests();

    const first = await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-1',
      input: { providerId: 'my-llm', name: 'My LLM', url: 'https://a.example.com', apiKey: 'sk-1', models: ['m1'] },
    });
    const second = await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-2',
      input: { providerId: 'my-llm', name: 'My LLM', url: 'https://b.example.com', models: ['m1', 'm2'] },
    });

    expect(second.id).toBe(first.id);
    expect(second.url).toBe('https://b.example.com');
    // The settings form sends no key unless the user types a new one.
    expect(second.apiKey).toBe('sk-1');
    expect(second.models).toEqual(['m1', 'm2']);
    expect(await seed.customProviders.list({ orgId: 'org-1' })).toHaveLength(1);

    // Same provider id in another org is independent.
    const otherOrg = await seed.customProviders.upsert({
      owner: { orgId: 'org-2' },
      createdBy: 'user-3',
      input: { providerId: 'my-llm', name: 'My LLM', url: 'https://c.example.com', models: [] },
    });
    expect(otherOrg.id).not.toBe(first.id);
  });

  it('renames via previousProviderId without leaving the old row behind', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-1',
      input: { providerId: 'old-name', name: 'Old Name', url: 'https://a.example.com', models: ['m'] },
    });
    await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-1',
      input: { providerId: 'new-name', name: 'New Name', url: 'https://a.example.com', models: ['m'] },
      previousProviderId: 'old-name',
    });

    const providers = await seed.customProviders.list({ orgId: 'org-1' });
    expect(providers.map(p => p.providerId)).toEqual(['new-name']);
  });

  it('renames in place — same row survives with original provenance', async () => {
    const seed = await createFactoryStorageForTests();

    const original = await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-1',
      input: { providerId: 'old-name', name: 'Old Name', url: 'https://a.example.com', models: ['m'] },
    });
    const renamed = await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-2',
      input: { providerId: 'new-name', name: 'New Name', url: 'https://b.example.com', models: ['m'] },
      previousProviderId: 'old-name',
    });

    // The common rename path is a single atomic in-place update: the row keeps
    // its id and provenance, so there is no delete/insert gap that could lose it.
    expect(renamed.id).toBe(original.id);
    expect(renamed.createdBy).toBe('user-1');
    expect(renamed.name).toBe('New Name');
    expect(renamed.url).toBe('https://b.example.com');
  });

  it('renames onto an existing provider id by overwriting it and removing the old row', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-1',
      input: { providerId: 'source', name: 'Source', url: 'https://source.example.com', models: ['m'] },
    });
    const target = await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-1',
      input: { providerId: 'target', name: 'Target', url: 'https://target.example.com', models: ['m'] },
    });

    const merged = await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-2',
      input: { providerId: 'target', name: 'Target', url: 'https://merged.example.com', models: ['m2'] },
      previousProviderId: 'source',
    });

    expect(merged.id).toBe(target.id);
    expect(merged.url).toBe('https://merged.example.com');
    const providers = await seed.customProviders.list({ orgId: 'org-1' });
    expect(providers.map(p => p.providerId)).toEqual(['target']);
  });

  it('keeps the saved key when a provider is renamed without retyping it', async () => {
    const seed = await createFactoryStorageForTests();
    const owner = { orgId: 'org-1' };

    await seed.customProviders.upsert({
      owner,
      createdBy: 'user-1',
      input: { providerId: 'old-name', name: 'Old Name', url: 'https://a.example.com', apiKey: 'sk-kept', models: [] },
    });
    const renamed = await seed.customProviders.upsert({
      owner,
      createdBy: 'user-1',
      input: { providerId: 'new-name', name: 'New Name', url: 'https://a.example.com', models: [] },
      previousProviderId: 'old-name',
    });
    expect(renamed.apiKey).toBe('sk-kept');

    // Renaming onto a name that already exists carries the edited provider's
    // key, not the key of the provider it replaces.
    await seed.customProviders.upsert({
      owner,
      createdBy: 'user-1',
      input: { providerId: 'taken', name: 'Taken', url: 'https://t.example.com', apiKey: 'sk-replaced', models: [] },
    });
    const merged = await seed.customProviders.upsert({
      owner,
      createdBy: 'user-1',
      input: { providerId: 'taken', name: 'Taken', url: 'https://a.example.com', models: [] },
      previousProviderId: 'new-name',
    });
    expect(merged.apiKey).toBe('sk-kept');
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
    await seed.customProviders.upsert({
      owner: organization,
      createdBy: 'admin',
      input: endpoint('https://org.example.com', 'sk-org'),
    });
    await seed.customProviders.upsert({
      owner: alice,
      createdBy: 'alice',
      input: endpoint('https://alice.example.com', 'sk-alice'),
    });
    await seed.customProviders.upsert({
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

  it('rename whose source row is already gone still creates the new provider', async () => {
    const seed = await createFactoryStorageForTests();

    const created = await seed.customProviders.upsert({
      owner: { orgId: 'org-1' },
      createdBy: 'user-1',
      input: { providerId: 'new-name', name: 'New Name', url: 'https://a.example.com', models: ['m'] },
      previousProviderId: 'vanished',
    });

    expect(created.providerId).toBe('new-name');
    expect(await seed.customProviders.list({ orgId: 'org-1' })).toHaveLength(1);
  });

  it('deletes only within the org', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.customProviders.upsert({
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
      await domain.upsert({
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
      const saved = await domain.upsert({
        owner: { orgId: 'org-1' },
        createdBy: 'user-1',
        input: {
          providerId: 'my-llm',
          name: 'My LLM',
          url: 'https://llm.example.com/v1',
          apiKey: lookalike,
          models: ['m'],
        },
      });
      expect(saved.apiKey).toBe(lookalike);
      await backend.close();
    }

    // A fresh boot migrates every row during init(); the lookalike must not fail it.
    const { domain } = await makeFileStore(url, encryption());
    await expect(domain.ensureReady()).resolves.toBeUndefined();
    const [provider] = await domain.list({ orgId: 'org-1' });
    expect(provider!.apiKey).toBe(lookalike);
  });
});
