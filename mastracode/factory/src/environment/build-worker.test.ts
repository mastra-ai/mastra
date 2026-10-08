import type { WorkerDeps } from '@mastra/core/worker';
import { describe, expect, it, vi } from 'vitest';

import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { FactoryEnvironmentBuildWorker } from './build-worker.js';
import type { EnvironmentTemplateBuildResult } from './types.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);
const T0 = new Date('2026-10-07T12:00:00Z');
const minutes = (n: number) => new Date(T0.getTime() + n * 60_000);
const hours = (n: number) => minutes(n * 60);

async function seedEnvironment(options: { sandboxProvider?: string } = {}) {
  const seed = await createFactoryStorageForTests();
  const created = await seed.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Env' } });
  const project = (await seed.projects.update({
    orgId: 'org-1',
    id: created.id,
    input: { sandboxProvider: options.sandboxProvider ?? 'platform' },
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
  const repository = await github.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: 'ext-api', slug: 'acme/api', defaultBranch: 'main' },
  });
  const link = await github.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    sandboxProvider: 'platform',
    sandboxWorkdir: '/workspace/acme/api',
  });
  return { seed, project, github, repository, link };
}

/** A worker over the seed with a fake clock, a GitHub whose heads the test controls, and a template that answers at once. */
function worker(
  seed: FactoryStorageTestSeed,
  input: {
    now: () => Date;
    heads: () => string;
    results?: EnvironmentTemplateBuildResult[];
    claims?: { wait: Promise<void> };
  },
) {
  const github = seed.sourceControl.forIntegration('github');
  const results = input.results ?? [{ status: 'ready', templateId: 'tpl-1' }];
  const build = vi.fn(async () => {
    if (input.claims) await input.claims.wait;
    return results.shift() ?? { status: 'ready' as const, templateId: 'tpl-again' };
  });
  const sandboxTemplate = vi.fn(() => async () => ({ build }));
  const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => input.heads() }));
  vi.stubGlobal('fetch', fetchMock);
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };
  const instance = new FactoryEnvironmentBuildWorker({
    projects: seed.projects,
    sourceControl: {
      storage: github,
      versionControl: {
        getRepositoryAccess: vi.fn(async () => ({
          cloneUrl: 'https://github.com/acme/api.git',
          authorization: { scheme: 'bearer' as const, token: 'secret-token' },
        })),
      },
    },
    sandboxTemplate,
    now: input.now,
    sleep: async () => {},
  });
  void instance.init({
    pubsub: {} as WorkerDeps['pubsub'],
    storage: {} as WorkerDeps['storage'],
    logger: logger as unknown as WorkerDeps['logger'],
  });
  return { instance, build, sandboxTemplate, logger, fetchMock };
}

