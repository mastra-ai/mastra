import { FactorySandbox } from '@mastra/core/workspace';
import type {
  FactorySandboxBuild,
  FactorySandboxBuildStart,
  FactorySandboxBuilds,
  FactorySandboxContext,
} from '@mastra/core/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { environmentBuildContext, redactCredentials, runEnvironmentBuild } from './build.js';
import type { EnvironmentBuildDeps } from './build.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

const heads = vi.hoisted(() => ({ byBranch: new Map<string, string>() }));
vi.mock('../integrations/github/commits.js', () => ({
  getBranchHead: vi.fn(async (_github: unknown, input: { repository: { slug: string }; branch: string }) => {
    const sha = heads.byBranch.get(`${input.repository.slug}@${input.branch}`);
    if (!sha) throw new Error(`no head for ${input.repository.slug}@${input.branch}`);
    return sha;
  }),
}));

type Settings = Record<string, unknown>;

class BuildingSandbox extends FactorySandbox<Settings> {
  readonly provider = 'recording';
  readonly starts: Array<{ ctx: FactorySandboxContext; settings: Settings }> = [];
  readonly gets: string[] = [];
  statusOf: (buildId: string) => FactorySandboxBuild['status'] = () => 'ready';
  startError: Error | undefined;
  readonly builds: FactorySandboxBuilds<Settings> = {
    start: async (ctx, settings): Promise<FactorySandboxBuildStart> => {
      if (this.startError) throw this.startError;
      this.starts.push({ ctx, settings });
      return { buildId: `build-${this.starts.length}`, status: 'building', templateId: `tpl-${this.starts.length}` };
    },
    get: async (_ctx, _settings, buildId): Promise<FactorySandboxBuild> => {
      this.gets.push(buildId);
      return { buildId, status: this.statusOf(buildId) };
    },
  };
  create(): never {
    throw new Error('not used');
  }
}

class PlainSandbox extends FactorySandbox<Settings> {
  readonly provider = 'plain';
  create(): never {
    throw new Error('not used');
  }
}

async function seedProject(seed: FactoryStorageTestSeed, slugs: string[]) {
  const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
  await seed.projects.update({ orgId: 'org-1', id: project.id, input: { sandboxSettings: { cpuCount: 2 } } });
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
  for (const [index, slug] of slugs.entries()) {
    const repository = await github.repositories.upsert({
      orgId: 'org-1',
      input: { installationId: installation.id, externalId: `repo-${index}`, slug, defaultBranch: 'main' },
    });
    await github.projectRepositories.link({
      orgId: 'org-1',
      connectionId: connection.id,
      repositoryId: repository.id,
      createdByUserId: 'user-1',
      sandboxProvider: 'platform',
      sandboxWorkdir: `/workspace/${slug}`,
    });
  }
  return { project, github };
}

function depsFor(
  seed: FactoryStorageTestSeed,
  sandbox: FactorySandbox | undefined,
  now: () => Date,
): EnvironmentBuildDeps {
  return {
    sandbox,
    projects: seed.projects,
    sourceControl: {
      storage: seed.sourceControl.forIntegration('github'),
      versionControl: {
        getRepositoryAccess: async () => ({ token: 'ghs_x', cloneUrl: 'https://github.com/x/y' }) as never,
      },
    },
    now,
  };
}

