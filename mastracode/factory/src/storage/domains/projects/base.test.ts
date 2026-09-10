import { describe, expect, it } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';

describe('FactoryProjectsStorage', () => {
  it('creates an org-owned project without any integration or repository', async () => {
    const seed = await createFactoryStorageForTests();

    const project = await seed.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Platform', description: 'Internal platform work' },
    });

    expect(project).toMatchObject({
      orgId: 'org-1',
      createdBy: 'user-1',
      name: 'Platform',
      description: 'Internal platform work',
      slackWorkItemsEnabled: false,
    });
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toEqual(project);
    expect(await seed.projects.get({ orgId: 'other-org', id: project.id })).toBeNull();
  });

  it('lists, updates, and deletes projects within their organization', async () => {
    const seed = await createFactoryStorageForTests();
    const first = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'First' } });
    const other = await seed.projects.create({ orgId: 'org-2', userId: 'user-2', input: { name: 'Other org' } });

    expect((await seed.projects.list({ orgId: 'org-1' })).map(project => project.id)).toEqual([first.id]);
    expect((await seed.projects.listAll()).map(project => project.id).sort()).toEqual([first.id, other.id].sort());

    const updated = await seed.projects.update({
      orgId: 'org-1',
      id: first.id,
      input: { name: 'Renamed', description: 'Now documented', slackWorkItemsEnabled: true },
    });
    expect(updated).toMatchObject({
      name: 'Renamed',
      description: 'Now documented',
      slackWorkItemsEnabled: true,
    });
    expect(await seed.projects.update({ orgId: 'org-2', id: first.id, input: { name: 'Nope' } })).toBeNull();

    expect(await seed.projects.delete({ orgId: 'org-2', id: first.id })).toBeNull();
    expect(await seed.projects.delete({ orgId: 'org-1', id: first.id })).toMatchObject({ id: first.id });
    expect(await seed.projects.get({ orgId: 'org-1', id: first.id })).toBeNull();
  });

  it('round-trips work and review model overrides and clears them to null', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({
      orgId: 'org-1',
      userId: 'user-1',
      input: { name: 'Mastra', defaultModelId: 'anthropic/claude-opus-5' },
    });

    expect(project).toMatchObject({
      defaultModelId: 'anthropic/claude-opus-5',
      workModelId: null,
      reviewModelId: null,
    });

    const updated = await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: {
        workModelId: 'anthropic/claude-fable-5',
        reviewModelId: 'openai/gpt-5',
      },
    });
    expect(updated).toMatchObject({
      defaultModelId: 'anthropic/claude-opus-5',
      workModelId: 'anthropic/claude-fable-5',
      reviewModelId: 'openai/gpt-5',
    });

    const nameOnly = await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { name: 'Mastra Factory' },
    });
    expect(nameOnly).toMatchObject({
      workModelId: 'anthropic/claude-fable-5',
      reviewModelId: 'openai/gpt-5',
    });

    const cleared = await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { workModelId: null, reviewModelId: null },
    });
    expect(cleared).toMatchObject({ workModelId: null, reviewModelId: null });
  });
});
