import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { FactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxBuild, FactorySandboxBuilds } from '@mastra/core/workspace';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { EnvironmentBuildRunner } from './build-runner.js';
import {
  ensureSchedule,
  invalidCronMessage,
  probeSchedulesAvailable,
  readSchedule,
  scheduleIdFor,
} from './build-schedule.js';
import { ENVIRONMENT_BUILD_WORKFLOW_ID } from './build-workflow.js';
import type { EnvironmentBuildDeps } from './build.js';

const SHA_A = 'a'.repeat(40);

vi.mock('../integrations/github/commits.js', () => ({
  getBranchHead: vi.fn(async () => SHA_A),
}));

type Settings = Record<string, unknown>;

class BuildingSandbox extends FactorySandbox<Settings> {
  readonly provider = 'recording';
  statuses: FactorySandboxBuild['status'][] = ['building', 'ready'];
  readonly gets: string[] = [];
  readonly builds: FactorySandboxBuilds<Settings> = {
    start: async () => ({ buildId: 'build-1', status: 'building', templateId: 'tpl-1' }),
    get: async (_ctx, _settings, buildId) => {
      this.gets.push(buildId);
      const status = this.statuses.length > 1 ? this.statuses.shift()! : this.statuses[0]!;
      return { buildId, status, templateId: 'tpl-1', ...(status === 'failed' ? { error: 'boom' } : {}) };
    },
  };
  create(): never {
    throw new Error('not used');
  }
}

async function seedProject(seed: FactoryStorageTestSeed) {
  const project = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Platform' } });
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
  const repository = await github.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: 'repo-0', slug: 'acme/api', defaultBranch: 'main' },
  });
  await github.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'platform',
    sandboxWorkdir: '/workspace/acme/api',
  });
  return project;
}

function depsFor(seed: FactoryStorageTestSeed, sandbox: FactorySandbox): EnvironmentBuildDeps {
  return {
    sandbox,
    projects: seed.projects,
    sourceControl: {
      storage: seed.sourceControl.forIntegration('github'),
      versionControl: { getRepositoryAccess: async () => ({ token: 't', cloneUrl: 'u' }) as never },
    },
  };
}

function bootMastra(runner: EnvironmentBuildRunner) {
  return new Mastra({
    logger: false,
    storage: new InMemoryStore({ id: 'build-schedule-test' }),
    workflows: { [ENVIRONMENT_BUILD_WORKFLOW_ID]: runner.workflow },
    notifications: { dispatch: { enabled: false } },
  });
}

