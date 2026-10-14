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
import { resolveProjectEnvironment } from '../workspace.js';
import { environmentBuildContext, environmentBuildInputs, redactCredentials, runEnvironmentBuild } from './build.js';
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
  /** Runs before the next `start` call only: await to hold that start open, throw to fail it. */
  readonly beforeStart: Array<() => Promise<void>> = [];
  /** What `list` reports: the provider's build history. */
  listed: FactorySandboxBuild[] = [];
  readonly builds: FactorySandboxBuilds<Settings> = {
    start: async (ctx, settings): Promise<FactorySandboxBuildStart> => {
      await this.beforeStart.shift()?.();
      if (this.startError) throw this.startError;
      this.starts.push({ ctx, settings });
      return { buildId: `build-${this.starts.length}`, status: 'building', templateId: `tpl-${this.starts.length}` };
    },
    get: async (_ctx, _settings, buildId): Promise<FactorySandboxBuild> => {
      this.gets.push(buildId);
      return { buildId, status: this.statusOf(buildId) };
    },
    list: async () => this.listed,
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

/** Records `buildId` as the last build, ready on `heads` with the project's current template inputs. */
async function recordBuild(
  seed: FactoryStorageTestSeed,
  projectId: string,
  buildId: string,
  heads: Record<string, string>,
) {
  const project = await seed.projects.getById({ id: projectId });
  const environment = await resolveProjectEnvironment(seed.sourceControl.forIntegration('github'), project!);
  await seed.projects.update({
    orgId: 'org-1',
    id: projectId,
    input: { lastBuildId: buildId, activeTemplateHeads: heads, lastBuildInputs: environmentBuildInputs(environment) },
  });
}

/** The project storage methods a build uses, bound to `seed` so a test can replace one. */
function projectsWith(seed: FactoryStorageTestSeed): EnvironmentBuildDeps['projects'] {
  const projects = seed.projects;
  return {
    getById: args => projects.getById(args),
    claimBuildAttempt: args => projects.claimBuildAttempt(args),
    claimBuildStart: args => projects.claimBuildStart(args),
    renewBuildStart: args => projects.renewBuildStart(args),
    releaseBuildStart: args => projects.releaseBuildStart(args),
    pinActiveTemplate: args => projects.pinActiveTemplate(args),
  };
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
    await recordBuild(seed, project.id, 'build-0', { 'acme/api': SHA_A });

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

  it('rebuilds on schedule when a template input changed even though no head moved', async () => {
    const { project, github } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    const [link] = await github.projectRepositories.listByProject({ orgId: 'org-1', factoryProjectId: project.id });
    const edits = [
      () => seed.projects.update({ orgId: 'org-1', id: project.id, input: { sandboxSettings: { cpuCount: 4 } } }),
      () => seed.projects.update({ orgId: 'org-1', id: project.id, input: { workspaceSetupCommand: 'make' } }),
      () =>
        github.projectRepositories.update({ orgId: 'org-1', id: link!.id, input: { setupCommand: 'pnpm install' } }),
    ];
    for (const [index, edit] of edits.entries()) {
      await recordBuild(seed, project.id, `build-ready-${index}`, { 'acme/api': SHA_A });
      await edit();
      await expect(
        runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
      ).resolves.toMatchObject({ outcome: 'started' });
    }
    expect(sandbox.starts).toHaveLength(edits.length);
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

  it('starts one build when manual, schedule and push runs overlap', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildOnPushEnabled: true } });
    const sandbox = new BuildingSandbox();
    let release!: () => void;
    sandbox.beforeStart.push(() => new Promise<void>(resolve => (release = resolve)));
    const deps = depsFor(seed, sandbox, now);

    const first = runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' });
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const overlapping = await Promise.all(
      (['manual', 'schedule', 'push'] as const).map(trigger =>
        runEnvironmentBuild(deps, { projectId: project.id, trigger }),
      ),
    );
    release();

    expect(await first).toMatchObject({ outcome: 'started', buildId: 'build-1' });
    expect(overlapping).toEqual([
      { outcome: 'skipped', reason: 'starting' },
      { outcome: 'skipped', reason: 'starting' },
      { outcome: 'skipped', reason: 'starting' },
    ]);
    expect(sandbox.starts).toHaveLength(1);
    sandbox.statusOf = () => 'building';
    expect(await runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' })).toMatchObject({
      outcome: 'skipped',
      reason: 'in_progress',
      buildId: 'build-1',
    });
  });

  it('never lets an older failing start clear a newer build', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    let failOlder!: (error: Error) => void;
    sandbox.beforeStart.push(() => new Promise<void>((_resolve, reject) => (failOlder = reject)));
    const deps = depsFor(seed, sandbox, now);

    const older = runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' });
    await vi.waitFor(() => expect(failOlder).toBeTypeOf('function'));
    // The older run stalls past its lease, so a newer run takes over and starts.
    clock = new Date(clock.getTime() + 11 * 60_000);
    expect(await runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' })).toMatchObject({
      outcome: 'started',
      buildId: 'build-1',
    });
    failOlder(new Error('provider timed out'));

    expect(await older).toEqual({ outcome: 'failed', reason: 'provider timed out' });
    expect(await seed.projects.getById({ id: project.id })).toMatchObject({
      lastBuildId: 'build-1',
      lastBuildHeads: { 'acme/api': SHA_A },
    });
  });

  it('keeps a started build when anything after the provider start fails', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    const deps = {
      ...depsFor(seed, sandbox, now),
      logger: {
        info: (msg: string) => {
          if (msg === 'environment build started') throw new Error('log sink down');
        },
      },
    };

    expect(await runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' })).toMatchObject({
      outcome: 'started',
      buildId: 'build-1',
    });
    expect(await seed.projects.getById({ id: project.id })).toMatchObject({ lastBuildId: 'build-1' });
    sandbox.statusOf = () => 'building';
    expect(await runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' })).toMatchObject({
      outcome: 'skipped',
      reason: 'in_progress',
    });
  });

  it('keeps its lease while a slow provider start runs, so a later trigger never starts a second build', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    let finishStart!: () => void;
    sandbox.beforeStart.push(() => new Promise<void>(resolve => (finishStart = resolve)));
    const deps = { ...depsFor(seed, sandbox, now), leaseRenewMs: 5 };

    const first = runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' });
    await vi.waitFor(() => expect(finishStart).toBeTypeOf('function'));
    // The provider call outlives the lease; the live run keeps renewing it.
    clock = new Date(clock.getTime() + 11 * 60_000);
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(await runEnvironmentBuild(deps, { projectId: project.id, trigger: 'schedule' })).toEqual({
      outcome: 'skipped',
      reason: 'starting',
    });
    finishStart();

    expect(await first).toMatchObject({ outcome: 'started', buildId: 'build-1' });
    expect(sandbox.starts).toHaveLength(1);
  });

  it('never hands a build to polling when its run lost the lease before the provider answered', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    let finishOlder!: () => void;
    sandbox.beforeStart.push(() => new Promise<void>(resolve => (finishOlder = resolve)));
    const deps = depsFor(seed, sandbox, now);

    const older = runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' });
    await vi.waitFor(() => expect(finishOlder).toBeTypeOf('function'));
    // The older run stalls without renewing, so its lease lapses and a newer run starts.
    clock = new Date(clock.getTime() + 11 * 60_000);
    expect(await runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' })).toMatchObject({
      outcome: 'started',
      buildId: 'build-1',
    });
    finishOlder();

    expect(await older).toEqual({ outcome: 'failed', reason: 'superseded', buildId: 'build-2' });
    expect(await seed.projects.getById({ id: project.id })).toMatchObject({ lastBuildId: 'build-1' });
  });

  it('retries recording a started build and keeps other triggers out meanwhile', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    let writeFailures = 2;
    const projects = projectsWith(seed);
    projects.releaseBuildStart = async args => {
      if (args.changes?.lastBuildId && writeFailures-- > 0) throw new Error('database unavailable');
      return seed.projects.releaseBuildStart(args);
    };
    let retry!: () => void;
    const deps = {
      ...depsFor(seed, sandbox, now),
      projects,
      // Hold the first wait between tries open; later ones pass straight through.
      sleep: () => (retry ? Promise.resolve() : new Promise<void>(resolve => (retry = resolve))),
    };

    const first = runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' });
    await vi.waitFor(() => expect(retry).toBeTypeOf('function'));
    expect(await runEnvironmentBuild(deps, { projectId: project.id, trigger: 'schedule' })).toEqual({
      outcome: 'skipped',
      reason: 'starting',
    });
    retry();

    expect(await first).toMatchObject({ outcome: 'started', buildId: 'build-1' });
    expect(await seed.projects.getById({ id: project.id })).toMatchObject({
      lastBuildId: 'build-1',
      lastBuildHeads: { 'acme/api': SHA_A },
    });
    expect(sandbox.starts).toHaveLength(1);
  });

  it('leaves an unrecorded build holding the lease, then finds it at the provider before building again', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    const projects = projectsWith(seed);
    projects.releaseBuildStart = async args => {
      if (args.changes?.lastBuildId) throw new Error('database unavailable');
      return seed.projects.releaseBuildStart(args);
    };
    const deps = { ...depsFor(seed, sandbox, now), projects, sleep: async () => {} };

    expect(await runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' })).toEqual({
      outcome: 'failed',
      reason: 'not_recorded',
      buildId: 'build-1',
    });
    expect(
      await runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
    ).toEqual({
      outcome: 'skipped',
      reason: 'starting',
    });
    clock = new Date(clock.getTime() + 11 * 60_000);
    sandbox.listed = [{ buildId: 'build-1', status: 'building' }];
    for (let run = 0; run < 2; run++) {
      // Every recovery run, not only the first, finds the unrecorded build.
      expect(
        await runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
      ).toEqual({
        outcome: 'skipped',
        reason: 'in_progress',
        buildId: 'build-1',
      });
    }
    expect(sandbox.starts).toHaveLength(1);

    // Once that build is gone the start is reconciled, and a schedule builds again.
    sandbox.listed = [{ buildId: 'build-1', status: 'ready' }];
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
    ).resolves.toMatchObject({ outcome: 'started', buildId: 'build-2' });
    expect(await seed.projects.getById({ id: project.id })).toMatchObject({
      lastBuildId: 'build-2',
      buildStartUncertain: false,
    });
  });

  it('never starts another build after an unrecorded one when the provider cannot list builds', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildOnPushEnabled: true } });
    const sandbox = new BuildingSandbox();
    delete sandbox.builds.list;
    sandbox.statusOf = () => 'building';
    const projects = projectsWith(seed);
    projects.releaseBuildStart = async args => {
      if (args.changes?.lastBuildId) throw new Error('database unavailable');
      return seed.projects.releaseBuildStart(args);
    };
    const deps = { ...depsFor(seed, sandbox, now), projects, sleep: async () => {} };

    await expect(runEnvironmentBuild(deps, { projectId: project.id, trigger: 'manual' })).resolves.toMatchObject({
      outcome: 'failed',
      reason: 'not_recorded',
    });
    clock = new Date(clock.getTime() + 11 * 60_000);
    // Build now included: the earlier start may still be running and can never be reconciled.
    for (const trigger of ['schedule', 'push', 'manual', 'manual', 'schedule'] as const) {
      expect(await runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger })).toEqual({
        outcome: 'skipped',
        reason: 'unresolved',
      });
    }
    expect(sandbox.starts).toHaveLength(1);
    expect(await seed.projects.getById({ id: project.id })).toMatchObject({ buildStartUncertain: true });
  });

  it('keeps the push window open when a push finds a build already running', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildPushDebounceMinutes: 10 } });
    const sandbox = new BuildingSandbox();
    sandbox.statusOf = () => 'building';

    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'manual' }),
    ).resolves.toMatchObject({ outcome: 'started', buildId: 'build-1' });
    // The push lands commit B while the manual build runs on A.
    heads.byBranch.set('acme/api@main', SHA_B);
    clock = new Date(clock.getTime() + 60_000);
    expect(await runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'push' })).toEqual({
      outcome: 'skipped',
      reason: 'in_progress',
      buildId: 'build-1',
    });

    // A minute later the manual build is ready on A; the next push builds B.
    sandbox.statusOf = () => 'ready';
    clock = new Date(clock.getTime() + 60_000);
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'push' }),
    ).resolves.toMatchObject({ outcome: 'started', buildId: 'build-2', heads: { 'acme/api': SHA_B } });
    clock = new Date(clock.getTime() + 60_000);
    expect(await runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'push' })).toEqual({
      outcome: 'skipped',
      reason: 'debounced',
    });
  });

  it('pins a ready build whose poll never finished before deciding a schedule run has nothing to build', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    await recordBuild(seed, project.id, 'build-0', { 'acme/api': SHA_B });
    // `build-0` was built on SHA_A, but its poll died before pinning it.
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { lastBuildHeads: { 'acme/api': SHA_A }, activeTemplateId: 'tpl-old' },
    });

    expect(
      await runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
    ).toEqual({
      outcome: 'skipped',
      reason: 'unchanged',
    });
    expect(sandbox.starts).toHaveLength(0);
    expect(await seed.projects.getById({ id: project.id })).toMatchObject({
      activeTemplateId: 'build-0',
      activeTemplateHeads: { 'acme/api': SHA_A },
    });
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

  it('keeps tracking a running build when reading heads or its status fails', async () => {
    const { project } = await seedProject(seed, ['acme/api']);
    const sandbox = new BuildingSandbox();
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { lastBuildId: 'build-0', lastBuildHeads: { 'acme/api': SHA_A } },
    });

    heads.byBranch.clear();
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
    ).resolves.toMatchObject({ outcome: 'failed' });
    heads.byBranch.set('acme/api@main', SHA_A);
    sandbox.statusOf = () => {
      throw new Error('provider timed out');
    };
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'schedule' }),
    ).resolves.toEqual({ outcome: 'failed', reason: 'provider timed out' });

    const stored = await seed.projects.getById({ id: project.id });
    expect(stored).toMatchObject({ lastBuildId: 'build-0', lastBuildHeads: { 'acme/api': SHA_A } });
    expect(stored?.lastBuildAttemptedAt?.toISOString()).toBe(clock.toISOString());
    // A later trigger still sees the running build instead of starting a second one.
    sandbox.statusOf = () => 'building';
    await expect(
      runEnvironmentBuild(depsFor(seed, sandbox, now), { projectId: project.id, trigger: 'manual' }),
    ).resolves.toEqual({ outcome: 'skipped', reason: 'in_progress', buildId: 'build-0' });
    expect(sandbox.starts).toEqual([]);
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
