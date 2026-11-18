import { MastraConnectError } from '@mastra/connect';
import { EventEmitterPubSub } from '@mastra/core/events';
import type { LeaseProvider } from '@mastra/core/events';
import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import { PlatformGithubLegacyEventPoller } from './legacy-event-poller.js';
import type { PlatformGithubLegacyEventStorage } from './legacy-event-poller.js';
import type { LegacyGithubEvent } from './legacy-events.js';
import type { LegacyGithubEventCursor, LegacyGithubEventLogEntry } from './legacy-transport.js';

const STARTED_AT = 1_000;

type Cursors = Record<string, LegacyGithubEventCursor>;

function settingsStorage(initial: { version: 1; repositories: Cursors } | null = null) {
  let value: unknown = initial;
  return {
    storage: {
      integrationId: 'github',
      settings: {
        get: vi.fn(async () => structuredClone(value)),
        save: vi.fn(async (_orgId: string, _userId: string, next: unknown) => {
          value = structuredClone(next);
        }),
      },
    } as unknown as PlatformGithubLegacyEventStorage,
    cursors: () => (value as { repositories: Cursors } | null)?.repositories ?? {},
  };
}

/** The platform's per-repository legacy event logs, paged the way the platform pages them. */
function legacyLogs() {
  const logs = new Map<number, LegacyGithubEventLogEntry[]>();
  const reads: Array<{ repositoryId: number; cursor: LegacyGithubEventCursor }> = [];
  let fail: (() => Error | undefined) | undefined;
  const transport = {
    listRepositoryEvents: vi.fn(async (repositoryId: number, cursor: LegacyGithubEventCursor, limit: number) => {
      reads.push({ repositoryId, cursor: { ...cursor } });
      const error = fail?.();
      if (error) throw error;
      const after = (entry: LegacyGithubEventLogEntry) =>
        'afterEventId' in cursor
          ? compareIds(entry.id, cursor.afterEventId) > 0
          : Number(entry.id.split('-')[0]) > cursor.afterTimestamp;
      const events = (logs.get(repositoryId) ?? []).filter(after).slice(0, limit);
      return { events, nextCursor: events.at(-1)?.id ?? null };
    }),
  };
  return {
    transport,
    reads,
    append(repositoryId: number, ...ids: string[]) {
      const log = logs.get(repositoryId) ?? [];
      for (const id of ids) log.push({ id, deliveryId: `delivery-${id}`, event: 'pull_request', payload: { id } });
      logs.set(repositoryId, log);
    },
    failWith(next: () => Error | undefined) {
      fail = next;
    },
  };
}

function compareIds(a: string, b: string): number {
  const [aMs = 0, aSeq = 0] = a.split('-').map(Number);
  const [bMs = 0, bSeq = 0] = b.split('-').map(Number);
  return aMs - bMs || aSeq - bSeq;
}

function deps(pubsub: unknown = {}): WorkerDeps {
  return {
    pubsub: pubsub as WorkerDeps['pubsub'],
    storage: {} as WorkerDeps['storage'],
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as WorkerDeps['logger'],
  };
}

function poller(options: {
  logs: ReturnType<typeof legacyLogs>;
  storage: PlatformGithubLegacyEventStorage;
  repositoryIds?: () => Promise<number[]>;
  handle?: (event: LegacyGithubEvent) => Promise<void>;
  intervalMs?: number;
}) {
  const handled: LegacyGithubEvent[] = [];
  const reconcile = vi.fn();
  const worker = new PlatformGithubLegacyEventPoller({
    transport: options.logs.transport,
    storage: options.storage,
    repositoryIds: options.repositoryIds ?? (async () => [99]),
    handle: async event => {
      await options.handle?.(event);
      handled.push(event);
    },
    reconcile,
    intervalMs: options.intervalMs ?? 20,
    retryDelayMs: 1,
    now: () => STARTED_AT + 1,
  });
  return { worker, handled, reconcile };
}

