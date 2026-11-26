import { describe, expect, it } from 'vitest';

import type { ModelPack } from '../../../model-packs.js';
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

  it('reads a row saved before packs as a single Default pack', async () => {
    const seed = await createFactoryStorageForTests();
    const user = { orgId: 'org-1', userId: 'user-1' };
    await seed.storage.ops.insertOne('user_default_models', {
      org_id: 'org-1',
      user_id: 'user-1',
      model_id: 'anthropic/claude-opus-5.5',
      thinking_level: 'high',
      updated_at: new Date(),
    });

    expect(await seed.modelDefaults.get(user)).toMatchObject({
      modelId: 'anthropic/claude-opus-5.5',
      thinkingLevel: 'high',
      modelPacks: [
        { id: 'default', name: 'Default', models: [{ modelId: 'anthropic/claude-opus-5.5', thinkingLevel: 'high' }] },
      ],
      defaultModelPackId: 'default',
    });
  });

  it('stores personal packs, mirrors the default pack into the default model, and deletes the row when empty', async () => {
    const seed = await createFactoryStorageForTests();
    const user = { orgId: 'org-1', userId: 'user-1' };
    const build: ModelPack = {
      id: 'build',
      name: 'Build',
      models: [
        { modelId: 'anthropic/claude-opus-5.5', thinkingLevel: 'medium' },
        { modelId: 'openai/gpt-5.6-sol', thinkingLevel: 'high' },
      ],
    };
    const cheap: ModelPack = {
      id: 'cheap',
      name: 'Cheap',
      models: [{ modelId: 'deepseek/deepseek-flash', thinkingLevel: 'low' }],
    };

    expect(
      await seed.modelDefaults.setModelPacks({ ...user, modelPacks: [build, cheap], defaultModelPackId: 'cheap' }),
    ).toMatchObject({ modelId: 'deepseek/deepseek-flash', thinkingLevel: 'low', defaultModelPackId: 'cheap' });

    await seed.modelDefaults.setModelPacks({ ...user, modelPacks: [build, cheap], defaultModelPackId: 'build' });
    await seed.modelDefaults.set({ ...user, modelId: 'openai/gpt-5.6-sol' });
    expect(await seed.modelDefaults.get(user)).toMatchObject({
      modelId: 'openai/gpt-5.6-sol',
      thinkingLevel: 'medium',
      modelPacks: [{ ...build, models: [{ modelId: 'openai/gpt-5.6-sol', thinkingLevel: 'medium' }] }, cheap],
      defaultModelPackId: 'build',
    });

    expect(await seed.modelDefaults.setModelPacks({ ...user, modelPacks: [], defaultModelPackId: null })).toBeNull();
    expect(await seed.modelDefaults.get(user)).toBeNull();
  });
});
