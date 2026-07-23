import { EventEmitterPubSub } from '@mastra/core/events';
import { Mastra } from '@mastra/core/mastra';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MastraFactory } from '../../../factory.js';
import { FactoryGithubEventService } from '../../../rules/github-service.js';
import { subscribeToPullRequest } from '../../github/subscriptions.js';

import { PlatformGithubIntegration } from './integration.js';

const harness = vi.hoisted(() => {
  let mastra: Mastra | undefined;
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
    getSessionByResource: vi.fn(async () => session),
    createSession: vi.fn(async () => session),
  };

  return {
    controller,
    sendNotificationSignal,
    reset() {
      mastra = undefined;
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
  it('prepares, starts, ingests and delivers once, and releases its timer and lease on stop', async () => {
    const storage = new LibSQLFactoryStorage({ url: ':memory:', id: 'platform-worker-lifecycle' });
    const pubsub = new EventEmitterPubSub();
    const ingestFactoryEvent = vi.spyOn(FactoryGithubEventService.prototype, 'ingest').mockResolvedValue({
      status: 'committed',
    });
    const releaseLease = vi.spyOn(pubsub, 'releaseLease');
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) {
        return json({ repositories: [{ id: 99 }] });
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
                  action: 'closed',
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
    const factory = new MastraFactory({ storage, pubsub, integrations: [github] });

    try {
      const args = await factory.prepare();
      const worker = Array.isArray(args.workers)
        ? args.workers.find(candidate => candidate.name === 'platform-github-events')
        : undefined;
      expect(worker?.name).toBe('platform-github-events');
      expect(worker?.isRunning).toBe(false);

      await subscribeToPullRequest(
        {
          orgId: 'org-1',
          installationExternalId: '7',
          projectRepositoryId: 'project-repository-1',
          repositoryExternalId: '99',
          repositorySlug: 'octo/hello',
          changeRequestId: '34',
          sessionId: 'session-1',
          ownerId: 'owner-1',
          resourceId: 'resource-1',
          threadId: 'thread-1',
          sessionScope: '/worktrees/a',
          source: 'explicit-tool',
          subscribedByUserId: 'user-1',
        },
        github.integrationStorage,
      );

      const mastra = new Mastra(args);
      await factory.finalize();
      expect(worker?.isRunning).toBe(true);

      await vi.waitFor(() => expect(harness.sendNotificationSignal).toHaveBeenCalledOnce());
      expect(ingestFactoryEvent).toHaveBeenCalledOnce();
      expect(ingestFactoryEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'pull_request',
          deliveryId: 'delivery-1',
          payload: expect.objectContaining({ action: 'closed' }),
        }),
      );
      expect(await pubsub.getLeaseOwner('platform-github-events:github')).toEqual(expect.any(String));

      await mastra.stopWorkers();

      expect(worker?.isRunning).toBe(false);
      expect(harness.sendNotificationSignal).toHaveBeenCalledOnce();
      expect(releaseLease).toHaveBeenCalledOnce();
      expect(await pubsub.getLeaseOwner('platform-github-events:github')).toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      await harness.controller.getMastra()?.stopWorkers();
      await storage.close();
    }
  });
});
