import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { FactorySandbox } from '@mastra/core/workspace';
import type { FactorySandboxBuilds } from '@mastra/core/workspace';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ENVIRONMENT_BUILD_WORKFLOW_ID } from '../../../environment/build-workflow.js';
import { MastraFactory } from '../../../factory.js';
import { createPlaintextFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import { createIsolatedFactoryPostgresForTests } from '../../../storage/test-utils.js';
import { subscribeToPullRequest } from '../../github/subscriptions.js';

import { PlatformGithubIntegration } from './integration.js';

const harness = vi.hoisted(() => {
  let mastra: Mastra | undefined;
  // The resource that owns the subscribed thread. A Factory session runs under
  // its Factory project, so tests point this at the project under test.
  let threadResourceId = 'resource-1';
  const sendNotificationSignal = vi.fn(async () => ({
    record: { id: 'notification-1' },
    decision: { action: 'deliver' as const },
  }));
  const session = {
    thread: { getId: () => 'thread-1', switch: vi.fn(async () => undefined) },
    sendNotificationSignal,
  };
  const controller = {
    id: 'code',
    init: vi.fn(async () => undefined),
    __registerMastra: vi.fn((instance: Mastra) => {
      mastra = instance;
    }),
    getMastra: vi.fn(() => mastra),
    // Delivery reads the subscribed thread first to confirm this deployment
    // holds it and to learn which resource owns it.
    queryThreadById: vi.fn(async ({ threadId }: { threadId: string }) => ({
      id: threadId,
      resourceId: threadResourceId,
    })),
    getSession: vi.fn<() => Promise<typeof session | undefined>>(async () => session),
    createSession: vi.fn(async (_input: { requestContext: { get(key: string): unknown } }) => session),
    onSessionCreated: vi.fn(),
    // Mastra's constructor probes each controller for channels wiring.
    getChannels: vi.fn(() => undefined),
  };

  return {
    controller,
    sendNotificationSignal,
    ownThreadWith(resourceId: string) {
      threadResourceId = resourceId;
    },
    reset() {
      mastra = undefined;
      threadResourceId = 'resource-1';
      vi.clearAllMocks();
    },
  };
});

vi.mock('@mastra/code-sdk', () => ({
  prepareAgentControllerMount: vi.fn(async (config: Record<string, unknown>) => {
    const controllerId = String(config.controllerId ?? 'code');
    const controller = harness.controller;
    return {
      base: { controller, authStorage: {} },
      mastraArgs: {
        agentControllers: { [controllerId]: controller },
        storage: config.storage,
        ...(config.pubsub ? { pubsub: config.pubsub } : {}),
      },
      finalize: async () => {
        await controller.init();
        await controller.getMastra()?.startWorkers();
      },
    };
  }),
}));

const SHA_NEW = 'b'.repeat(40);

// GitHub's branch-head lookup is the outer edge the build resolves heads through.
vi.mock('../../github/commits.js', async importOriginal => ({
  ...(await importOriginal<typeof import('../../github/commits.js')>()),
  getBranchHead: vi.fn(async () => SHA_NEW),
}));

class TemplateBuildingSandbox extends FactorySandbox<Record<string, unknown>> {
  readonly provider = 'recording';
  readonly started: string[] = [];
  readonly builds: FactorySandboxBuilds<Record<string, unknown>> = {
    start: async ctx => {
      this.started.push(ctx.sessionId);
      return { buildId: 'build-1', templateId: 'tpl-1', status: 'building' };
    },
    get: async (_ctx, _settings, buildId) => ({ buildId, templateId: 'tpl-1', status: 'ready' }),
  };
  create(): never {
    throw new Error('sessions are not started in this test');
  }
}

async function storageForBackend() {
  if (process.env.FACTORY_TEST_STORAGE_BACKEND === 'postgres') {
    const url = process.env.FACTORY_TEST_POSTGRES_URL;
    if (!url) throw new Error('FACTORY_TEST_POSTGRES_URL is required for the Postgres test backend.');
    return createIsolatedFactoryPostgresForTests(url);
  }
  return new LibSQLFactoryStorage({ url: ':memory:', id: 'platform-push-rebuild' });
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('MASTRA_INTEGRATIONS_API_URL', 'https://platform.example.com');
  vi.stubEnv('MASTRA_PLATFORM_SECRET_KEY', 'platform-token');
  vi.stubEnv('MASTRA_PLATFORM_GITHUB_POLLING_INTERVAL_MS', '60000');
  harness.reset();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Platform GitHub event worker factory lifecycle', () => {
  it('prepares, starts, delivers once, and releases its timer and lease on stop', async () => {
    const storage = new LibSQLFactoryStorage({ url: ':memory:', id: 'platform-worker-lifecycle' });
    const pubsub = new EventEmitterPubSub();
    const releaseLease = vi.spyOn(pubsub, 'releaseLease');
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) {
        return json({ repositories: [{ id: 99, fullName: 'octo/hello' }] });
      }
      if (url.pathname.endsWith('/repositories/99/events')) {
        if (url.searchParams.has('afterTimestamp')) {
          return json({
            events: [
              {
                id: '1001-0',
                deliveryId: 'delivery-1',
                event: 'pull_request',
                payload: {
                  action: 'synchronize',
                  installation: { id: 7 },
                  repository: { id: 99, full_name: 'octo/hello' },
                  sender: { login: 'ada' },
                  pull_request: { number: 34 },
                },
              },
            ],
            nextCursor: '1001-0',
          });
        }
        return json({ events: [], nextCursor: null });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    vi.stubGlobal('fetch', fetchImpl);
    const github = new PlatformGithubIntegration();
    const factory = new MastraFactory({
      secretEncryption: createPlaintextFactorySecretEncryption(),
      storage,
      pubsub,
      integrations: [github],
    });

    try {
      const args = await factory.prepare();
      const worker = Array.isArray(args.workers)
        ? args.workers.find(candidate => candidate.name === 'platform-github-events')
        : undefined;
      expect(worker?.name).toBe('platform-github-events');
      expect(worker?.isRunning).toBe(false);

      const projects = storage.getDomain<FactoryProjectsStorage>('projects');
      const factoryProject = await projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'App' } });
      const installation = await github.sourceControlStorage.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: '7',
      });
      const repository = await github.sourceControlStorage.repositories.upsert({
        orgId: 'org-1',
        input: { installationId: installation.id, externalId: '99', slug: 'octo/hello', defaultBranch: 'main' },
      });
      const connection = await github.sourceControlStorage.connections.create({
        orgId: 'org-1',
        factoryProjectId: factoryProject.id,
        installationId: installation.id,
        createdByUserId: 'user-1',
      });
      const projectRepository = await github.sourceControlStorage.projectRepositories.link({
        orgId: 'org-1',
        connectionId: connection.id,
        repositoryId: repository.id,
        createdByUserId: 'user-1',
        sandboxProvider: 'local',
        sandboxWorkdir: '/tmp/app',
      });
      await github.sourceControlStorage.sessions.create({
        sessionId: 'session-1',
        projectRepositoryId: projectRepository.id,
        orgId: 'org-1',
        userId: 'user-1',
        branch: 'feat/polling',
        baseBranch: 'main',
      });
      await subscribeToPullRequest(
        {
          orgId: 'org-1',
          installationExternalId: '7',
          projectRepositoryId: projectRepository.id,
          repositoryExternalId: '99',
          repositorySlug: 'octo/hello',
          changeRequestId: '34',
          sessionId: 'session-1',
          ownerId: 'owner-1',
          resourceId: factoryProject.id,
          threadId: 'thread-1',
          source: 'explicit-tool',
          subscribedByUserId: 'user-1',
        },
        github.integrationStorage,
      );

      // The subscribed thread is owned by the Factory project resource that the
      // session is created under below.
      harness.ownThreadWith(factoryProject.id);
      harness.controller.getSession.mockResolvedValueOnce(undefined);
      const mastra = new Mastra(args);
      await factory.finalize();
      expect(worker?.isRunning).toBe(true);

      await vi.waitFor(() => expect(harness.sendNotificationSignal).toHaveBeenCalledOnce());
      expect(harness.controller.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'session-1',
          ownerId: 'user-1',
          resourceId: factoryProject.id,
          requestContext: expect.anything(),
        }),
      );
      const requestContext = harness.controller.createSession.mock.calls[0]![0].requestContext;
      expect(requestContext.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
      expect(await pubsub.getLeaseOwner('platform-github-events:github')).toEqual(expect.any(String));

      await mastra.stopWorkers();

      expect(worker?.isRunning).toBe(false);
      expect(harness.sendNotificationSignal).toHaveBeenCalledOnce();
      expect(releaseLease).toHaveBeenCalledWith('platform-github-events:github', expect.any(String));
      expect(await pubsub.getLeaseOwner('platform-github-events:github')).toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await harness.controller.getMastra()?.stopWorkers();
      await storage.close();
    }
  });
});

