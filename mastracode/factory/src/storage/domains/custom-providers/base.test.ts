import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

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
});
