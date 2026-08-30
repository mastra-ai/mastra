import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraFactory } from '../../../factory.js';
import { createPlaintextFactorySecretEncryption } from '../../../secret-encryption.js';
import type { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import { subscribeToPullRequest } from '../../github/subscriptions.js';

import { PlatformGithubIntegration } from './integration.js';

const harness = vi.hoisted(() => {
  let mastra: Mastra | undefined;
  // The resource that owns the subscribed thread. A scoped session is registered
  // under its Factory project, so tests point this at the project under test.
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
    queryThreadById: vi.fn(async ({ threadId }: { threadId: string }) => ({ id: threadId, resourceId: threadResourceId })),
    getSessionByResource: vi.fn<() => Promise<typeof session | undefined>>(async () => session),
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

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv('MASTRA_SHARED_API_URL', 'https://platform.example.com/v1');
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
          sessionScope: '/worktrees/a',
          source: 'explicit-tool',
          subscribedByUserId: 'user-1',
        },
        github.integrationStorage,
      );

      // This subscription is scoped to a worktree, so its thread is owned by the
      // Factory project resource that the session is created under below.
      harness.ownThreadWith(factoryProject.id);
      harness.controller.getSessionByResource.mockResolvedValueOnce(undefined);
      const mastra = new Mastra(args);
      await factory.finalize();
      expect(worker?.isRunning).toBe(true);

      await vi.waitFor(() => expect(harness.sendNotificationSignal).toHaveBeenCalledOnce());
      expect(harness.controller.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'session-1',
          ownerId: 'user-1',
          resourceId: factoryProject.id,
          scope: '/worktrees/a',
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
