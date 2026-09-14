import type { LeaseProvider } from '@mastra/core/events';
import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GithubIssueReconciler } from '../../github/issue-reconciler.js';
import type { GithubPullRequestReconciler } from '../../github/rules.js';
import type { dispatchGithubWebhook } from '../../github/webhook.js';
import { PlatformApiClient } from '../api-client.js';
import { PlatformGithubEventWorker } from './event-worker.js';
import type { PlatformGithubEventDispatchIntegration, PlatformGithubEventStorage } from './event-worker.js';

const baseUrl = 'https://platform.example.com';
const accessToken = 'platform-token';

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function createSettingsStorage(initial: unknown = null) {
  let value = initial;
  const get = vi.fn(async () => value);
  const save = vi.fn(async (_orgId: string, _userId: string, next: unknown) => {
    value = structuredClone(next);
  });
  return {
    storage: {
      integrationId: 'github',
      settings: { get, save },
    } as unknown as PlatformGithubEventStorage,
    get,
    save,
    read: () => value,
  };
}

function createGithub(): PlatformGithubEventDispatchIntegration {
  return {
    integrationStorage: {} as never,
    sourceControlStorage: {
      sessions: { getBySessionId: async () => ({ userId: 'user-1', orgId: 'org-1' }) },
    },
    getRepositoryCollaboratorPermission: vi.fn<
      PlatformGithubEventDispatchIntegration['getRepositoryCollaboratorPermission']
    >(async () => 'write'),
  };
}

function createDeps(pubsub: unknown = {}): WorkerDeps {
  return {
    pubsub: pubsub as WorkerDeps['pubsub'],
    storage: {} as WorkerDeps['storage'],
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as WorkerDeps['logger'],
  };
}

