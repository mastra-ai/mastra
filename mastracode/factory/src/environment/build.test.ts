import { describe, expect, it, vi } from 'vitest';

import type { FactorySandboxContext } from '../sandbox/session-sandbox.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { environmentBuildSessionId, runEnvironmentBuild } from './build.js';
import type { EnvironmentTemplateBuildResult } from './types.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

async function seedEnvironment() {
  const seed = await createFactoryStorageForTests();
  const created = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
  const project = (await seed.projects.update({
    orgId: 'org-1',
    id: created.id,
    input: { workspaceSetupCommand: 'pnpm install' },
  }))!;
  const github = seed.sourceControl.forIntegration('github');
  const installation = await github.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: 'gh-1',
  });
  const connection = await github.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const links = [];
  for (const slug of ['acme/api', 'acme/web']) {
    const repository = await github.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: `ext-${slug}`, slug, defaultBranch: 'main' },
    });
    links.push(
      await github.projectRepositories.link({
        orgId: 'org-1',
        connectionId: connection.id,
        repositoryId: repository.id,
        createdByUserId: 'user-1',
        sandboxProvider: 'local',
        sandboxWorkdir: `/workspace/${slug}`,
        setupCommand: `setup ${slug}`,
      }),
    );
  }
  const versionControl = {
    getRepositoryAccess: vi.fn(async ({ repositoryId }: { repositoryId: string }) => ({
      cloneUrl: `https://github.com/${repositoryId}.git`,
      authorization: { scheme: 'bearer' as const, token: 'secret-token' },
    })),
  };
  return { seed, project, github, links, versionControl };
}

function templateReturning(results: EnvironmentTemplateBuildResult[]) {
  const build = vi.fn(async () => results.shift()!);
  const contexts: FactorySandboxContext[] = [];
  const sandboxTemplate = vi.fn((ctx: FactorySandboxContext) => {
    contexts.push(ctx);
    return async () => ({ build });
  });
  return { build, sandboxTemplate, contexts };
}

