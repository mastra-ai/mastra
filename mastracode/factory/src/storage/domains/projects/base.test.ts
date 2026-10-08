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
      sandboxCpuCount: null,
      sandboxMemoryMb: null,
      sandboxIdleTimeoutMinutes: null,
      workspaceSetupCommand: null,
      activeTemplateId: null,
      activeTemplateHeads: null,
    });

    const environment = {
      sandboxWorkdir: '/home/user/workspace',
      sandboxCpuCount: 8,
      sandboxMemoryMb: 16384,
      sandboxIdleTimeoutMinutes: 30,
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
      sandboxCpuCount: null,
      sandboxMemoryMb: null,
      sandboxIdleTimeoutMinutes: null,
      workspaceSetupCommand: null,
      activeTemplateId: null,
      activeTemplateHeads: null,
    };
    expect(await seed.projects.update({ orgId: 'org-1', id: project.id, input: cleared })).toMatchObject(cleared);
  });

  describe('build triggers and status', () => {
    const triggerDefaults = {
      buildScheduleEnabled: true,
      buildScheduleHours: 24,
      buildOnPushEnabled: true,
      buildPushDebounceMinutes: 10,
      buildPushMaxPerHour: 4,
      lastBuildStatus: null,
      lastBuildError: null,
      lastBuiltAt: null,
      lastBuildAttemptedAt: null,
      buildRequestedAt: null,
      lastPushAt: null,
      buildWindowStartedAt: null,
      buildWindowCount: 0,
      buildClaimedAt: null,
    };

    it('creates with the trigger defaults and round-trips every field, including an unlimited cap as 0', async () => {
      const seed = await createFactoryStorageForTests();
      const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Env' } });
      expect(project).toMatchObject(triggerDefaults);

      const at = new Date('2026-10-07T10:00:00.000Z');
      const input = {
        buildScheduleEnabled: false,
        buildScheduleHours: 6,
        buildOnPushEnabled: false,
        buildPushDebounceMinutes: 0,
        buildPushMaxPerHour: 0,
        lastBuildStatus: 'failed' as const,
        lastBuildError: 'setup exited 1',
        lastBuiltAt: at,
        lastBuildAttemptedAt: at,
        buildRequestedAt: at,
        lastPushAt: at,
        buildWindowStartedAt: at,
        buildWindowCount: 3,
        buildClaimedAt: at,
      };
      expect(await seed.projects.update({ orgId: 'org-1', id: project.id, input })).toMatchObject(input);
      expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject(input);
    });

    it('hands the build lease to one claimant, refuses a concurrent second claim and lets a stale one be taken over', async () => {
      const seed = await createFactoryStorageForTests();
      const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Env' } });
      const now = new Date('2026-10-07T10:00:00.000Z');
      const staleAfterMs = 30 * 60_000;

      const first = await seed.projects.claimBuild({ orgId: 'org-1', id: project.id, now, staleAfterMs });
      expect(first).toMatchObject({ buildClaimedAt: now, lastBuildStatus: 'building' });

      const later = new Date(now.getTime() + 60_000);
      expect(await seed.projects.claimBuild({ orgId: 'org-1', id: project.id, now: later, staleAfterMs })).toBeNull();
      expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject({ buildClaimedAt: now });

      const stale = new Date(now.getTime() + staleAfterMs);
      expect(
        await seed.projects.claimBuild({ orgId: 'org-1', id: project.id, now: stale, staleAfterMs }),
      ).toMatchObject({ buildClaimedAt: stale });
      expect(await seed.projects.claimBuild({ orgId: 'org-2', id: project.id, now: stale, staleAfterMs })).toBeNull();
    });

    it('records a ready build, keeps a request made after the claim and clears one made before it', async () => {
      const seed = await createFactoryStorageForTests();
      const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Env' } });
      const requestedBefore = new Date('2026-10-07T09:50:00.000Z');
      const claimedAt = new Date('2026-10-07T10:00:00.000Z');
      await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildRequestedAt: requestedBefore } });
      await seed.projects.claimBuild({ orgId: 'org-1', id: project.id, now: claimedAt, staleAfterMs: 1 });

      const finishedAt = new Date('2026-10-07T10:05:00.000Z');
      const recorded = await seed.projects.recordBuild({
        orgId: 'org-1',
        id: project.id,
        input: {
          now: finishedAt,
          claimedAt,
          result: { status: 'ready', templateId: 'tpl-1', heads: { 'a/b': 'c0ffee' } },
        },
      });
      expect(recorded).toMatchObject({
        lastBuildStatus: 'ready',
        lastBuildError: null,
        lastBuiltAt: finishedAt,
        lastBuildAttemptedAt: claimedAt,
        activeTemplateId: 'tpl-1',
        activeTemplateHeads: { 'a/b': 'c0ffee' },
        buildClaimedAt: null,
        buildRequestedAt: null,
      });

      const requestedDuring = new Date('2026-10-07T10:02:00.000Z');
      await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildRequestedAt: requestedDuring } });
      const again = await seed.projects.recordBuild({
        orgId: 'org-1',
        id: project.id,
        input: { now: finishedAt, claimedAt, result: { status: 'ready', templateId: 'tpl-2', heads: {} } },
      });
      expect(again).toMatchObject({ buildRequestedAt: requestedDuring, activeTemplateId: 'tpl-2' });
    });

    it('records a failed build without touching the active template, heads or last successful build', async () => {
      const seed = await createFactoryStorageForTests();
      const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Env' } });
      const builtAt = new Date('2026-10-07T08:00:00.000Z');
      await seed.projects.update({
        orgId: 'org-1',
        id: project.id,
        input: { activeTemplateId: 'tpl-1', activeTemplateHeads: { 'a/b': 'c0ffee' }, lastBuiltAt: builtAt },
      });
      const claimedAt = new Date('2026-10-07T10:00:00.000Z');
      await seed.projects.claimBuild({ orgId: 'org-1', id: project.id, now: claimedAt, staleAfterMs: 1 });

      const failedAt = new Date('2026-10-07T10:03:00.000Z');
      const recorded = await seed.projects.recordBuild({
        orgId: 'org-1',
        id: project.id,
        input: { now: failedAt, claimedAt, result: { status: 'failed', error: 'image build failed' } },
      });
      expect(recorded).toMatchObject({
        lastBuildStatus: 'failed',
        lastBuildError: 'image build failed',
        lastBuildAttemptedAt: claimedAt,
        lastBuiltAt: builtAt,
        activeTemplateId: 'tpl-1',
        activeTemplateHeads: { 'a/b': 'c0ffee' },
        buildClaimedAt: null,
      });
    });
  });
});