describe('factory-environment-build workflow', () => {
  let seed: FactoryStorageTestSeed;

  beforeEach(async () => {
    seed = await createFactoryStorageForTests();
  });

  it('answers the start outcome before the poll finishes, then pins the active template once ready', async () => {
    const project = await seedProject(seed);
    const sandbox = new BuildingSandbox();
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    let mastra: Mastra | undefined;
    const runner = new EnvironmentBuildRunner(depsFor(seed, sandbox), {
      getMastra: () => mastra,
      sleep: () => gate,
    });
    mastra = bootMastra(runner);

    const outcome = await runner.start(project.id, 'manual');

    expect(outcome).toEqual({
      outcome: 'started',
      buildId: 'build-1',
      templateId: 'tpl-1',
      heads: { 'acme/api': SHA_A },
    });
    expect((await seed.projects.getById({ id: project.id }))?.activeTemplateId).toBeNull();

    release();
    await vi.waitFor(async () => {
      expect((await seed.projects.getById({ id: project.id }))?.activeTemplateId).toBe('tpl-1');
    });
    const stored = await seed.projects.getById({ id: project.id });
    expect(stored?.activeTemplateHeads).toEqual({ 'acme/api': SHA_A });
    expect(stored?.lastBuildId).toBe('build-1');
    expect(sandbox.gets).toEqual(['build-1', 'build-1']);
  });

  it('does not let an older run that finishes late overwrite a newer build', async () => {
    const project = await seedProject(seed);
    const sandbox = new BuildingSandbox();
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    let mastra: Mastra | undefined;
    const runner = new EnvironmentBuildRunner(depsFor(seed, sandbox), {
      getMastra: () => mastra,
      sleep: () => gate,
    });
    mastra = bootMastra(runner);

    await runner.start(project.id, 'manual');
    // A newer run took over the project while the first one was still polling.
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { lastBuildId: 'build-2', activeTemplateId: 'tpl-2', activeTemplateHeads: { 'acme/api': 'b'.repeat(40) } },
    });

    release();
    await vi.waitFor(() => expect(sandbox.gets).toEqual(['build-1', 'build-1']));
    await new Promise(resolve => setTimeout(resolve, 20));
    const stored = await seed.projects.getById({ id: project.id });
    expect(stored?.activeTemplateId).toBe('tpl-2');
    expect(stored?.activeTemplateHeads).toEqual({ 'acme/api': 'b'.repeat(40) });
  });

  it('runs to a failed status without touching the active template', async () => {
    const project = await seedProject(seed);
    const sandbox = new BuildingSandbox();
    sandbox.statuses = ['failed'];
    let mastra: Mastra | undefined;
    const runner = new EnvironmentBuildRunner(depsFor(seed, sandbox), { getMastra: () => mastra });
    mastra = bootMastra(runner);

    const run = await mastra.getWorkflow(ENVIRONMENT_BUILD_WORKFLOW_ID).createRun();
    const result = await run.start({ inputData: { projectId: project.id, trigger: 'manual' } });

    expect(result.status).toBe('success');
    expect(result.status === 'success' && result.result).toEqual({
      outcome: 'started',
      buildId: 'build-1',
      templateId: 'tpl-1',
      status: 'failed',
      reason: 'boom',
    });
    expect((await seed.projects.getById({ id: project.id }))?.activeTemplateId).toBeNull();
  });

  it('gives up with unknown once the wait runs out', async () => {
    const project = await seedProject(seed);
    const sandbox = new BuildingSandbox();
    sandbox.statuses = ['building'];
    let tick = 0;
    let mastra: Mastra | undefined;
    const runner = new EnvironmentBuildRunner(depsFor(seed, sandbox), {
      getMastra: () => mastra,
      sleep: async () => {
        tick += 1;
      },
      maxWaitMs: 0,
      now: () => new Date(tick),
    });
    mastra = bootMastra(runner);

    const run = await mastra.getWorkflow(ENVIRONMENT_BUILD_WORKFLOW_ID).createRun();
    const result = await run.start({ inputData: { projectId: project.id, trigger: 'manual' } });

    expect(result.status === 'success' && result.result).toMatchObject({
      outcome: 'started',
      status: 'unknown',
      reason: 'Build wait timed out.',
    });
  });

  it('passes a skipped outcome straight through', async () => {
    const sandbox = new BuildingSandbox();
    let mastra: Mastra | undefined;
    const runner = new EnvironmentBuildRunner(depsFor(seed, sandbox), { getMastra: () => mastra });
    mastra = bootMastra(runner);

    await expect(runner.start('missing', 'schedule')).resolves.toEqual({
      outcome: 'skipped',
      reason: 'no_environment',
    });
  });

  it('starts a push run only for an opted-in project and the default branch of an environment repository', async () => {
    const project = await seedProject(seed);
    const sandbox = new BuildingSandbox();
    let mastra: Mastra | undefined;
    const runner = new EnvironmentBuildRunner(depsFor(seed, sandbox), { getMastra: () => mastra });
    mastra = bootMastra(runner);
    const start = vi.spyOn(runner, 'start');
    const event = {
      orgId: 'org-1',
      factoryProjectId: project.id,
      projectRepository: { id: 'link', inEnvironment: true },
      ref: 'refs/heads/main',
      defaultBranch: 'main',
    };

    runner.onRepositoryPush(event);
    await vi.waitFor(() => expect(start).not.toHaveBeenCalled());

    await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildOnPushEnabled: true } });
    runner.onRepositoryPush({ ...event, ref: 'refs/heads/feature' });
    runner.onRepositoryPush({ ...event, projectRepository: { ...event.projectRepository, inEnvironment: false } });
    // A link's own branch is the session base, not what the template clones.
    runner.onRepositoryPush({ ...event, ref: 'refs/heads/release' });
    runner.onRepositoryPush(event);
    await vi.waitFor(() => expect(start).toHaveBeenCalledTimes(1));
    expect(start).toHaveBeenCalledWith(project.id, 'push');
    await vi.waitFor(async () => {
      expect((await seed.projects.getById({ id: project.id }))?.lastBuildId).toBe('build-1');
    });
  });

  it('reads a status context from the stored heads, resolving them live only before the first ready build', async () => {
    const project = await seedProject(seed);
    const runner = new EnvironmentBuildRunner(depsFor(seed, new BuildingSandbox()), { getMastra: () => undefined });

    const live = await runner.readContext(project.id);
    expect(live?.settings).toEqual({});
    await expect(live?.ctx.resolveHead?.('https://github.com/acme/api')).resolves.toBe(SHA_A);

    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { activeTemplateHeads: { 'acme/api': 'b'.repeat(40) }, sandboxSettings: { cpuCount: 4 } },
    });
    const stored = await runner.readContext(project.id);
    expect(stored?.settings).toEqual({ cpuCount: 4 });
    expect(stored?.ctx.sessionId).toBe(`environment-build:${project.id}`);
    await expect(stored?.ctx.resolveHead?.('https://github.com/acme/api')).resolves.toBe('b'.repeat(40));

    // A build in flight was pinned to its own heads; reading its status after
    // a restart must recompute that template, not the last ready one.
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { lastBuildId: 'build-9', lastBuildHeads: { 'acme/api': 'c'.repeat(40) } },
    });
    const attempt = await runner.readContext(project.id);
    await expect(attempt?.ctx.resolveHead?.('https://github.com/acme/api')).resolves.toBe('c'.repeat(40));
    await expect(runner.readContext('missing')).resolves.toBeUndefined();
  });

  it('answers unavailable when the host never registered the workflow, instead of throwing', async () => {
    const project = await seedProject(seed);
    const runner = new EnvironmentBuildRunner(depsFor(seed, new BuildingSandbox()), {
      getMastra: () => new Mastra({ logger: false, storage: new InMemoryStore({ id: 'no-workflow' }) }),
    });
    await expect(runner.start(project.id, 'manual')).resolves.toEqual({
      outcome: 'unavailable',
      reason: 'no_workflow',
    });
  });

  it('is unavailable before the host booted', async () => {
    const runner = new EnvironmentBuildRunner(depsFor(seed, new BuildingSandbox()), { getMastra: () => undefined });
    await expect(runner.start('p', 'manual')).resolves.toEqual({ outcome: 'unavailable', reason: 'not_ready' });
  });
});