describe('runEnvironmentBuild', () => {
  let seed: FactoryStorageTestSeed;
  let clock: Date;
  const now = () => clock;

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
    clock = new Date('2026-10-08T12:00:00Z');
    heads.byBranch.clear();
    heads.byBranch.set('acme/api@main', SHA_A);
    heads.byBranch.set('acme/web@main', SHA_B);
  });

  it('is unavailable without a builds capability or a source control', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    await expect(
      runEnvironmentBuild(depsFor(seed, new PlainSandbox(), now), { projectId: project.id, trigger: 'manual' }),
    ).resolves.toEqual({ outcome: 'unavailable', reason: 'no_builds' });
    await expect(
      runEnvironmentBuild(
        { ...depsFor(seed, new BuildingSandbox(), now), sourceControl: undefined },
        { projectId: project.id, trigger: 'manual' },
      ),
    ).resolves.toEqual({ outcome: 'unavailable', reason: 'no_source_control' });
  });

  it('skips a project with no environment repositories', async () => {
    const { project } = await seedProject(seed, []);
    await expect(
      runEnvironmentBuild(depsFor(seed, new BuildingSandbox(), now), { projectId: project.id, trigger: 'manual' }),
    ).resolves.toEqual({ outcome: 'skipped', reason: 'no_environment' });
    await expect(
      runEnvironmentBuild(depsFor(seed, new BuildingSandbox(), now), { projectId: 'missing', trigger: 'manual' }),
    ).resolves.toEqual({ outcome: 'skipped', reason: 'no_environment' });
  });

  it('starts a manual build with the session-shaped context and records the attempt', async () => {
    const { project } = await seedProject(seed, ['acme/api', 'acme/web']);
    const sandbox = new BuildingSandbox();

    const result = await runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'manual' });

    expect(result).toEqual({
      outcome: 'started',
      buildId: 'build-1',
      templateId: 'tpl-1',
      heads: { 'acme/api': SHA_A, 'acme/web': SHA_B },
    });
    expect(sandbox.starts).toHaveLength(1);
    const { ctx, settings } = sandbox.starts[0]!;
    expect(settings).toEqual({ cpuCount: 2 });
    expect(ctx.sessionId).toBe(`environment-build:${project.id}`);
    expect(ctx.sandboxId).toBeUndefined();
    expect(ctx.repos).toHaveLength(2);
    expect(ctx.continueOnSetupFailure).toBe(true);
    expect(ctx.workingDirectory).toBeUndefined();
    await expect(ctx.resolveHead?.('https://github.com/acme/api.git')).resolves.toBe(SHA_A);
    await expect(ctx.resolveHead?.('https://github.com/other/repo.git')).resolves.toBeUndefined();
    const stored = await seed.projects.getById({ id: project.id });
    expect(stored?.lastBuildId).toBe('build-1');
    expect(stored?.lastBuildHeads).toEqual(expect.objectContaining({ 'acme/api': SHA_A }));
    expect(stored?.lastBuildAttemptedAt?.toISOString()).toBe(clock.toISOString());
    expect(stored?.activeTemplateId).toBeNull();
  });

  it('skips a schedule when the last build is ready and no head moved, builds when one did', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { lastBuildId: 'build-0', activeTemplateHeads: { 'acme/api': SHA_A } },
    });

    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
    ).resolves.toEqual({ outcome: 'skipped', reason: 'unchanged' });
    expect(sandbox.gets).toEqual(['build-0']);
    expect(sandbox.starts).toHaveLength(0);

    heads.byBranch.set('acme/api@main', SHA_B);
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
    ).resolves.toMatchObject({ outcome: 'started', buildId: 'build-1', heads: { 'acme/api': SHA_B } });
  });

  it('rebuilds on schedule when the last build failed or is unknown to the provider', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { lastBuildId: 'build-0', activeTemplateHeads: { 'acme/api': SHA_A } },
    });

    for (const status of ['failed', 'unknown'] as const) {
      sandbox.statusOf = () => status;
      await expect(
        runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
      ).resolves.toMatchObject({ outcome: 'started' });
    }
    expect(sandbox.starts).toHaveLength(2);
  });

  it('manual always builds over a finished build, even with unchanged heads', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { lastBuildId: 'build-0', activeTemplateHeads: { 'acme/api': SHA_A } },
    });

    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'manual' }),
    ).resolves.toMatchObject({ outcome: 'started' });
    expect(sandbox.gets).toEqual(['build-0']);
    expect(sandbox.starts).toHaveLength(1);
  });

  it('never starts a second build while the last one is still running, whatever the trigger', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    sandbox.statusOf = () => 'building';
    await seed.projects.update({ orgId: 'org-1', id: project.id, input: { lastBuildId: 'build-0' } });

    for (const trigger of ['manual', 'schedule', 'push'] as const) {
      await expect(
        runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger }),
      ).resolves.toEqual({ outcome: 'skipped', reason: 'in_progress', buildId: 'build-0' });
    }
    expect(sandbox.starts).toEqual([]);
  });

  it('debounces pushes on the leading edge and lets the first push in the next window build', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildPushDebounceMinutes: 10 } });

    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'push' }),
    ).resolves.toMatchObject({ outcome: 'started', buildId: 'build-1' });
    clock = new Date(clock.getTime() + 5 * 60_000);
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'push' }),
    ).resolves.toEqual({ outcome: 'skipped', reason: 'debounced' });
    expect(sandbox.starts).toHaveLength(1);

    // Outside the window the claim wins again, and with a ready build on
    // unchanged heads the push still has nothing to do.
    clock = new Date(clock.getTime() + 6 * 60_000);
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { activeTemplateHeads: { 'acme/api': SHA_A } },
    });
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'push' }),
    ).resolves.toEqual({ outcome: 'skipped', reason: 'unchanged' });
    expect(sandbox.gets).toEqual(['build-1']);

    heads.byBranch.set('acme/api@main', SHA_B);
    clock = new Date(clock.getTime() + 11 * 60_000);
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'push' }),
    ).resolves.toMatchObject({ outcome: 'started', buildId: 'build-2' });
    const stored = await seed.projects.getById({ id: project.id });
    expect(stored?.lastBuildAttemptedAt?.toISOString()).toBe(clock.toISOString());
  });

  it('reports a provider failure with credentials redacted and the attempt recorded', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    sandbox.startError = new Error('clone https://x-access-token:ghs_secret@github.com/acme/api.git failed');

    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'manual' }),
    ).resolves.toEqual({ outcome: 'failed', reason: 'clone https://***@github.com/acme/api.git failed' });
    const stored = await seed.projects.getById({ id: project.id });
    expect(stored?.lastBuildId).toBeNull();
    expect(stored?.lastBuildAttemptedAt?.toISOString()).toBe(clock.toISOString());
  });

  it('clears a stale ready build id when a manual build fails, so the next schedule rebuilds', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { lastBuildId: 'build-old', activeTemplateId: 'tpl-old', activeTemplateHeads: { 'acme/api': SHA_A } },
    });
    sandbox.startError = new Error('quota exceeded');
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'manual' }),
    ).resolves.toEqual({ outcome: 'failed', reason: 'quota exceeded' });
    expect((await seed.projects.getById({ id: project.id }))?.lastBuildId).toBeNull();

    // Without the clear, the old ready build and unchanged heads would read as `unchanged`.
    sandbox.startError = undefined;
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
    ).resolves.toMatchObject({ outcome: 'started', buildId: 'build-1' });
    expect(sandbox.gets).toEqual(['build-old']);
  });

  it('pins the repository default branch the template clones, not a link branch', async () => {
    const { project, github } = await seedProject(seed, ['acme/api']);
    const [link] = await github.projectRepositories.listByProject({ orgId: 'org-1', factoryProjectId: project.id });
    await github.projectRepositories.update({ orgId: 'org-1', id: link!.id, input: { branch: 'release' } });
    heads.byBranch.set('acme/api@release', SHA_B);
    const sandbox = new BuildingSandbox();
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'manual' }),
    ).resolves.toMatchObject({ outcome: 'started', heads: { 'acme/api': SHA_A } });
    await expect(sandbox.starts[0]!.ctx.resolveHead!('https://github.com/acme/api.git')).resolves.toBe(SHA_A);
  });

  it('reports a head lookup failure as failed', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    heads.byBranch.clear();
    await expect(
      runEnvironmentBuild(depsFor(seed, new BuildingSandbox(), now), { projectId: project.id, trigger: 'manual' }),
    ).resolves.toEqual({ outcome: 'failed', reason: 'no head for acme/api@main' });
  });
});