async function start(worker: PlatformGithubLegacyEventPoller, workerDeps = deps()) {
  await worker.init(workerDeps);
  await worker.start();
  onTestFinished(() => worker.stop());
  return workerDeps;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('PlatformGithubLegacyEventPoller', () => {
  it('starts a new repository at the time it started, delivers in order, and resumes from its saved cursor', async () => {
    const logs = legacyLogs();
    // Logged before the poller started: the reconcile's to repair, not the poller's to replay.
    logs.append(99, '900-0');
    const settings = settingsStorage();
    const first = poller({ logs, storage: settings.storage });
    await start(first.worker);

    await vi.waitFor(() => expect(logs.reads[0]).toEqual({ repositoryId: 99, cursor: { afterTimestamp: STARTED_AT } }));
    logs.append(99, '1500-0', '1500-1');
    await vi.waitFor(() => expect(first.handled.map(event => event.id)).toEqual(['1500-0', '1500-1']));
    expect(first.handled[0]).toEqual({
      id: '1500-0',
      timestamp: 1500,
      event: 'pull_request',
      deliveryId: 'delivery-1500-0',
      payload: { id: '1500-0' },
    });
    await vi.waitFor(() => expect(settings.cursors()).toEqual({ '99': { afterEventId: '1500-1' } }));
    await first.worker.stop();

    // A restarted poller reads on from the saved cursor, never replaying what it already handled.
    logs.append(99, '1600-0');
    const second = poller({ logs, storage: settings.storage });
    await start(second.worker);
    await vi.waitFor(() => expect(second.handled.map(event => event.id)).toEqual(['1600-0']));
    expect(logs.reads.at(-1)?.cursor).toEqual({ afterEventId: '1600-0' });
  });

  it('reads only linked repositories and picks up a newly linked one on the next cycle', async () => {
    const logs = legacyLogs();
    const linked = [99];
    const { worker, handled } = poller({
      logs,
      storage: settingsStorage().storage,
      repositoryIds: async () => [...linked],
    });
    await start(worker);

    await vi.waitFor(() => expect(logs.reads.length).toBeGreaterThan(0));
    expect(new Set(logs.reads.map(read => read.repositoryId))).toEqual(new Set([99]));

    linked.push(100);
    logs.append(100, '2000-0');
    await vi.waitFor(() => expect(handled.map(event => event.id)).toEqual(['2000-0']));
  });

  it('retries a failing event, then skips it and reconciles so it does not block the log', async () => {
    const logs = legacyLogs();
    logs.append(99, '1500-0', '1500-1');
    const attempts = new Map<string, number>();
    const { worker, handled, reconcile } = poller({
      logs,
      storage: settingsStorage().storage,
      handle: async event => {
        attempts.set(event.id, (attempts.get(event.id) ?? 0) + 1);
        if (event.id === '1500-0') throw new Error('ingestion failed');
      },
    });
    const workerDeps = await start(worker);

    await vi.waitFor(() => expect(handled.map(event => event.id)).toEqual(['1500-1']));
    expect(attempts.get('1500-0')).toBe(3);
    expect(reconcile).toHaveBeenCalledOnce();
    expect(worker.diagnostics()).toMatchObject({ handlerFailures: 1 });
    expect(workerDeps.logger.error).toHaveBeenCalledWith(
      'Platform GitHub events: giving up on an event; reconciling to repair it',
      expect.objectContaining({ repositoryId: 99, eventId: '1500-0', attempts: 3 }),
    );
  });

  it('waits out a rate limit before reading again and never overlaps cycles', async () => {
    vi.useFakeTimers();
    const logs = legacyLogs();
    let limited = true;
    logs.failWith(() => {
      if (!limited) return undefined;
      limited = false;
      return new MastraConnectError('platform_error', 'slow down', { status: 429, retryAfterMs: 5_000 });
    });
    let inFlight = 0;
    let maxInFlight = 0;
    logs.transport.listRepositoryEvents.mockImplementation(
      (
        original =>
        async (...args: Parameters<typeof original>) => {
          inFlight += 1;
          maxInFlight = Math.max(maxInFlight, inFlight);
          try {
            return await original(...args);
          } finally {
            inFlight -= 1;
          }
        }
      )(logs.transport.listRepositoryEvents.getMockImplementation()!),
    );
    const { worker } = poller({
      logs,
      storage: settingsStorage().storage,
      repositoryIds: async () => [99, 100],
      intervalMs: 1_000,
    });
    await start(worker);

    await vi.advanceTimersByTimeAsync(0);
    // The rate limit stops the cycle: repository 100 is not read until the retry.
    expect(logs.reads.map(read => read.repositoryId)).toEqual([99]);
    await vi.advanceTimersByTimeAsync(4_900);
    expect(logs.reads).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(200);
    expect(logs.reads.map(read => read.repositoryId)).toEqual([99, 99, 100]);
    expect(maxInFlight).toBe(1);
  });

  it('polls under a lease and releases it on a clean stop', async () => {
    const pubsub = new EventEmitterPubSub();
    const releaseLease = vi.spyOn(pubsub, 'releaseLease');
    const logs = legacyLogs();
    const { worker } = poller({ logs, storage: settingsStorage().storage });
    await start(worker, deps(pubsub));

    await vi.waitFor(() => expect(logs.reads.length).toBeGreaterThan(0));
    expect(await pubsub.getLeaseOwner('platform-github-events:github')).toEqual(expect.any(String));

    // A second replica waits for the lease instead of reading the same logs.
    const otherLogs = legacyLogs();
    const other = poller({ logs: otherLogs, storage: settingsStorage().storage });
    await start(other.worker, deps(pubsub));
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(otherLogs.reads).toEqual([]);

    await worker.stop();
    expect(releaseLease).toHaveBeenCalledWith('platform-github-events:github', expect.any(String));
    await vi.waitFor(() => expect(otherLogs.reads.length).toBeGreaterThan(0));
  });

  it('stops reading once lease renewal reports the lease is lost', async () => {
    vi.useFakeTimers();
    let renewed = true;
    const leases: LeaseProvider = {
      acquireLease: vi.fn(async () => ({ acquired: renewed })),
      renewLease: vi.fn(async () => renewed),
      releaseLease: vi.fn(async () => undefined),
      getLeaseOwner: vi.fn(async () => undefined),
      transferLease: vi.fn(async () => false),
    } as unknown as LeaseProvider;
    const logs = legacyLogs();
    const { worker } = poller({ logs, storage: settingsStorage().storage, intervalMs: 1_000 });
    await start(worker, deps(leases));

    await vi.advanceTimersByTimeAsync(0);
    expect(logs.reads).toHaveLength(1);
    renewed = false;
    // Renewal runs every third of the 30-second lease.
    await vi.advanceTimersByTimeAsync(10_000);
    const readsAtLoss = logs.reads.length;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(logs.reads).toHaveLength(readsAtLoss);
    expect(worker.diagnostics()).toMatchObject({ hasLease: false });
  });
});
