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

async function seedLegacyRawApiKeyRow(url: string): Promise<void> {
  // Simulate a pre-encryption deployment: the row's api_key is the bare
  // secret string, exactly as `upsert` wrote it before this change.
  const { backend, domain } = await makeFileStore(url);
  await domain.upsert({
    orgId: 'org-1',
    userId: 'user-1',
    input: { providerId: 'legacy-llm', name: 'Legacy LLM', url: 'https://llm.example.com/v1', models: ['m'] },
  });
  await backend.ops.updateMany(
    'custom_providers',
    { org_id: 'org-1', provider_id: 'legacy-llm' },
    {
      api_key: 'sk-ant-api03-raw-legacy-key',
    },
  );
  await backend.close();
}

const testKey = { id: 'v1', key: new Uint8Array(32).fill(7) };

describe('CustomProvidersStorage', () => {
  it('creates an org-owned provider and scopes reads to the organization', async () => {
    const seed = await createFactoryStorageForTests();

    const provider = await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-1',
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
      seed.customProviders.upsert({ orgId: 'org-1', userId: 'user-1', input: input('https://a.example.com') }),
      seed.customProviders.upsert({ orgId: 'org-1', userId: 'user-2', input: input('https://b.example.com') }),
    ]);

    // Both writes succeed against the single row; the insert-race loser
    // lands as an update on the winning row.
    expect(a.providerId).toBe('my-llm');
    expect(b.providerId).toBe('my-llm');
    const rows = await seed.customProviders.list({ orgId: 'org-1' });
    expect(rows).toHaveLength(1);
    expect(['https://a.example.com', 'https://b.example.com']).toContain(rows[0]!.url);
  });

  it('upserts by (org, providerId) with wholesale replace — absent apiKey clears the key', async () => {
    const seed = await createFactoryStorageForTests();

    const first = await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: { providerId: 'my-llm', name: 'My LLM', url: 'https://a.example.com', apiKey: 'sk-1', models: ['m1'] },
    });
    const second = await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-2',
      input: { providerId: 'my-llm', name: 'My LLM', url: 'https://b.example.com', models: ['m1', 'm2'] },
    });

    expect(second.id).toBe(first.id);
    expect(second.url).toBe('https://b.example.com');
    expect(second.apiKey).toBeNull();
    expect(second.models).toEqual(['m1', 'm2']);
    expect(await seed.customProviders.list({ orgId: 'org-1' })).toHaveLength(1);

    // Same provider id in another org is independent.
    const otherOrg = await seed.customProviders.upsert({
      orgId: 'org-2',
      userId: 'user-3',
      input: { providerId: 'my-llm', name: 'My LLM', url: 'https://c.example.com', models: [] },
    });
    expect(otherOrg.id).not.toBe(first.id);
  });

  it('renames via previousProviderId without leaving the old row behind', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: { providerId: 'old-name', name: 'Old Name', url: 'https://a.example.com', models: ['m'] },
    });
    await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: { providerId: 'new-name', name: 'New Name', url: 'https://a.example.com', models: ['m'] },
      previousProviderId: 'old-name',
    });

    const providers = await seed.customProviders.list({ orgId: 'org-1' });
    expect(providers.map(p => p.providerId)).toEqual(['new-name']);
  });

  it('renames in place — same row survives with original provenance', async () => {
    const seed = await createFactoryStorageForTests();

    const original = await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: { providerId: 'old-name', name: 'Old Name', url: 'https://a.example.com', models: ['m'] },
    });
    const renamed = await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-2',
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
      orgId: 'org-1',
      userId: 'user-1',
      input: { providerId: 'source', name: 'Source', url: 'https://source.example.com', models: ['m'] },
    });
    const target = await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: { providerId: 'target', name: 'Target', url: 'https://target.example.com', models: ['m'] },
    });

    const merged = await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-2',
      input: { providerId: 'target', name: 'Target', url: 'https://merged.example.com', models: ['m2'] },
      previousProviderId: 'source',
    });

    expect(merged.id).toBe(target.id);
    expect(merged.url).toBe('https://merged.example.com');
    const providers = await seed.customProviders.list({ orgId: 'org-1' });
    expect(providers.map(p => p.providerId)).toEqual(['target']);
  });

  it('rename whose source row is already gone still creates the new provider', async () => {
    const seed = await createFactoryStorageForTests();

    const created = await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: { providerId: 'new-name', name: 'New Name', url: 'https://a.example.com', models: ['m'] },
      previousProviderId: 'vanished',
    });

    expect(created.providerId).toBe('new-name');
    expect(await seed.customProviders.list({ orgId: 'org-1' })).toHaveLength(1);
  });

  it('deletes only within the org', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.customProviders.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: { providerId: 'my-llm', name: 'My LLM', url: 'https://a.example.com', models: [] },
    });

    expect(await seed.customProviders.delete({ orgId: 'org-2', providerId: 'my-llm' })).toBe(false);
    expect(await seed.customProviders.delete({ orgId: 'org-1', providerId: 'my-llm' })).toBe(true);
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
});