function createWorker(input: {
  fetchImpl: typeof fetch;
  storage: PlatformGithubEventStorage;
  intervalMs?: number;
  now?: () => number;
  dispatch?: typeof dispatchGithubWebhook;
  ingestFactoryEvent?: (event: Parameters<typeof dispatchGithubWebhook>[0]) => Promise<unknown>;
  reconcileFactoryState?: GithubPullRequestReconciler;
  reconcileIssuesFactoryState?: GithubIssueReconciler;
  reconcileIntervalMs?: number;
  pullRequestReconcileIntervalMs?: number;
  issueReconcileIntervalMs?: number;
  pollEventsEnabled?: boolean;
  github?: PlatformGithubEventDispatchIntegration;
  /**
   * Repositories the worker should treat as linked to a factory project. Pass
   * `[]` for a "nothing configured" scenario. Defaults to the installation/repo
   * pairs the existing fetch mocks use (`installationId: 7`, `repositoryId: 101`).
   */
  configured?: Array<{ installationId: number; repositoryId: number; slug?: string; orgId?: string }>;
}) {
  const configured = input.configured ?? [{ installationId: 7, repositoryId: 101, slug: 'acme/repo', orgId: 'org-1' }];
  const sourceControl = {
    projectRepositories: {
      listConfiguredExternalKeys: vi.fn(async () =>
        configured.map(row => ({
          installationExternalId: String(row.installationId),
          repositoryExternalId: String(row.repositoryId),
        })),
      ),
      listByExternalRepository: vi.fn(async (args: { installationExternalId: string; repositoryExternalId: string }) => {
        const match = configured.find(
          row => String(row.installationId) === args.installationExternalId && String(row.repositoryId) === args.repositoryExternalId,
        );
        return match ? [{ orgId: match.orgId ?? 'org-1', factoryProjectId: 'proj-1' }] : [];
      }),
    },
    repositories: {
      findByExternalId: vi.fn(async (args: { orgId: string; externalId: string }) => {
        const match = configured.find(row => String(row.repositoryId) === args.externalId);
        return match ? { orgId: args.orgId, slug: match.slug ?? '' } : null;
      }),
    },
  };
  return new PlatformGithubEventWorker({
    client: new PlatformApiClient({ baseUrl, accessToken, fetchImpl: input.fetchImpl }),
    controller: {} as never,
    github: input.github ?? createGithub(),
    storage: input.storage,
    sourceControl: sourceControl as never,
    ingestFactoryEvent: input.ingestFactoryEvent,
    reconcileFactoryState: input.reconcileFactoryState,
    reconcileIssuesFactoryState: input.reconcileIssuesFactoryState,
    reconcileIntervalMs: input.reconcileIntervalMs,
    pullRequestReconcileIntervalMs: input.pullRequestReconcileIntervalMs,
    issueReconcileIntervalMs: input.issueReconcileIntervalMs,
    pollEventsEnabled: input.pollEventsEnabled,
    intervalMs: input.intervalMs ?? 1_000,
    now: input.now,
    dispatch: input.dispatch,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('PlatformGithubEventWorker', () => {
  it('polls immediately, isolates malformed events, persists the page cursor, and resumes from it', async () => {
    const settings = createSettingsStorage();
    const dispatch = vi.fn<typeof dispatchGithubWebhook>().mockResolvedValue({
      delivered: 1,
      failed: 0,
      skipped: 0,
      ignored: false,
    });
    const ingestFactoryEvent = vi.fn(async () => ({ status: 'committed' }));
    const eventRequests: URL[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) return json({ repositories: [{ id: 101 }] });
      if (url.pathname.endsWith('/repositories/101/events')) {
        eventRequests.push(url);
        if (url.searchParams.has('afterTimestamp')) {
          return json({
            events: [
              {
                id: '1000-0',
                deliveryId: 'delivery-opened',
                event: 'issues',
                payload: { action: 'opened' },
              },
              {
                id: '1000-1',
                deliveryId: 'delivery-pr-opened',
                event: 'pull_request',
                payload: { action: 'opened' },
              },
              {
                id: '1001-0',
                deliveryId: 'delivery-sync',
                event: 'pull_request',
                payload: { action: 'synchronize' },
              },
              {
                id: '1002-0',
                deliveryId: 'delivery-review-requested',
                event: 'pull_request',
                payload: { action: 'review_requested' },
              },
              {
                id: '1003-0',
                deliveryId: 'delivery-1',
                event: 'pull_request',
                payload: { action: 'closed' },
              },
              {
                id: '1004-0',
                deliveryId: 'delivery-push',
                event: 'push',
                payload: { ref: 'refs/heads/main' },
              },
            ],
            nextCursor: '1004-0',
          });
        }
        return json({ events: [], nextCursor: null });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      now: () => 1_000,
      dispatch,
      ingestFactoryEvent,
    });

    await worker.init(createDeps());
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    const parsedPullRequestOpened = {
      event: 'pull_request',
      deliveryId: 'delivery-pr-opened',
      payload: { action: 'opened' },
    };
    const parsedSynchronize = {
      event: 'pull_request',
      deliveryId: 'delivery-sync',
      payload: { action: 'synchronize' },
    };
    const parsedReviewRequested = {
      event: 'pull_request',
      deliveryId: 'delivery-review-requested',
      payload: { action: 'review_requested' },
    };
    const parsedClosed = {
      event: 'pull_request',
      deliveryId: 'delivery-1',
      payload: { action: 'closed' },
    };
    const parsedPush = {
      event: 'push',
      deliveryId: 'delivery-push',
      payload: { ref: 'refs/heads/main' },
    };
    const dispatchDependencies = expect.objectContaining({
      controller: expect.anything(),
      listSubscriptions: expect.any(Function),
      retireSubscription: expect.any(Function),
      isAuthorizedSender: expect.any(Function),
    });
    // A pull request being opened is what mints its Review card, so it has to
    // reach the rules engine; synchronize and review_requested feed the
    // re-review path, and closed feeds the reconciler. An opened *issue* is
    // deliberately absent — the factory picks new issues up via the reconciler.
    // Pushes feed the base-checkpoint trigger wrapped around the ingest.
    expect(ingestFactoryEvent).toHaveBeenCalledTimes(5);
    expect(ingestFactoryEvent).toHaveBeenNthCalledWith(1, parsedPullRequestOpened);
    expect(ingestFactoryEvent).toHaveBeenNthCalledWith(2, parsedSynchronize);
    expect(ingestFactoryEvent).toHaveBeenNthCalledWith(3, parsedReviewRequested);
    expect(ingestFactoryEvent).toHaveBeenNthCalledWith(4, parsedClosed);
    expect(ingestFactoryEvent).toHaveBeenNthCalledWith(5, parsedPush);
    expect(dispatch).toHaveBeenCalledTimes(6);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      {
        event: 'issues',
        deliveryId: 'delivery-opened',
        payload: { action: 'opened' },
      },
      dispatchDependencies,
    );
    expect(dispatch).toHaveBeenNthCalledWith(2, parsedPullRequestOpened, dispatchDependencies);
    expect(dispatch).toHaveBeenNthCalledWith(3, parsedSynchronize, dispatchDependencies);
    expect(dispatch).toHaveBeenNthCalledWith(4, parsedReviewRequested, dispatchDependencies);
    expect(dispatch).toHaveBeenNthCalledWith(5, parsedClosed, dispatchDependencies);
    expect(dispatch).toHaveBeenNthCalledWith(6, parsedPush, dispatchDependencies);
    expect(eventRequests[0]?.searchParams.get('afterTimestamp')).toBe('999');
    expect(eventRequests[1]?.searchParams.get('afterEventId')).toBe('1004-0');
    expect(settings.read()).toEqual({
      version: 1,
      repositories: { '101': { afterEventId: '1004-0' } },
    });
    await worker.stop();

    eventRequests.length = 0;
    const resumed = createWorker({ fetchImpl, storage: settings.storage, now: () => 9_000, dispatch });
    await resumed.init(createDeps());
    await resumed.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(eventRequests[0]?.searchParams.get('afterEventId')).toBe('1004-0');
    expect(eventRequests[0]?.searchParams.has('afterTimestamp')).toBe(false);
    await resumed.stop();
  });

  it('forwards created PR comments to Factory rules but never retriggers from edits', async () => {
    const settings = createSettingsStorage();
    const dispatch = vi.fn<typeof dispatchGithubWebhook>().mockResolvedValue({
      delivered: 1,
      failed: 0,
      skipped: 0,
      ignored: false,
    });
    const ingestFactoryEvent = vi.fn(async () => ({ status: 'committed' }));
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) {
        return json({ repositories: [{ id: 101 }] });
      }
      if (url.pathname.endsWith('/repositories/101/events')) {
        if (url.searchParams.has('afterTimestamp')) {
          return json({
            events: [
              {
                id: '2000-0',
                deliveryId: 'delivery-review',
                event: 'pull_request_review',
                payload: { action: 'submitted' },
              },
              {
                id: '2001-0',
                deliveryId: 'delivery-comment',
                event: 'issue_comment',
                payload: { action: 'created' },
              },
              {
                id: '2002-0',
                deliveryId: 'delivery-comment-edited',
                event: 'issue_comment',
                payload: { action: 'edited' },
              },
            ],
            nextCursor: '2002-0',
          });
        }
        return json({ events: [], nextCursor: null });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      now: () => 1_000,
      dispatch,
      ingestFactoryEvent,
    });

    await worker.init(createDeps());
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    // A submitted review and a new pull-request comment are the two ways review
    // feedback reaches the agent that authored the branch. Comment edits stay
    // with the subscription dispatcher — re-waking on an edit would double-fire.
    expect(ingestFactoryEvent).toHaveBeenCalledTimes(2);
    expect(ingestFactoryEvent).toHaveBeenNthCalledWith(1, {
      event: 'pull_request_review',
      deliveryId: 'delivery-review',
      payload: { action: 'submitted' },
    });
    expect(ingestFactoryEvent).toHaveBeenNthCalledWith(2, {
      event: 'issue_comment',
      deliveryId: 'delivery-comment',
      payload: { action: 'created' },
    });
    expect(dispatch).toHaveBeenCalledTimes(3);
    await worker.stop();
  });

  it('advances the cursor when one subscription fails so the bad target does not poison later events', async () => {
    const settings = createSettingsStorage();
    const dispatch = vi
      .fn<typeof dispatchGithubWebhook>()
      .mockResolvedValueOnce({ delivered: 1, failed: 1, skipped: 0, ignored: false })
      .mockResolvedValue({ delivered: 1, failed: 0, skipped: 0, ignored: false });
    const eventCursors: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) return json({ repositories: [{ id: 101 }] });
      if (url.pathname.endsWith('/repositories/101/events')) {
        eventCursors.push(url.search);
        if (url.searchParams.get('afterEventId') === '1002-0') return json({ events: [], nextCursor: null });
        if (url.searchParams.get('afterEventId') === '1001-0') {
          return json({
            events: [
              {
                id: '1002-0',
                deliveryId: 'delivery-2',
                event: 'pull_request',
                payload: { action: 'synchronize' },
              },
            ],
            nextCursor: '1002-0',
          });
        }
        return json({
          events: [
            {
              id: '1001-0',
              deliveryId: 'delivery-1',
              event: 'pull_request',
              payload: { action: 'synchronize' },
            },
          ],
          nextCursor: '1001-0',
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const deps = createDeps();
    const worker = createWorker({ fetchImpl, storage: settings.storage, intervalMs: 1_000, dispatch });

    await worker.init(deps);
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(eventCursors[0]).toContain('afterTimestamp=');
    expect(eventCursors[1]).toContain('afterEventId=1001-0');
    expect(eventCursors[2]).toContain('afterEventId=1002-0');
    expect(settings.read()).toEqual({
      version: 1,
      repositories: { '101': { afterEventId: '1002-0' } },
    });
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'Platform GitHub event completed with failed subscription deliveries',
      {
        repositoryId: 101,
        deliveryId: 'delivery-1',
        delivered: 1,
        failed: 1,
      },
    );
    expect(deps.logger.error).not.toHaveBeenCalledWith(
      'Platform GitHub repository event polling failed',
      expect.anything(),
    );
    await worker.stop();
  });

  it('hands the dispatch its integration, so a woken session can be attributed to its owner', async () => {
    const settings = createSettingsStorage();
    const dispatch = vi.fn<typeof dispatchGithubWebhook>().mockResolvedValue({
      delivered: 1,
      failed: 0,
      skipped: 0,
      ignored: false,
    });
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) return json({ repositories: [{ id: 101 }] });
      if (url.pathname.endsWith('/repositories/101/events')) {
        if (url.searchParams.has('afterEventId')) return json({ events: [], nextCursor: null });
        return json({
          events: [{ id: '1001-0', deliveryId: 'delivery-1', event: 'pull_request', payload: { action: 'closed' } }],
          nextCursor: '1001-0',
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const worker = createWorker({ fetchImpl, storage: settings.storage, intervalMs: 1_000, dispatch });

    await worker.init(createDeps());
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(dispatch).toHaveBeenCalledTimes(1);
    const { github } = dispatch.mock.calls[0]![1];
    await expect(github?.sourceControlStorage.sessions.getBySessionId('session-1')).resolves.toEqual({
      userId: 'user-1',
      orgId: 'org-1',
    });
    await worker.stop();
  });

  it('replays an event when Factory ingestion fails before advancing the cursor', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryEvent = vi
      .fn<(event: Parameters<typeof dispatchGithubWebhook>[0]) => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('Factory ingestion failed'))
      .mockResolvedValue({ status: 'deduplicated' });
    const dispatch = vi.fn<typeof dispatchGithubWebhook>().mockResolvedValue({
      delivered: 1,
      failed: 0,
      skipped: 0,
      ignored: false,
    });
    const eventCursors: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) return json({ repositories: [{ id: 101 }] });
      if (url.pathname.endsWith('/repositories/101/events')) {
        eventCursors.push(url.search);
        if (url.searchParams.has('afterEventId')) return json({ events: [], nextCursor: null });
        return json({
          events: [
            {
              id: '1001-0',
              deliveryId: 'delivery-1',
              event: 'issues',
              payload: { action: 'closed' },
            },
          ],
          nextCursor: '1001-0',
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      intervalMs: 1_000,
      dispatch,
      ingestFactoryEvent,
    });

    await worker.init(createDeps());
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(dispatch).not.toHaveBeenCalled();
    expect(settings.read()).toEqual({
      version: 1,
      repositories: { '101': expect.objectContaining({ afterTimestamp: expect.any(Number) }) },
    });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(ingestFactoryEvent).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(eventCursors[0]).toContain('afterTimestamp=');
    expect(eventCursors[1]).toContain('afterTimestamp=');
    expect(settings.read()).toEqual({
      version: 1,
      repositories: { '101': { afterEventId: '1001-0' } },
    });
    await worker.stop();
  });

  it('honors retry-after backoff and never overlaps polling cycles', async () => {
    const settings = createSettingsStorage();
    let releaseEvents!: (response: Response) => void;
    const stalledEvents = new Promise<Response>(resolve => {
      releaseEvents = resolve;
    });
    let eventCalls = 0;
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) return json({ repositories: [{ id: 101 }] });
      if (url.pathname.endsWith('/repositories/101/events')) {
        eventCalls += 1;
        if (eventCalls === 1) return stalledEvents;
        if (eventCalls === 2) return json({ detail: 'Rate limited' }, 429, { 'retry-after': '9' });
        return json({ events: [], nextCursor: null });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const worker = createWorker({ fetchImpl, storage: settings.storage, intervalMs: 1_000 });

    await worker.init(createDeps());
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(5_000);
    expect(eventCalls).toBe(1);

    releaseEvents(json({ events: [], nextCursor: null }));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(eventCalls).toBe(2);
    await vi.advanceTimersByTimeAsync(8_999);
    expect(eventCalls).toBe(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(eventCalls).toBe(3);

    await worker.stop();
  });

  describe('linked-project scoping', () => {
    function pathsFrom(mock: ReturnType<typeof vi.fn<typeof fetch>>): string[] {
      return mock.mock.calls.map(call => new URL(String(call[0])).pathname);
    }

    function eventsOnlyFetch() {
      return vi.fn<typeof fetch>(async input => {
        const url = new URL(String(input));
        if (url.pathname.includes('/repositories/') && url.pathname.endsWith('/events')) {
          return json({ events: [], nextCursor: null });
        }
        throw new Error(`Unexpected request: ${url}`);
      });
    }

    it('polls nothing and makes no platform calls when no factory project is linked to a repository', async () => {
      const settings = createSettingsStorage();
      const fetchImpl = eventsOnlyFetch();
      const worker = createWorker({ fetchImpl, storage: settings.storage, configured: [] });

      await worker.init(createDeps());
      await worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await worker.stop();

      expect(pathsFrom(fetchImpl)).toEqual([]);
    });

    it('polls only the repositories linked to a factory project', async () => {
      const settings = createSettingsStorage();
      const fetchImpl = eventsOnlyFetch();
      const worker = createWorker({
        fetchImpl,
        storage: settings.storage,
        configured: [
          { installationId: 7, repositoryId: 101, slug: 'acme/linked' },
          { installationId: 8, repositoryId: 201, slug: 'other/linked' },
        ],
      });

      await worker.init(createDeps());
      await worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await worker.stop();

      const eventPaths = pathsFrom(fetchImpl)
        .filter(path => path.endsWith('/events'))
        .sort();
      expect(eventPaths).toEqual([
        '/v1/server/github-app/repositories/101/events',
        '/v1/server/github-app/repositories/201/events',
      ]);
    });

    it('picks up newly linked repositories on the next tick without a restart', async () => {
      const settings = createSettingsStorage();
      const fetchImpl = eventsOnlyFetch();
      const configured: Array<{ installationId: number; repositoryId: number; slug: string }> = [
        { installationId: 7, repositoryId: 101, slug: 'acme/first' },
      ];
      const listConfiguredExternalKeys = vi.fn(async () =>
        configured.map(row => ({
          installationExternalId: String(row.installationId),
          repositoryExternalId: String(row.repositoryId),
        })),
      );
      const worker = new PlatformGithubEventWorker({
        client: new PlatformApiClient({ baseUrl, accessToken, fetchImpl }),
        controller: {} as never,
        github: createGithub(),
        storage: settings.storage,
        intervalMs: 1_000,
        sourceControl: {
          projectRepositories: {
            listConfiguredExternalKeys,
            listByExternalRepository: async args => {
              const match = configured.find(
                row =>
                  String(row.installationId) === args.installationExternalId &&
                  String(row.repositoryId) === args.repositoryExternalId,
              );
              return match ? [{ orgId: 'org-1', factoryProjectId: 'proj-1' } as never] : [];
            },
          },
          repositories: {
            findByExternalId: async args => {
              const match = configured.find(row => String(row.repositoryId) === args.externalId);
              return match ? ({ orgId: args.orgId, slug: match.slug } as never) : null;
            },
          },
        },
      });

      await worker.init(createDeps());
      await worker.start();
      await vi.advanceTimersByTimeAsync(0);

      let eventPaths = pathsFrom(fetchImpl).filter(path => path.endsWith('/events'));
      expect(eventPaths).toEqual(['/v1/server/github-app/repositories/101/events']);

      // Link another repo mid-cycle; it should be picked up on the next tick.
      configured.push({ installationId: 7, repositoryId: 102, slug: 'acme/second' });
      await vi.advanceTimersByTimeAsync(1_000);

      eventPaths = pathsFrom(fetchImpl).filter(path => path.endsWith('/events'));
      expect(eventPaths).toContain('/v1/server/github-app/repositories/102/events');

      await worker.stop();
    });

    it('skips configured keys with non-positive or non-numeric external IDs', async () => {
      const settings = createSettingsStorage();
      const fetchImpl = eventsOnlyFetch();
      const worker = createWorker({
        fetchImpl,
        storage: settings.storage,
        configured: [
          { installationId: 0, repositoryId: 101, slug: 'acme/zero-inst' },
          { installationId: 7, repositoryId: -5, slug: 'acme/negative-repo' },
          { installationId: Number.NaN, repositoryId: 102, slug: 'acme/nan-inst' },
          { installationId: 7, repositoryId: 103, slug: 'acme/valid' },
        ],
      });

      await worker.init(createDeps());
      await worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await worker.stop();

      const eventPaths = pathsFrom(fetchImpl).filter(path => path.endsWith('/events'));
      expect(eventPaths).toEqual(['/v1/server/github-app/repositories/103/events']);
    });
  });

  it('stops polling after lease renewal reports ownership loss', async () => {
    const settings = createSettingsStorage();
    const lease: LeaseProvider = {
      acquireLease: vi
        .fn<LeaseProvider['acquireLease']>()
        .mockResolvedValueOnce({ acquired: true, owner: 'worker' })
        .mockResolvedValue({ acquired: false, owner: 'other-worker' }),
      getLeaseOwner: vi.fn(async () => undefined),
      releaseLease: vi.fn(async () => undefined),
      renewLease: vi.fn(async () => false),
      transferLease: vi.fn(async () => true),
    };
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) return json({ installations: [] });
      throw new Error(`Unexpected request: ${url}`);
    });
    const worker = createWorker({ fetchImpl, storage: settings.storage, intervalMs: 11_000 });

    await worker.init(createDeps(lease));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchImpl).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(11_000);
    expect(lease.renewLease).toHaveBeenCalledOnce();
    expect(lease.acquireLease).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledOnce();
    await worker.stop();
    expect(lease.releaseLease).not.toHaveBeenCalled();
  });

  it('coordinates with the lease provider and releases its lease on clean stop', async () => {
    const settings = createSettingsStorage();
    const lease: LeaseProvider = {
      acquireLease: vi.fn(async (_key, owner) => ({ acquired: true, owner })),
      getLeaseOwner: vi.fn(async () => undefined),
      releaseLease: vi.fn(async () => undefined),
      renewLease: vi.fn(async () => true),
      transferLease: vi.fn(async () => true),
    };
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) return json({ installations: [] });
      throw new Error(`Unexpected request: ${url}`);
    });
    const worker = createWorker({ fetchImpl, storage: settings.storage });

    await worker.init(createDeps(lease));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(lease.acquireLease).toHaveBeenCalledWith('platform-github-events:github', expect.any(String), 30_000);
    const owner = vi.mocked(lease.acquireLease).mock.calls[0]?.[1];
    await worker.stop();
    expect(lease.releaseLease).toHaveBeenCalledWith('platform-github-events:github', owner);

    const callsAfterStop = fetchImpl.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchImpl).toHaveBeenCalledTimes(callsAfterStop);
  });

  it('runs the merge reconcile sweep on its own cadence and stays on cadence after a failing sweep', async () => {
    const settings = createSettingsStorage();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) {
        return json({ repositories: [{ id: 101, fullName: 'acme/repo' }, { id: 102 }] });
      }
      if (url.pathname.includes('/repositories/')) {
        return json({ events: [], nextCursor: null });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    let clock = 1_000_000;
    const reconcileFactoryState = vi
      .fn<GithubPullRequestReconciler>()
      .mockResolvedValueOnce({ repositories: 1, checked: 1, merged: 1, closed: 0, failed: 0, errors: [] })
      .mockRejectedValueOnce(new Error('sweep exploded'))
      .mockResolvedValue({ repositories: 1, checked: 1, merged: 0, closed: 0, failed: 0, errors: [] });
    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      now: () => clock,
      reconcileFactoryState,
      reconcileIntervalMs: 5_000,
    });

    await worker.init(createDeps());
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    // First poll sweeps immediately; repositories without a fullName are skipped.
    expect(reconcileFactoryState).toHaveBeenCalledTimes(1);
    expect(reconcileFactoryState).toHaveBeenCalledWith([{ id: 101, fullName: 'acme/repo', installationId: 7 }]);

    // Next poll tick lands inside the reconcile interval: no sweep.
    clock += 1_000;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(reconcileFactoryState).toHaveBeenCalledTimes(1);

    // Past the interval the sweep runs again; this one fails.
    clock += 5_000;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(reconcileFactoryState).toHaveBeenCalledTimes(2);

    // The failure neither breaks polling nor tightens the cadence.
    clock += 1_000;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(reconcileFactoryState).toHaveBeenCalledTimes(2);
    clock += 5_000;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(reconcileFactoryState).toHaveBeenCalledTimes(3);

    await worker.stop();
  });

  it('runs issue reconciliation without a pull-request reconciler', async () => {
    const settings = createSettingsStorage();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) {
        return json({ repositories: [{ id: 101, fullName: 'acme/repo' }] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const reconcileIssuesFactoryState = vi.fn<GithubIssueReconciler>(async () => ({
      repositories: 1,
      checked: 1,
      updated: 0,
      closed: 0,
      failed: 0,
      errors: [],
    }));
    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      now: () => 1_000_000,
      reconcileIssuesFactoryState,
      pollEventsEnabled: false,
    });

    await worker.init(createDeps());
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await worker.stop();

    expect(reconcileIssuesFactoryState).toHaveBeenCalledWith([{ id: 101, fullName: 'acme/repo', installationId: 7 }]);
  });

  it('runs pull-request and issue reconciliation on independent cadences', async () => {
    const settings = createSettingsStorage();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) {
        return json({ repositories: [{ id: 101, fullName: 'acme/repo' }] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    let clock = 1_000_000;
    const reconcileFactoryState = vi.fn<GithubPullRequestReconciler>(async () => ({
      repositories: 1,
      checked: 1,
      merged: 0,
      closed: 0,
      failed: 0,
      errors: [],
    }));
    const reconcileIssuesFactoryState = vi.fn<GithubIssueReconciler>(async () => ({
      repositories: 1,
      checked: 1,
      updated: 0,
      closed: 0,
      failed: 0,
      errors: [],
    }));
    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      now: () => clock,
      reconcileFactoryState,
      reconcileIssuesFactoryState,
      pullRequestReconcileIntervalMs: 5_000,
      issueReconcileIntervalMs: 2_000,
      pollEventsEnabled: false,
    });

    await worker.init(createDeps());
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    clock += 2_000;
    await vi.advanceTimersByTimeAsync(2_000);
    clock += 2_000;
    await vi.advanceTimersByTimeAsync(2_000);
    clock += 2_000;
    await vi.advanceTimersByTimeAsync(2_000);
    await worker.stop();

    expect(reconcileFactoryState).toHaveBeenCalledTimes(2);
    expect(reconcileIssuesFactoryState).toHaveBeenCalledTimes(4);
  });

  it('sweeps once on the first tick and then hourly by default', async () => {
    const settings = createSettingsStorage();
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) {
        return json({ repositories: [{ id: 101, fullName: 'acme/repo' }] });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    let clock = 1_000_000;
    const reconcileFactoryState = vi.fn<GithubPullRequestReconciler>(async () => ({
      repositories: 1,
      checked: 1,
      merged: 0,
      closed: 0,
      failed: 0,
      errors: [],
    }));
    const reconcileIssuesFactoryState = vi.fn<GithubIssueReconciler>(async () => ({
      repositories: 1,
      checked: 1,
      updated: 0,
      closed: 0,
      failed: 0,
      errors: [],
    }));
    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      now: () => clock,
      reconcileFactoryState,
      reconcileIssuesFactoryState,
      intervalMs: 5 * 60_000,
      pollEventsEnabled: false,
    });

    await worker.init(createDeps());
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(reconcileFactoryState).toHaveBeenCalledTimes(1);
    expect(reconcileIssuesFactoryState).toHaveBeenCalledTimes(1);

    // Eleven more five-minute ticks stay inside the hour: no second sweep.
    for (let tick = 0; tick < 11; tick += 1) {
      clock += 5 * 60_000;
      await vi.advanceTimersByTimeAsync(5 * 60_000);
    }
    expect(reconcileFactoryState).toHaveBeenCalledTimes(1);
    expect(reconcileIssuesFactoryState).toHaveBeenCalledTimes(1);

    clock += 5 * 60_000;
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    await worker.stop();
    expect(reconcileFactoryState).toHaveBeenCalledTimes(2);
    expect(reconcileIssuesFactoryState).toHaveBeenCalledTimes(2);
  });

  it('reconciles without tailing events when event polling is disabled', async () => {
    const settings = createSettingsStorage();
    const dispatch = vi.fn<typeof dispatchGithubWebhook>();
    const eventRequests: URL[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) {
        return json({ repositories: [{ id: 101, fullName: 'acme/repo' }] });
      }
      if (url.pathname.includes('/events')) {
        eventRequests.push(url);
        return json({ events: [], nextCursor: null });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const reconcileFactoryState = vi.fn<GithubPullRequestReconciler>(async () => ({
      repositories: 1,
      checked: 2,
      merged: 0,
      closed: 0,
      failed: 1,
      errors: [{ repository: 'acme/repo', pullRequestNumber: 17, error: 'Internal Server Error' }],
    }));
    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      now: () => 1_000_000,
      dispatch,
      reconcileFactoryState,
      pollEventsEnabled: false,
    });

    const deps = createDeps();
    await worker.init(deps);
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(reconcileFactoryState).toHaveBeenCalledWith([{ id: 101, fullName: 'acme/repo', installationId: 7 }]);
    expect(eventRequests).toHaveLength(0);
    expect(dispatch).not.toHaveBeenCalled();

    // Partial failures surface as a warning with per-PR error context.
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'Platform GitHub pull request reconcile sweep completed with failures',
      expect.objectContaining({
        checked: 2,
        merged: 0,
        failed: 1,
        repositories: 1,
        candidateRepositories: 1,
        errors: [{ repository: 'acme/repo', pullRequestNumber: 17, error: 'Internal Server Error' }],
      }),
    );

    await worker.stop();
  });

  describe('sender gate', () => {
    function notification(sender: string, senderType = 'Bot', kind = 'review-changes-requested') {
      return {
        kind,
        metadata: {
          sender,
          senderType,
          repository: 'acme/repo',
          repositoryId: 101,
          installationId: 7,
          pullRequestNumber: 17,
        },
      } as never;
    }

    async function captureGate(github?: PlatformGithubEventDispatchIntegration) {
      const dispatch = vi.fn<typeof dispatchGithubWebhook>().mockResolvedValue({
        delivered: 1,
        failed: 0,
        skipped: 0,
        ignored: false,
      });
      const fetchImpl = vi.fn<typeof fetch>(async input => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/installations')) {
          return json({ installations: [{ installationId: 7, usable: true, suspendedAt: null }] });
        }
        if (url.pathname.endsWith('/installations/7/repositories')) {
          return json({ repositories: [{ id: 101 }] });
        }
        if (url.pathname.endsWith('/repositories/101/events')) {
          if (url.searchParams.has('afterTimestamp')) {
            return json({
              events: [
                { id: '1000-0', deliveryId: 'delivery-1', event: 'issues', payload: { action: 'opened' } },
              ],
              nextCursor: '1000-0',
            });
          }
          return json({ events: [], nextCursor: null });
        }
        throw new Error(`Unexpected request: ${url}`);
      });
      const worker = createWorker({
        fetchImpl,
        storage: createSettingsStorage().storage,
        now: () => 1_000,
        dispatch,
        github,
      });
      const deps = createDeps();
      await worker.init(deps);
      await worker.start();
      await vi.advanceTimersByTimeAsync(0);
      await worker.stop();

      const dependencies = dispatch.mock.calls[0]?.[1];
      if (!dependencies?.isAuthorizedSender) throw new Error('dispatch was not called with a sender gate');
      return { deps, dependencies };
    }

    it('authorizes default bots regardless of login casing', async () => {
      const { dependencies } = await captureGate();

      await expect(dependencies.isAuthorizedSender?.(notification('CodeRabbitAI[bot]'))).resolves.toBe(true);
      await expect(dependencies.isAuthorizedSender?.(notification('devin-ai-integration[bot]'))).resolves.toBe(true);
    });

    it('authorizes bots the deployment opted in and rejects the rest', async () => {
      const { dependencies } = await captureGate({ ...createGithub(), authorizedBots: ['OpenSWEBot'] });

      await expect(dependencies.isAuthorizedSender?.(notification('openswebot'))).resolves.toBe(true);
      // Opting in extends the defaults instead of replacing them.
      await expect(dependencies.isAuthorizedSender?.(notification('coderabbitai[bot]'))).resolves.toBe(true);
      await expect(dependencies.isAuthorizedSender?.(notification('other-reviewer[bot]'))).resolves.toBe(false);
    });

    it('rejects unconfigured bots without consulting collaborator permissions', async () => {
      const github = createGithub();
      const { dependencies } = await captureGate(github);

      await expect(dependencies.isAuthorizedSender?.(notification('openswebot'))).resolves.toBe(false);
      expect(github.getRepositoryCollaboratorPermission).not.toHaveBeenCalled();
    });

    it('gates the kinds the webhook classifier actually emits', async () => {
      const github = createGithub();
      const { dependencies } = await captureGate(github);

      // Sender-authored kinds emitted by classifyGithubWebhook must hit the gate.
      for (const kind of [
        'issue-comment-created',
        'review-comment-created',
        'review-approved',
        'review-changes-requested',
        'review-submitted',
        'review-dismissed',
      ]) {
        await expect(dependencies.isAuthorizedSender?.(notification('other-reviewer[bot]', 'Bot', kind))).resolves.toBe(
          false,
        );
      }
      // Non-authored lifecycle kinds bypass the gate.
      await expect(
        dependencies.isAuthorizedSender?.(notification('other-reviewer[bot]', 'Bot', 'pull-request-merged')),
      ).resolves.toBe(true);
    });

    it('still permission-checks human senders', async () => {
      const github = createGithub();
      const { dependencies } = await captureGate(github);

      await expect(dependencies.isAuthorizedSender?.(notification('octocat', 'User'))).resolves.toBe(true);
      expect(github.getRepositoryCollaboratorPermission).toHaveBeenCalledWith(
        7,
        'acme/repo',
        'octocat',
        expect.anything(),
      );
    });

    it('logs dropped events so an unauthorized sender is not silent', async () => {
      const { deps, dependencies } = await captureGate();

      dependencies.onSenderRejected?.(notification('openswebot'));

      expect(deps.logger.debug).toHaveBeenCalledWith(
        'Platform GitHub event dropped: sender not authorized',
        expect.objectContaining({ sender: 'openswebot', repository: 'acme/repo', kind: 'review-changes-requested' }),
      );
    });
  });
});