describe('Platform GitHub push rebuilds the environment template', () => {
  // Shipyard: build-on-push on, 60-minute debounce, GitHub through the Platform
  // lane (events arrive only through the polling worker). The worker's
  // integration context is built without `onRepositoryPush`, so the push reaches
  // `GithubRules.#handOffPush` with no hook and is dropped; `last_push_build_at`
  // never moves.
  it('starts a template build when the default branch of an environment repository is pushed', async () => {
    const storage = await storageForBackend();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) {
        return json({ repositories: [{ id: 99, fullName: 'octo/hello' }] });
      }
      if (url.pathname.endsWith('/repositories/99/events')) {
        if (url.searchParams.has('afterTimestamp')) {
          return json({
            events: [
              {
                id: '1001-0',
                deliveryId: 'delivery-push',
                event: 'push',
                payload: {
                  ref: 'refs/heads/main',
                  after: SHA_NEW,
                  installation: { id: 7 },
                  repository: { id: 99, full_name: 'octo/hello', default_branch: 'main' },
                  sender: { login: 'ada' },
                },
              },
            ],
            nextCursor: '1001-0',
          });
        }
        return json({ events: [], nextCursor: null });
      }
      return json({});
    });
    vi.stubGlobal('fetch', fetchImpl);
    const github = new PlatformGithubIntegration();
    const sandbox = new TemplateBuildingSandbox();
    const factory = new MastraFactory({
      secretEncryption: createPlaintextFactorySecretEncryption(),
      storage,
      sandbox,
      integrations: [github],
    });

    try {
      const args = await factory.prepare();
      const projects = storage.getDomain<FactoryProjectsStorage>('projects');
      const project = await projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Shipyard' } });
      await projects.update({
        orgId: 'org-1',
        id: project.id,
        input: { buildOnPushEnabled: true, buildPushDebounceMinutes: 60 },
      });
      const installation = await github.sourceControlStorage.installations.upsert({
        orgId: 'org-1',
        connectedByUserId: 'user-1',
        externalId: '7',
      });
      const repository = await github.sourceControlStorage.repositories.upsert({
        orgId: 'org-1',
        input: { installationId: installation.id, externalId: '99', slug: 'octo/hello', defaultBranch: 'main' },
      });
      const connection = await github.sourceControlStorage.connections.create({
        orgId: 'org-1',
        factoryProjectId: project.id,
        installationId: installation.id,
        createdByUserId: 'user-1',
      });
      const link = await github.sourceControlStorage.projectRepositories.link({
        orgId: 'org-1',
        connectionId: connection.id,
        repositoryId: repository.id,
        createdByUserId: 'user-1',
        sandboxProvider: 'platform',
        sandboxWorkdir: '/workspace/octo/hello',
      });
      expect(link.inEnvironment).toBe(true);

      new Mastra(args);
      await factory.finalize();

      await vi.waitFor(async () => {
        const fetched = fetchImpl.mock.calls.map(([input]) => new URL(String(input)).pathname);
        expect(fetched.some(path => path.endsWith('/repositories/99/events'))).toBe(true);
      });
      await vi.waitFor(async () => {
        expect((await projects.getById({ id: project.id }))?.lastPushBuildAt).toBeInstanceOf(Date);
      });
      expect(sandbox.started).toEqual([`environment-build:${project.id}`]);
      // Sessions boot the new template once its build is ready.
      await vi.waitFor(async () => {
        const built = await projects.getById({ id: project.id });
        expect(built?.activeTemplateId).toBe('tpl-1');
        expect(built?.activeTemplateHeads).toEqual({ 'octo/hello': SHA_NEW });
      });
      // The finished build checks once more for a saved change; nothing changed, so it ends without one.
      const workflow = harness.controller.getMastra()!.getWorkflow(ENVIRONMENT_BUILD_WORKFLOW_ID);
      await vi.waitFor(async () => {
        const { runs } = await workflow.listWorkflowRuns();
        const statuses = runs.flatMap(({ snapshot }) =>
          typeof snapshot !== 'string' && snapshot.context.input?.projectId === project.id ? [snapshot.status] : [],
        );
        expect(statuses.sort()).toEqual(['success', 'success']);
      });
      expect(sandbox.started).toHaveLength(1);
    } finally {
      await harness.controller.getMastra()?.stopWorkers();
      await storage.close();
    }
  });
});