describe('environmentBuildContext', () => {
  it('serves recorded heads and mints per-repository access', async () => {
    const getRepositoryAccess = vi.fn(async () => ({ token: 't', cloneUrl: 'u' }) as never);
    const ctx = environmentBuildContext(
      { id: 'p1', orgId: 'org-1' },
      {
        repos: [
          {
            projectRepositoryId: 'l1',
            repositoryId: 'r1',
            slug: 'acme/api',
            defaultBranch: 'main',
            position: 1,
            setupCommand: 'pnpm i',
            teardownCommand: undefined,
          },
        ],
        workspaceSetupCommand: 'pnpm build',
        workingDirectory: '/workspace',
        settings: {},
      },
      { 'acme/api': SHA_A },
      { getRepositoryAccess },
    );
    expect(ctx.sessionId).toBe('environment-build:p1');
    expect(ctx.repos?.[0]?.setupCommand).toBe('pnpm i');
    expect(ctx.workspaceSetupCommand).toBe('pnpm build');
    expect(ctx.workingDirectory).toBe('/workspace');
    await ctx.repos?.[0]?.getRepositoryAccess();
    expect(getRepositoryAccess).toHaveBeenCalledWith({ orgId: 'org-1', repositoryId: 'r1' });
    await expect(ctx.resolveHead?.('git@github.com:acme/api.git')).resolves.toBe(SHA_A);
  });
});

describe('redactCredentials', () => {
  it('strips URL userinfo and GitHub token shapes', () => {
    expect(redactCredentials('https://user:ghp_abc@github.com/x and token ghs_def123 and github_pat_zzz_q')).toBe(
      'https://***@github.com/x and token *** and ***',
    );
  });
});
