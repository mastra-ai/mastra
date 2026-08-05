import type { LeaseProvider } from '@mastra/core/events';
import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  reconcileIntervalMs?: number;
  pollEventsEnabled?: boolean;
}) {
  return new PlatformGithubEventWorker({
    client: new PlatformApiClient({ baseUrl, accessToken, fetchImpl: input.fetchImpl }),
    controller: {} as never,
    github: createGithub(),
    storage: input.storage,
    ingestFactoryEvent: input.ingestFactoryEvent,
    reconcileFactoryState: input.reconcileFactoryState,
    reconcileIntervalMs: input.reconcileIntervalMs,
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
      ignored: false,
    });
    const ingestFactoryEvent = vi.fn(async () => ({ status: 'committed' }));
    const eventRequests: URL[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/installations')) {
        return json({
          installations: [{ installationId: 7, usable: true, suspendedAt: null }],
        });
      }
      if (url.pathname.endsWith('/installations/7/repositories')) {
        return json({ repositories: [{ id: 101 }] });
      }
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
                id: '1001-0',
                deliveryId: 'delivery-1',
                event: 'pull_request',
                payload: { action: 'closed' },
              },
            ],
            nextCursor: '1001-0',
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

    const parsedEvent = {
      event: 'pull_request',
      deliveryId: 'delivery-1',
      payload: { action: 'closed' },
    };
    const dispatchDependencies = expect.objectContaining({
      controller: expect.anything(),
      listSubscriptions: expect.any(Function),
      retireSubscription: expect.any(Function),
      isAuthorizedSender: expect.any(Function),
    });
    expect(ingestFactoryEvent).toHaveBeenCalledOnce();
    expect(ingestFactoryEvent).toHaveBeenCalledWith(parsedEvent);
    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(dispatch).toHaveBeenNthCalledWith(
      1,
      {
        event: 'issues',
        deliveryId: 'delivery-opened',
        payload: { action: 'opened' },
      },
      dispatchDependencies,
    );
    expect(dispatch).toHaveBeenNthCalledWith(2, parsedEvent, dispatchDependencies);
    expect(eventRequests[0]?.searchParams.get('afterTimestamp')).toBe('999');
    expect(eventRequests[1]?.searchParams.get('afterEventId')).toBe('1001-0');
    expect(settings.read()).toEqual({
      version: 1,
      repositories: { '101': { afterEventId: '1001-0' } },
    });
    await worker.stop();

    eventRequests.length = 0;
    const resumed = createWorker({ fetchImpl, storage: settings.storage, now: () => 9_000, dispatch });
    await resumed.init(createDeps());
    await resumed.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(eventRequests[0]?.searchParams.get('afterEventId')).toBe('1001-0');
    expect(eventRequests[0]?.searchParams.has('afterTimestamp')).toBe(false);
    await resumed.stop();
  });

  it('does not advance the cursor when delivery fails and replays the page on the next cycle', async () => {
    const settings = createSettingsStorage();
    const dispatch = vi
      .fn<typeof dispatchGithubWebhook>()
      .mockResolvedValueOnce({ delivered: 0, failed: 1, ignored: false })
      .mockResolvedValue({ delivered: 1, failed: 0, ignored: false });
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
              event: 'pull_request',
              payload: { action: 'closed' },
            },
          ],
          nextCursor: '1001-0',
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const worker = createWorker({ fetchImpl, storage: settings.storage, intervalMs: 1_000, dispatch });

    await worker.init(createDeps());
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(settings.read()).toEqual({
      version: 1,
      repositories: { '101': expect.objectContaining({ afterTimestamp: expect.any(Number) }) },
    });
    await vi.advanceTimersByTimeAsync(1_000);

    expect(dispatch).toHaveBeenCalledTimes(2);
    expect(eventCursors[0]).toContain('afterTimestamp=');
    expect(eventCursors[1]).toContain('afterTimestamp=');
    expect(settings.read()).toEqual({
      version: 1,
      repositories: { '101': { afterEventId: '1001-0' } },
    });
    await worker.stop();
  });

  it('hands the dispatch its integration, so a woken session can be attributed to its owner', async () => {
    const settings = createSettingsStorage();
    const dispatch = vi.fn<typeof dispatchGithubWebhook>().mockResolvedValue({
      delivered: 1,
      failed: 0,
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
});