describe('FactoryEnvironmentBuildWorker', () => {
  it('skips a scheduled tick whose heads are unchanged, claims nothing and stamps the attempt', async () => {
    const { seed, project } = await seedEnvironment();
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: {
        activeTemplateId: 'tpl-0',
        activeTemplateHeads: { 'acme/api': SHA_A },
        lastBuildAttemptedAt: hours(-30),
        lastBuildStatus: 'ready',
      },
    });
    const { instance, build, logger } = worker(seed, { now: () => T0, heads: () => SHA_A });

    await instance.tick();

    expect(build).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('environment build skipped: heads unchanged', {
      factoryProjectId: project.id,
    });
    // The skip ran under the lease and released it; the recorded template is
    // confirmed current, so the status reads ready.
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject({
      activeTemplateId: 'tpl-0',
      lastBuildAttemptedAt: T0,
      buildClaimedAt: null,
      lastBuildStatus: 'ready',
      buildFailureCount: 0,
    });
    vi.unstubAllGlobals();
  });

  it('retries a failed build on a scheduled tick even when the heads are unchanged', async () => {
    const { seed, project } = await seedEnvironment();
    // A config-change build that failed keeps the heads it failed on; those
    // equal the current heads, which must not excuse the schedule from retrying.
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: {
        activeTemplateId: 'tpl-0',
        activeTemplateHeads: { 'acme/api': SHA_A },
        lastBuildAttemptedAt: hours(-30),
        lastBuildStatus: 'failed',
        lastBuildError: 'pnpm install exited with 1',
        buildFailureCount: 1,
      },
    });
    const { instance, build, logger } = worker(seed, {
      now: () => T0,
      heads: () => SHA_A,
      results: [{ status: 'ready', templateId: 'tpl-1' }],
    });

    await instance.tick();
    await instance.stop();

    expect(build).toHaveBeenCalledTimes(1);
    expect(logger.info).not.toHaveBeenCalledWith('environment build skipped: heads unchanged', expect.anything());
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject({
      activeTemplateId: 'tpl-1',
      lastBuildStatus: 'ready',
      lastBuildError: null,
      buildFailureCount: 0,
    });
    vi.unstubAllGlobals();
  });

  it('claims and builds when a head moved on a scheduled tick, recording the new heads', async () => {
    const { seed, project, link } = await seedEnvironment();
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: {
        activeTemplateId: 'tpl-0',
        activeTemplateHeads: { 'acme/api': SHA_A },
        lastBuildAttemptedAt: hours(-30),
      },
    });
    const { instance, build } = worker(seed, { now: () => T0, heads: () => SHA_B });

    await instance.tick();
    expect(instance.activeBuilds).toBe(1);
    await instance.stop();

    expect(build).toHaveBeenCalledTimes(1);
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject({
      activeTemplateId: 'tpl-1',
      activeTemplateHeads: { 'acme/api': SHA_B },
      lastBuildStatus: 'ready',
      lastBuildAttemptedAt: T0,
      buildClaimedAt: null,
    });
    expect(
      await seed.sourceControl.forIntegration('github').projectRepositories.get({ orgId: 'org-1', id: link.id }),
    ).toMatchObject({ lastBuildStatus: 'configured' });
    vi.unstubAllGlobals();
  });

  it('does not rebuild a project whose last build failed on the next tick', async () => {
    const { seed, project } = await seedEnvironment();
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: {
        lastBuildStatus: 'failed',
        lastBuildError: 'boom',
        lastBuildAttemptedAt: minutes(-5),
        buildFailureCount: 1,
        buildScheduleHours: 1,
        activeTemplateHeads: { 'acme/api': SHA_A },
      },
    });
    const { instance, build } = worker(seed, { now: () => T0, heads: () => SHA_B });

    await instance.tick();

    expect(build).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('builds on the first push, holds the next one for the debounce, and survives a new worker instance', async () => {
    const { seed, project } = await seedEnvironment();
    await seed.projects.update({
      orgId: 'org-1',
      id: project.id,
      input: { buildScheduleEnabled: false, activeTemplateHeads: { 'acme/api': SHA_A } },
    });
    let now = T0;
    const push = {
      orgId: 'org-1',
      factoryProjectId: project.id,
      repositoryExternalId: 'ext-api',
      ref: 'refs/heads/main',
    };
    const first = worker(seed, { now: () => now, heads: () => SHA_B });
    expect(await first.instance.notePush({ ...push, after: SHA_B })).toBe(true);
    await first.instance.tick();
    await first.instance.stop();
    expect(first.build).toHaveBeenCalledTimes(1);

    // A second push inside the window waits; a tick before it elapses builds nothing.
    now = minutes(2);
    expect(await first.instance.notePush({ ...push, after: SHA_B })).toBe(true);
    now = minutes(5);
    await first.instance.tick();
    await first.instance.stop();
    expect(first.build).toHaveBeenCalledTimes(1);

    // Restart: a fresh instance over the same storage, once the window has passed.
    now = minutes(10);
    const second = worker(seed, { now: () => now, heads: () => SHA_B });
    await second.instance.tick();
    await second.instance.stop();
    expect(second.build).toHaveBeenCalledTimes(1);
    await second.instance.tick();
    await second.instance.stop();
    expect(second.build).toHaveBeenCalledTimes(1);
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject({
      buildWindowStartedAt: T0,
      buildWindowCount: 2,
      activeTemplateId: 'tpl-1',
    });
    vi.unstubAllGlobals();
  });

  it('ignores a push to a branch other than the link base branch', async () => {
    const { seed, project } = await seedEnvironment();
    const { instance } = worker(seed, { now: () => T0, heads: () => SHA_B });

    expect(
      await instance.notePush({
        orgId: 'org-1',
        factoryProjectId: project.id,
        repositoryExternalId: 'ext-api',
        ref: 'refs/heads/feature/x',
        after: SHA_B,
      }),
    ).toBe(false);
    expect((await seed.projects.get({ orgId: 'org-1', id: project.id }))?.lastPushAt).toBeNull();
    vi.unstubAllGlobals();
  });

  it('runs a requested build once across two worker instances sharing one storage', async () => {
    const { seed, project } = await seedEnvironment();
    await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildRequestedAt: T0 } });
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    const a = worker(seed, { now: () => T0, heads: () => SHA_A, claims: { wait: gate } });
    const b = worker(seed, { now: () => T0, heads: () => SHA_A, claims: { wait: gate } });

    const tickA = a.instance.tick();
    const tickB = b.instance.tick();
    // Let both reach the claim before either build returns.
    await new Promise(resolve => setTimeout(resolve, 20));
    await Promise.all([tickA, tickB]);
    expect(a.instance.activeBuilds + b.instance.activeBuilds).toBe(1);
    release();
    await Promise.all([a.instance.stop(), b.instance.stop()]);

    expect(a.build.mock.calls.length + b.build.mock.calls.length).toBe(1);
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject({
      buildRequestedAt: null,
      lastBuildStatus: 'ready',
      buildClaimedAt: null,
    });
    vi.unstubAllGlobals();
  });

  it('leaves projects on other sandbox providers alone', async () => {
    const { seed, project } = await seedEnvironment({ sandboxProvider: 'local' });
    await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildRequestedAt: T0 } });
    const { instance, build, fetchMock } = worker(seed, { now: () => T0, heads: () => SHA_A });

    await instance.tick();

    expect(build).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('records a head lookup failure on the project and releases the lease', async () => {
    const { seed, project } = await seedEnvironment();
    await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildRequestedAt: T0 } });
    const { instance, build, fetchMock } = worker(seed, { now: () => T0, heads: () => SHA_A });
    fetchMock.mockResolvedValue({ ok: false, status: 404, text: async () => 'Not Found' } as never);

    await instance.tick();

    expect(build).not.toHaveBeenCalled();
    expect(await seed.projects.get({ orgId: 'org-1', id: project.id })).toMatchObject({
      lastBuildStatus: 'failed',
      lastBuildError: expect.stringContaining('acme/api@main (404)'),
      buildFailureCount: 1,
      buildRequestedAt: null,
      buildClaimedAt: null,
    });
    vi.unstubAllGlobals();
  });

  it('does not call GitHub for a project another replica holds the lease on', async () => {
    const { seed, project } = await seedEnvironment();
    await seed.projects.update({ orgId: 'org-1', id: project.id, input: { buildRequestedAt: T0 } });
    await seed.projects.claimBuild({ orgId: 'org-1', id: project.id, now: minutes(-5), staleAfterMs: 60 * 60_000 });
    const { instance, build, fetchMock } = worker(seed, { now: () => T0, heads: () => SHA_A });

    await instance.tick();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(build).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('ignores a branch deletion push', async () => {
    const { seed, project } = await seedEnvironment();
    const { instance } = worker(seed, { now: () => T0, heads: () => SHA_B });

    expect(
      await instance.notePush({
        orgId: 'org-1',
        factoryProjectId: project.id,
        repositoryExternalId: 'ext-api',
        ref: 'refs/heads/main',
        after: '0000000000000000000000000000000000000000',
      }),
    ).toBe(false);
    expect((await seed.projects.get({ orgId: 'org-1', id: project.id }))?.lastPushAt).toBeNull();
    vi.unstubAllGlobals();
  });
});
