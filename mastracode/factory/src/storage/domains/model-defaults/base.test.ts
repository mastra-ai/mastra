import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

describe('ModelDefaultsStorage', () => {
  it('returns null when no default has been set', async () => {
    const seed = await createFactoryStorageForTests();

    expect(await seed.modelDefaults.get({ orgId: 'org-1', userId: 'user-1' })).toBeNull();
  });

  it('sets and reads a user default model', async () => {
    const seed = await createFactoryStorageForTests();

    const record = await seed.modelDefaults.set({
      orgId: 'org-1',
      userId: 'user-1',
      modelId: 'anthropic/claude-opus-5',
    });

    expect(record).toMatchObject({
      orgId: 'org-1',
      userId: 'user-1',
      modelId: 'anthropic/claude-opus-5',
    });
    expect(await seed.modelDefaults.get({ orgId: 'org-1', userId: 'user-1' })).toEqual(record);
  });

  it('upserts one row per organization and user', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId: 'openai/gpt-5.5' });
    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId: 'openai/gpt-5.6' });

    expect(await seed.modelDefaults.get({ orgId: 'org-1', userId: 'user-1' })).toMatchObject({
      modelId: 'openai/gpt-5.6',
    });
  });

  it('isolates defaults by organization and user', async () => {
    const seed = await createFactoryStorageForTests();

    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId: 'openai/gpt-5.6' });
    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-2', modelId: 'anthropic/claude-opus-5' });
    await seed.modelDefaults.set({ orgId: 'org-2', userId: 'user-1', modelId: 'google/gemini-2.5-pro' });

    expect(await seed.modelDefaults.get({ orgId: 'org-1', userId: 'user-1' })).toMatchObject({
      modelId: 'openai/gpt-5.6',
    });
    expect(await seed.modelDefaults.get({ orgId: 'org-1', userId: 'user-2' })).toMatchObject({
      modelId: 'anthropic/claude-opus-5',
    });
    expect(await seed.modelDefaults.get({ orgId: 'org-2', userId: 'user-1' })).toMatchObject({
      modelId: 'google/gemini-2.5-pro',
    });
  });

  it('clears only the requested user default', async () => {
    const seed = await createFactoryStorageForTests();
    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-1', modelId: 'openai/gpt-5.6' });
    await seed.modelDefaults.set({ orgId: 'org-1', userId: 'user-2', modelId: 'anthropic/claude-opus-5' });

    expect(await seed.modelDefaults.clear({ orgId: 'org-1', userId: 'user-1' })).toBe(true);
    expect(await seed.modelDefaults.get({ orgId: 'org-1', userId: 'user-1' })).toBeNull();
    expect(await seed.modelDefaults.get({ orgId: 'org-1', userId: 'user-2' })).not.toBeNull();
    expect(await seed.modelDefaults.clear({ orgId: 'org-1', userId: 'user-1' })).toBe(false);
  });
});