describe('runEnvironmentBuild', () => {
  it('hands the host a session-shaped context pinned to the given heads and records a ready build', async () => {
    const { seed, project, github, links, versionControl } = await seedEnvironment();
    const claimedAt = new Date('2026-10-07T10:00:00Z');
    const finishedAt = new Date('2026-10-07T10:04:00Z');
    const { build, sandboxTemplate, contexts } = templateReturning([{ status: 'ready', templateId: 'tpl-1' }]);
    const heads = { 'acme/api': SHA_A, 'acme/web': SHA_B };
    await seed.projects.claimBuild({ orgId: 'org-1', id: project.id, now: claimedAt, staleAfterMs: 1 });

    const outcome = await runEnvironmentBuild(
      {
        projects: seed.projects,
        sourceControl: { storage: github, versionControl },
        sandboxTemplate,
        now: () => finishedAt,
      },
      { project, claimedAt, heads },
    );

    expect(outcome).toEqual({ status: 'ready', templateId: 'tpl-1', heads });
    expect(build).toHaveBeenCalledTimes(1);
    const ctx = contexts[0]!;
    expect(ctx.sessionId).toBe(environmentBuildSessionId(project.id));
    expect(ctx.getRepositoryAccess).toBeUndefined();
    expect(ctx.repos?.map(repo => repo.setupCommand)).toEqual(['setup acme/api', 'setup acme/web']);
    expect(ctx.workspaceSetupCommand).toBe('pnpm install');
    expect(ctx.continueOnSetupFailure).toBe(true);
    expect(await ctx.resolveHead?.('https://github.com/ACME/web.git')).toBe(SHA_B);
    expect(await ctx.resolveHead?.('https://github.com/acme/other.git')).toBeUndefined();

    const recorded = await seed.projects.get({ orgId: 'org-1', id: project.id });
    expect(recorded).toMatchObject({
      lastBuildStatus: 'ready',
      lastBuildError: null,
      lastBuiltAt: finishedAt,
      lastBuildAttemptedAt: claimedAt,
      buildClaimedAt: null,
      activeTemplateId: 'tpl-1',
      activeTemplateHeads: heads,
    });
    for (const link of links) {
      expect(await github.projectRepositories.get({ orgId: 'org-1', id: link.id })).toMatchObject({
        lastBuildStatus: 'configured',
        lastBuildError: null,
        lastBuiltAt: finishedAt,
      });
    }
  });

  it('polls a pending build at the interval the platform asks for', async () => {
    const { seed, project, github, versionControl } = await seedEnvironment();
    const { build, sandboxTemplate } = templateReturning([
      { status: 'pending', templateId: 'tpl-1', retryAfterMs: 2_000 },
      { status: 'pending', templateId: 'tpl-1' },
      { status: 'ready', templateId: 'tpl-1' },
    ]);
    const sleep = vi.fn(async () => {});

    const outcome = await runEnvironmentBuild(
      { projects: seed.projects, sourceControl: { storage: github, versionControl }, sandboxTemplate, sleep },
      { project, claimedAt: new Date(), heads: { 'acme/api': SHA_A, 'acme/web': SHA_B } },
    );

    expect(outcome.status).toBe('ready');
    expect(build).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([2_000, 15_000]);
  });

  it('records a failed build with its error and keeps the previous template', async () => {
    const { seed, project, github, versionControl } = await seedEnvironment();
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { activeTemplateId: 'tpl-old', activeTemplateHeads: { 'acme/api': SHA_A, 'acme/web': SHA_A } },
    });
    const { sandboxTemplate } = templateReturning([{ status: 'failed', templateId: 'tpl-1', error: 'setup exploded' }]);
    const claimedAt = new Date();
    await seed.projects.claimBuild({ orgId: 'org-1', id: project.id, now: claimedAt, staleAfterMs: 1 });

    const outcome = await runEnvironmentBuild(
      { projects: seed.projects, sourceControl: { storage: github, versionControl }, sandboxTemplate },
      { project, claimedAt, heads: { 'acme/api': SHA_B, 'acme/web': SHA_B } },
    );

    expect(outcome).toEqual({ status: 'failed', error: 'setup exploded' });
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject({
      lastBuildStatus: 'failed',
      lastBuildError: 'setup exploded',
      activeTemplateId: 'tpl-old',
      activeTemplateHeads: { 'acme/api': SHA_A, 'acme/web': SHA_A },
      buildClaimedAt: null,
    });
  });

  it('times out a build that stays pending past the wait bound and records that as a failure', async () => {
    const { seed, project, github, versionControl } = await seedEnvironment();
    const { build, sandboxTemplate } = templateReturning(
      Array.from({ length: 10 }, () => ({ status: 'pending' as const, templateId: 'tpl-1', retryAfterMs: 1_000 })),
    );
    let clock = 0;
    const outcome = await runEnvironmentBuild(
      {
        projects: seed.projects,
        sourceControl: { storage: github, versionControl },
        sandboxTemplate,
        now: () => new Date(clock),
        sleep: async ms => {
          clock += ms;
        },
        maxWaitMs: 2_500,
      },
      { project, claimedAt: new Date(0), heads: { 'acme/api': SHA_A, 'acme/web': SHA_B } },
    );

    expect(outcome).toEqual({ status: 'failed', error: 'Build timed out.' });
    expect(build).toHaveBeenCalledTimes(4);
  });

  it('records a thrown build as a failure without leaking the repository token', async () => {
    const { seed, project, github, versionControl } = await seedEnvironment();
    const sandboxTemplate = vi.fn(() => async () => ({
      build: async () => {
        throw new Error('clone of https://x-access-token:secret-token@github.com/acme/api failed (ghs_secrettoken)');
      },
    }));
    const claimedAt = new Date();
    await seed.projects.claimBuild({ orgId: 'org-1', id: project.id, now: claimedAt, staleAfterMs: 1 });

    const outcome = await runEnvironmentBuild(
      { projects: seed.projects, sourceControl: { storage: github, versionControl }, sandboxTemplate },
      { project, claimedAt, heads: { 'acme/api': SHA_A, 'acme/web': SHA_B } },
    );

    expect(outcome).toEqual({ status: 'failed', error: 'clone of https://***@github.com/acme/api failed (***)' });
    const recorded = await seed.projects.get({ orgId: 'org-1', id: project.id });
    expect(recorded?.lastBuildError).toBe('clone of https://***@github.com/acme/api failed (***)');
    expect(JSON.stringify(recorded)).not.toContain('secret');
  });

  it('releases the claim as a failure when the host template hook itself throws', async () => {
    const { seed, project, github, versionControl } = await seedEnvironment();
    const claimedAt = new Date();
    await seed.projects.claimBuild({ orgId: 'org-1', id: project.id, now: claimedAt, staleAfterMs: 1 });

    const outcome = await runEnvironmentBuild(
      {
        projects: seed.projects,
        sourceControl: { storage: github, versionControl },
        sandboxTemplate: () => {
          throw new Error('MASTRA_PLATFORM_ACCESS_TOKEN=ghp_abcdef is not a project token');
        },
      },
      { project, claimedAt, heads: { 'acme/api': SHA_A, 'acme/web': SHA_B } },
    );

    expect(outcome).toEqual({ status: 'failed', error: 'MASTRA_PLATFORM_ACCESS_TOKEN=*** is not a project token' });
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject({
      buildClaimedAt: null,
      lastBuildStatus: 'failed',
      lastBuildError: 'MASTRA_PLATFORM_ACCESS_TOKEN=*** is not a project token',
      buildFailureCount: 1,
    });
  });

  it('skips a project whose host returns no template, recording nothing', async () => {
    const { seed, project, github, versionControl } = await seedEnvironment();

    const outcome = await runEnvironmentBuild(
      { projects: seed.projects, sourceControl: { storage: github, versionControl }, sandboxTemplate: () => undefined },
      { project, claimedAt: new Date(), heads: { 'acme/api': SHA_A, 'acme/web': SHA_B } },
    );

    expect(outcome).toEqual({ status: 'skipped', reason: 'no_template' });
    expect((await seed.projects.get({ orgId: 'org-1', id: project.id }))?.lastBuildAttemptedAt).toBeNull();
  });

  it('skips a project with no environment repository', async () => {
    const seed = await createFactoryStorageForTests();
    const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Empty' } });
    const github = seed.sourceControl.forIntegration('github');

    const outcome = await runEnvironmentBuild(
      {
        projects: seed.projects,
        sourceControl: { storage: github, versionControl: { getRepositoryAccess: vi.fn() } },
        sandboxTemplate: vi.fn(),
      },
      { project, claimedAt: new Date() },
    );

    expect(outcome).toEqual({ status: 'skipped', reason: 'no_environment' });
  });
});
