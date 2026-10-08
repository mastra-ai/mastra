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

  it('round-trips every environment field and clears them with null', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Env' } });
    expect(project).toMatchObject({
      sandboxWorkdir: null,
      sandboxSettings: null,
      workspaceSetupCommand: null,
      activeTemplateId: null,
      activeTemplateHeads: null,
    });

    const environment = {
      sandboxWorkdir: '/home/user/workspace',
      sandboxSettings: { cpuCount: 8, memoryMb: 16384 },
      workspaceSetupCommand: 'touch .ready',
      activeTemplateId: 'tpl-1',
      activeTemplateHeads: { 'mastra-ai/mastra': 'abc123' },
    };
    expect(await seed.projects.update({ orgId: 'org-1', id: project.id, input: environment })).toMatchObject(
      environment,
    );
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject(environment);

    const cleared = {
      sandboxWorkdir: null,
      sandboxSettings: null,
      workspaceSetupCommand: null,
      activeTemplateId: null,
      activeTemplateHeads: null,
    };
    expect(await seed.projects.update({ orgId: 'org-1', id: project.id, input: cleared })).toMatchObject(cleared);
  });
});

describe('FactoryProjectsStorage builds', () => {
  it('defaults the build columns and round-trips them', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'P' } });
    expect(project).toMatchObject({
      lastBuildId: null,
      lastBuildAttemptedAt: null,
      buildOnPushEnabled: false,
      buildPushDebounceMinutes: 10,
    });

    const at = new Date('2026-10-08T10:00:00.000Z');
    const updated = await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { lastBuildId: 'tpl_1', lastBuildAttemptedAt: at, buildOnPushEnabled: true, buildPushDebounceMinutes: 3 },
    });
    expect(updated).toMatchObject({
      lastBuildId: 'tpl_1',
      lastBuildAttemptedAt: at,
      buildOnPushEnabled: true,
      buildPushDebounceMinutes: 3,
    });
  });

  it('claimBuildAttempt wins once per debounce window', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'P' } });
    const t0 = new Date('2026-10-08T10:00:00.000Z');

    expect(await seed.projects.claimBuildAttempt({ id: project.id, debounceMinutes: 10, now: t0 })).toBe(true);
    const afterFirst = await seed.projects.getById({ id: project.id });
    expect(afterFirst?.lastBuildAttemptedAt).toEqual(t0);

    const t1 = new Date(t0.getTime() + 9 * 60_000);
    expect(await seed.projects.claimBuildAttempt({ id: project.id, debounceMinutes: 10, now: t1 })).toBe(false);
    expect((await seed.projects.getById({ id: project.id }))?.lastBuildAttemptedAt).toEqual(t0);

    const t2 = new Date(t0.getTime() + 10 * 60_000);
    expect(await seed.projects.claimBuildAttempt({ id: project.id, debounceMinutes: 10, now: t2 })).toBe(true);
    expect((await seed.projects.getById({ id: project.id }))?.lastBuildAttemptedAt).toEqual(t2);

    // Two concurrent claims on a fresh window: exactly one wins.
    const t3 = new Date(t2.getTime() + 60 * 60_000);
    const results = await Promise.all([
      seed.projects.claimBuildAttempt({ id: project.id, debounceMinutes: 10, now: t3 }),
      seed.projects.claimBuildAttempt({ id: project.id, debounceMinutes: 10, now: t3 }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
