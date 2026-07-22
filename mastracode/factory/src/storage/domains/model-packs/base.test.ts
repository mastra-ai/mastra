import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils';

describe('ModelPacksStorage', () => {
  it('creates an org-owned pack and scopes reads to the organization', async () => {
    const seed = await createFactoryStorageForTests();

    const pack = await seed.modelPacks.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: {
        name: 'Team default',
        models: {
          build: 'anthropic/claude-fable-5',
          plan: 'anthropic/claude-fable-5',
          fast: 'anthropic/claude-haiku-4-5',
        },
      },
    });

    expect(pack).toMatchObject({
      orgId: 'org-1',
      createdBy: 'user-1',
      name: 'Team default',
      models: {
        build: 'anthropic/claude-fable-5',
        plan: 'anthropic/claude-fable-5',
        fast: 'anthropic/claude-haiku-4-5',
      },
    });
    expect(await seed.modelPacks.get({ orgId: 'org-1', id: pack.id })).toEqual(pack);
    expect(await seed.modelPacks.get({ orgId: 'other-org', id: pack.id })).toBeNull();
    expect(await seed.modelPacks.list({ orgId: 'other-org' })).toEqual([]);
  });

  it('upserts by (org, name) instead of duplicating packs', async () => {
    const seed = await createFactoryStorageForTests();

    const first = await seed.modelPacks.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: {
        name: 'Default',
        models: { build: 'openai/gpt-5.5', plan: 'openai/gpt-5.5', fast: 'openai/gpt-5.4-mini' },
      },
    });
    const second = await seed.modelPacks.upsert({
      orgId: 'org-1',
      userId: 'user-2',
      input: {
        name: 'Default',
        models: { build: 'openai/gpt-5.6', plan: 'openai/gpt-5.6', fast: 'openai/gpt-5.4-mini' },
      },
    });

    expect(second.id).toBe(first.id);
    expect(second.models.build).toBe('openai/gpt-5.6');
    expect(await seed.modelPacks.list({ orgId: 'org-1' })).toHaveLength(1);

    // Same name in another org is an independent pack.
    const otherOrg = await seed.modelPacks.upsert({
      orgId: 'org-2',
      userId: 'user-3',
      input: {
        name: 'Default',
        models: { build: 'openai/gpt-5.6', plan: 'openai/gpt-5.6', fast: 'openai/gpt-5.4-mini' },
      },
    });
    expect(otherOrg.id).not.toBe(first.id);
  });

  it('lists packs alphabetically and deletes only within the org', async () => {
    const seed = await createFactoryStorageForTests();

    const models = { build: 'openai/gpt-5.6', plan: 'openai/gpt-5.6', fast: 'openai/gpt-5.4-mini' };
    await seed.modelPacks.upsert({ orgId: 'org-1', userId: 'user-1', input: { name: 'Zeta', models } });
    const alpha = await seed.modelPacks.upsert({ orgId: 'org-1', userId: 'user-1', input: { name: 'Alpha', models } });

    expect((await seed.modelPacks.list({ orgId: 'org-1' })).map(pack => pack.name)).toEqual(['Alpha', 'Zeta']);

    expect(await seed.modelPacks.delete({ orgId: 'org-2', id: alpha.id })).toBe(false);
    expect(await seed.modelPacks.delete({ orgId: 'org-1', id: alpha.id })).toBe(true);
    expect((await seed.modelPacks.list({ orgId: 'org-1' })).map(pack => pack.name)).toEqual(['Zeta']);
  });
});
