import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';
import { ModelPackNameConflictError } from './base.js';

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

  it('stores one active pack snapshot per organization and user', async () => {
    const seed = await createFactoryStorageForTests();
    const firstModels = { build: 'openai/gpt-5.6', plan: 'openai/gpt-5.6', fast: 'openai/gpt-5.4-mini' };
    const secondModels = {
      build: 'anthropic/claude-opus-5',
      plan: 'anthropic/claude-fable-5',
      fast: 'anthropic/claude-haiku-4-5',
    };

    await seed.modelPacks.setActive({ orgId: 'org-1', userId: 'user-1', packId: 'openai', models: firstModels });
    await seed.modelPacks.setActive({ orgId: 'org-1', userId: 'user-1', packId: 'anthropic', models: secondModels });

    expect(await seed.modelPacks.getActive({ orgId: 'org-1', userId: 'user-1' })).toMatchObject({
      packId: 'anthropic',
      models: secondModels,
    });
    expect(await seed.modelPacks.getActive({ orgId: 'org-1', userId: 'user-2' })).toBeNull();
  });

  it('updates active snapshots when a custom pack changes and allows clearing the default', async () => {
    const seed = await createFactoryStorageForTests();
    const originalModels = { build: 'openai/gpt-5.5', plan: 'openai/gpt-5.5', fast: 'openai/gpt-5.4-mini' };
    const updatedModels = { build: 'openai/gpt-5.6', plan: 'openai/gpt-5.6', fast: 'openai/gpt-5.4-mini' };
    const pack = await seed.modelPacks.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Default', models: originalModels },
    });
    await seed.modelPacks.setActive({
      orgId: 'org-1',
      userId: 'user-1',
      packId: `custom:${pack.id}`,
      models: originalModels,
    });

    await seed.modelPacks.upsert({
      orgId: 'org-1',
      userId: 'user-2',
      input: { name: 'Default', models: updatedModels },
    });

    expect(await seed.modelPacks.getActive({ orgId: 'org-1', userId: 'user-1' })).toMatchObject({
      models: updatedModels,
    });
    expect(await seed.modelPacks.clearActive({ orgId: 'org-1', userId: 'user-1' })).toBe(true);
    expect(await seed.modelPacks.getActive({ orgId: 'org-1', userId: 'user-1' })).toBeNull();
    expect(await seed.modelPacks.clearActive({ orgId: 'org-1', userId: 'user-1' })).toBe(false);
  });

  it('lists packs alphabetically and deletes only within the org', async () => {
    const seed = await createFactoryStorageForTests();

    const models = { build: 'openai/gpt-5.6', plan: 'openai/gpt-5.6', fast: 'openai/gpt-5.4-mini' };
    await seed.modelPacks.upsert({ orgId: 'org-1', userId: 'user-1', input: { name: 'Zeta', models } });
    const alpha = await seed.modelPacks.upsert({ orgId: 'org-1', userId: 'user-1', input: { name: 'Alpha', models } });
    await seed.modelPacks.setActive({
      orgId: 'org-1',
      userId: 'user-1',
      packId: `custom:${alpha.id}`,
      models,
    });

    expect((await seed.modelPacks.list({ orgId: 'org-1' })).map(pack => pack.name)).toEqual(['Alpha', 'Zeta']);

    expect(await seed.modelPacks.delete({ orgId: 'org-2', id: alpha.id })).toBe(false);
    expect(await seed.modelPacks.delete({ orgId: 'org-1', id: alpha.id })).toBe(true);
    expect((await seed.modelPacks.list({ orgId: 'org-1' })).map(pack => pack.name)).toEqual(['Zeta']);
    expect(await seed.modelPacks.getActive({ orgId: 'org-1', userId: 'user-1' })).toBeNull();
  });

  it('edits a pack in place, keeping its id and created_at', async () => {
    const seed = await createFactoryStorageForTests();
    const originalModels = { build: 'openai/gpt-5.5', plan: 'openai/gpt-5.5', fast: 'openai/gpt-5.4-mini' };
    const updatedModels = { build: 'openai/gpt-5.6', plan: 'openai/gpt-5.6', fast: 'openai/gpt-5.4-mini' };
    const pack = await seed.modelPacks.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Default', models: originalModels },
    });

    const updated = await seed.modelPacks.update({
      orgId: 'org-1',
      id: pack.id,
      input: { name: 'Renamed', models: updatedModels },
    });

    expect(updated).toMatchObject({
      id: pack.id,
      orgId: 'org-1',
      createdBy: 'user-1',
      name: 'Renamed',
      models: updatedModels,
    });
    // In-place: the original row keeps its identity instead of a second row appearing.
    expect(updated?.createdAt).toEqual(pack.createdAt);
    expect(await seed.modelPacks.list({ orgId: 'org-1' })).toHaveLength(1);
    expect(await seed.modelPacks.get({ orgId: 'org-1', id: pack.id })).toMatchObject({ name: 'Renamed' });
  });

  it('refreshes an active default snapshot when the pack is edited', async () => {
    const seed = await createFactoryStorageForTests();
    const originalModels = { build: 'openai/gpt-5.5', plan: 'openai/gpt-5.5', fast: 'openai/gpt-5.4-mini' };
    const updatedModels = { build: 'openai/gpt-5.6', plan: 'openai/gpt-5.6', fast: 'openai/gpt-5.4-mini' };
    const pack = await seed.modelPacks.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Default', models: originalModels },
    });
    await seed.modelPacks.setActive({
      orgId: 'org-1',
      userId: 'user-1',
      packId: `custom:${pack.id}`,
      models: originalModels,
    });

    await seed.modelPacks.update({
      orgId: 'org-1',
      id: pack.id,
      input: { name: 'Renamed', models: updatedModels },
    });

    expect(await seed.modelPacks.getActive({ orgId: 'org-1', userId: 'user-1' })).toMatchObject({
      packId: `custom:${pack.id}`,
      models: updatedModels,
    });
  });

  it('allows an edit that keeps its own name even when other packs exist', async () => {
    const seed = await createFactoryStorageForTests();
    const models = { build: 'openai/gpt-5.5', plan: 'openai/gpt-5.5', fast: 'openai/gpt-5.4-mini' };
    const nextModels = { build: 'openai/gpt-5.6', plan: 'openai/gpt-5.6', fast: 'openai/gpt-5.4-mini' };
    const alpha = await seed.modelPacks.upsert({ orgId: 'org-1', userId: 'user-1', input: { name: 'Alpha', models } });
    await seed.modelPacks.upsert({ orgId: 'org-1', userId: 'user-1', input: { name: 'Beta', models } });

    const updated = await seed.modelPacks.update({
      orgId: 'org-1',
      id: alpha.id,
      input: { name: 'Alpha', models: nextModels },
    });

    expect(updated).toMatchObject({ id: alpha.id, name: 'Alpha', models: nextModels });
    expect(await seed.modelPacks.list({ orgId: 'org-1' })).toHaveLength(2);
  });

  it('rejects renaming a pack onto another pack name in the same org', async () => {
    const seed = await createFactoryStorageForTests();
    const models = { build: 'openai/gpt-5.5', plan: 'openai/gpt-5.5', fast: 'openai/gpt-5.4-mini' };
    const alpha = await seed.modelPacks.upsert({ orgId: 'org-1', userId: 'user-1', input: { name: 'Alpha', models } });
    await seed.modelPacks.upsert({ orgId: 'org-1', userId: 'user-1', input: { name: 'Beta', models } });

    await expect(
      seed.modelPacks.update({ orgId: 'org-1', id: alpha.id, input: { name: 'Beta', models } }),
    ).rejects.toBeInstanceOf(ModelPackNameConflictError);

    expect((await seed.modelPacks.get({ orgId: 'org-1', id: alpha.id }))?.name).toBe('Alpha');
    expect(await seed.modelPacks.list({ orgId: 'org-1' })).toHaveLength(2);
  });

  it('returns null when editing a pack that is missing or belongs to another org', async () => {
    const seed = await createFactoryStorageForTests();
    const models = { build: 'openai/gpt-5.5', plan: 'openai/gpt-5.5', fast: 'openai/gpt-5.4-mini' };
    const pack = await seed.modelPacks.upsert({ orgId: 'org-1', userId: 'user-1', input: { name: 'Alpha', models } });

    expect(
      await seed.modelPacks.update({ orgId: 'other-org', id: pack.id, input: { name: 'Alpha', models } }),
    ).toBeNull();
    expect(
      await seed.modelPacks.update({ orgId: 'org-1', id: 'missing', input: { name: 'Alpha', models } }),
    ).toBeNull();
  });
});