describe('build schedule', () => {
  it('creates, pauses, resumes and re-times the project schedule through core Schedules', async () => {
    const runner = new EnvironmentBuildRunner(depsFor(await createFactoryStorageForTests(), new BuildingSandbox()), {
      getMastra: () => undefined,
    });
    const mastra = bootMastra(runner);
    const schedules = mastra.schedules;

    await expect(readSchedule(schedules, 'p1')).resolves.toEqual({ enabled: false, cron: null, timezone: null });
    await expect(ensureSchedule(schedules, 'p1', { enabled: false, cron: '0 3 * * *' })).resolves.toEqual({
      enabled: false,
      cron: null,
      timezone: null,
    });
    expect(await schedules.list({ workflowId: ENVIRONMENT_BUILD_WORKFLOW_ID })).toHaveLength(0);

    await expect(
      ensureSchedule(schedules, 'p1', { enabled: true, cron: '0 3 * * *', timezone: 'UTC' }),
    ).resolves.toEqual({
      enabled: true,
      cron: '0 3 * * *',
      timezone: 'UTC',
    });
    const created = await schedules.get(scheduleIdFor('p1'));
    expect(created).toMatchObject({
      id: 'schedule_factory-environment-build-p1',
      workflowId: ENVIRONMENT_BUILD_WORKFLOW_ID,
      inputData: { projectId: 'p1', trigger: 'schedule' },
      status: 'active',
    });

    await expect(
      ensureSchedule(schedules, 'p1', { enabled: false, cron: '0 3 * * *', timezone: 'UTC' }),
    ).resolves.toEqual({ enabled: false, cron: '0 3 * * *', timezone: 'UTC' });
    await expect(
      ensureSchedule(schedules, 'p1', { enabled: true, cron: '30 4 * * 1', timezone: 'UTC' }),
    ).resolves.toEqual({ enabled: true, cron: '30 4 * * 1', timezone: 'UTC' });
    await expect(readSchedule(schedules, 'p1')).resolves.toEqual({
      enabled: true,
      cron: '30 4 * * 1',
      timezone: 'UTC',
    });
    expect(await schedules.list({ workflowId: ENVIRONMENT_BUILD_WORKFLOW_ID })).toHaveLength(1);
  });

  it('reports schedules unavailable on a Mastra without a schedules store', async () => {
    const withStore = bootMastra(
      new EnvironmentBuildRunner(depsFor(await createFactoryStorageForTests(), new BuildingSandbox()), {
        getMastra: () => undefined,
      }),
    );
    await expect(probeSchedulesAvailable(withStore.schedules)).resolves.toBe(true);

    const storage = new InMemoryStore({ id: 'no-schedules' });
    delete (storage.stores as { schedules?: unknown }).schedules;
    const withoutStore = new Mastra({ logger: false, storage, notifications: { dispatch: { enabled: false } } });
    await expect(probeSchedulesAvailable(withoutStore.schedules)).resolves.toBe(false);
  });

  it('validates cron expressions with the validator Schedules uses', () => {
    expect(invalidCronMessage('0 3 * * *')).toBeUndefined();
    expect(invalidCronMessage('not a cron')).toMatch(/cron/i);
    expect(invalidCronMessage('0 3 * * *', 'Mars/Olympus')).toMatch(/time ?zone/i);
  });
});
