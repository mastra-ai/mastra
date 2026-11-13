import { EventEmitterPubSub } from '@mastra/core/events';
import type { WorkerDeps } from '@mastra/core/worker';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { PlatformConnectBinding } from './connect-binding.js';
import { PlatformEventsWorker } from './events-worker.js';
import type {
  PlatformConnectEventDelivery,
  PlatformConnectEventRoute,
  PlatformEventsWorkerStorage,
  PlatformTopicSubscription,
} from './events-worker.js';
import { startFakePlatform } from './test-utils.js';
import type { FakePlatform } from './test-utils.js';

function memoryStorage(initial: unknown = null) {
  let value = structuredClone(initial);
  const storage = {
    integrationId: 'platform',
    settings: {
      get: async () => structuredClone(value),
      save: async (_orgId: string, _userId: string, next: unknown) => {
        value = structuredClone(next);
      },
    },
  } as unknown as PlatformEventsWorkerStorage;
  const stored = (topic = 'connect') =>
    (value as { cursors?: Record<string, { eventId?: string; timestamp?: number }> } | null)?.cursors?.[topic];
  return { storage, stored, cursor: (topic = 'connect') => stored(topic)?.eventId };
}

function deps(pubsub = new EventEmitterPubSub()) {
  const logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  return { pubsub, storage: {}, logger } as unknown as WorkerDeps & { logger: typeof logger };
}

/** A route that records the events it handles; `handle` can be replaced per test. */
function recordingRoute(platform: FakePlatform, integrationId: string, providerKeys = [integrationId]) {
  const handled: PlatformConnectEventDelivery[] = [];
  const route = {
    binding: new PlatformConnectBinding({
      integrationId,
      providerKeys,
      connect: platform.connect(),
      cacheTtlMs: 60_000,
    }),
    handle: vi.fn(async (event: PlatformConnectEventDelivery) => {
      handled.push(event);
    }),
    reconcile: vi.fn(),
  } satisfies PlatformConnectEventRoute;
  return { route, handled };
}

async function platformWith(connections: Array<{ id: string; integrationId: string }>) {
  const platform = await startFakePlatform();
  platform.orgConnections = connections.map(connection => ({ ...connection, status: 'active' }));
  for (const connection of connections) platform.linked.add(connection.id);
  return platform;
}

async function startWorker(
  platform: FakePlatform,
  options: {
    routes: PlatformConnectEventRoute[];
    storage?: PlatformEventsWorkerStorage;
    topics?: PlatformTopicSubscription[];
    pubsub?: EventEmitterPubSub;
    leaseTtlMs?: number;
  },
) {
  const worker = new PlatformEventsWorker({
    events: platform.connect().events,
    storage: options.storage ?? memoryStorage().storage,
    routes: options.routes,
    ...(options.topics ? { topics: options.topics } : {}),
    retryDelayMs: 5,
    resubscribeDelayMs: 20,
    ...(options.leaseTtlMs ? { leaseTtlMs: options.leaseTtlMs } : {}),
  });
  const workerDeps = deps(options.pubsub);
  await worker.init(workerDeps);
  await worker.start();
  onTestFinished(() => worker.stop());
  return { worker, logger: workerDeps.logger };
}

/** Waits until the worker has an open stream on the fake events service. */
async function subscribed(platform: FakePlatform, streams = 1) {
  await vi.waitFor(() => expect(platform.openStreams).toBe(streams), { timeout: 2_000 });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => (resolve = r));
  return { promise, resolve };
}

describe('PlatformEventsWorker', () => {
  it("routes each connect event to the integration that owns its provider key, keyed on the provider's delivery id", async () => {
    const platform = await platformWith([
      { id: 'conn-jira', integrationId: 'jira' },
      { id: 'conn-gitlab', integrationId: 'gitlab' },
    ]);
    const jira = recordingRoute(platform, 'jira');
    const gitlab = recordingRoute(platform, 'gitlab');
    const { storage, cursor } = memoryStorage();
    await startWorker(platform, { routes: [jira.route, gitlab.route], storage });
    await subscribed(platform);

    platform.publishConnect({
      connectionId: 'conn-jira',
      integrationId: 'jira',
      eventType: 'jira:issue_updated',
      payload: { issue: { id: '10001' } },
      sourceEventId: 'atl-1',
    });
    const unknown = platform.publishConnect({
      connectionId: 'conn-slack',
      integrationId: 'slack',
      eventType: 'message',
      payload: {},
    });
    const gitlabEvent = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: { object_kind: 'issue' },
    });

    await vi.waitFor(() => expect(cursor()).toBe(gitlabEvent));
    expect(jira.handled).toEqual([
      expect.objectContaining({
        connectionId: 'conn-jira',
        eventType: 'jira:issue_updated',
        payload: { issue: { id: '10001' } },
        dedupeKey: 'atl-1',
        unverified: false,
      }),
    ]);
    expect(gitlab.handled).toEqual([expect.objectContaining({ id: gitlabEvent, dedupeKey: gitlabEvent })]);
    // The unknown provider's event was skipped, and the cursor moved past it.
    expect(BigInt(cursor()!)).toBeGreaterThan(BigInt(unknown));
  });

  it('passes unverified events to the integration flagged as such', async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    const gitlab = recordingRoute(platform, 'gitlab');
    await startWorker(platform, { routes: [gitlab.route] });
    await subscribed(platform);

    platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Note Hook',
      payload: {},
      unverified: true,
    });
    await vi.waitFor(() => expect(gitlab.handled).toEqual([expect.objectContaining({ unverified: true })]));
  });

  it('saves the cursor only after the handler finishes, so an event cut off mid-handling is replayed', async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    const { storage, cursor } = memoryStorage();
    const first = recordingRoute(platform, 'gitlab');
    const handling = deferred();
    const release = deferred();
    const { worker } = await startWorker(platform, { routes: [first.route], storage });
    await subscribed(platform);
    const start = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: {},
    });
    await vi.waitFor(() => expect(cursor()).toBe(start));
    first.route.handle.mockImplementationOnce(async () => {
      handling.resolve();
      await release.promise;
    });

    const id = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: {},
    });
    await handling.promise;
    expect(cursor()).toBe(start);

    // The process goes away while the handler is still running.
    const stopped = worker.stop();
    release.resolve();
    await stopped;
    expect(cursor()).toBe(start);

    const second = recordingRoute(platform, 'gitlab');
    await startWorker(platform, { routes: [second.route], storage });
    await vi.waitFor(() => expect(second.handled.map(event => event.id)).toEqual([id]));
    await vi.waitFor(() => expect(cursor()).toBe(id));
    expect(second.route.reconcile).not.toHaveBeenCalled();
    expect(platform.streamRequests.at(-1)).toEqual({ topic: 'connect', lastEventId: start });
  });

  it('resumes from the saved cursor after a restart without reconciling, and gets the events sent while it was down', async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    const { storage, cursor, stored } = memoryStorage();
    const first = recordingRoute(platform, 'gitlab');
    const { worker } = await startWorker(platform, { routes: [first.route], storage });
    await subscribed(platform);
    const before = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: { n: 1 },
    });
    await vi.waitFor(() => expect(cursor()).toBe(before));
    // The event's time is saved with its id, so a rejected id can resume by time.
    expect(stored()).toEqual({ eventId: before, timestamp: expect.any(Number) });
    await worker.stop();

    const whileDown = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: { n: 2 },
    });
    const second = recordingRoute(platform, 'gitlab');
    await startWorker(platform, { routes: [second.route], storage });
    await vi.waitFor(() => expect(second.handled.map(event => event.id)).toEqual([whileDown]));
    expect(platform.streamRequests.at(-1)).toEqual({ topic: 'connect', lastEventId: before });
    expect(second.route.reconcile).not.toHaveBeenCalled();
  });

  it('reconciles every routed integration once when it first reads from the live tail', async () => {
    const platform = await platformWith([]);
    const jira = recordingRoute(platform, 'jira');
    const gitlab = recordingRoute(platform, 'gitlab');
    const { storage, cursor } = memoryStorage();
    await startWorker(platform, { routes: [jira.route, gitlab.route], storage });
    await subscribed(platform);

    await vi.waitFor(() => expect(jira.route.reconcile).toHaveBeenCalledTimes(1));
    expect(gitlab.route.reconcile).toHaveBeenCalledTimes(1);
    expect(platform.streamRequests).toEqual([{ topic: 'connect', lastEventId: undefined }]);
    // The live tail's start is not saved: until an event is handled, a restart reconciles again.
    expect(cursor()).toBeUndefined();
  });

  it('restarts from the live tail and reconciles when the events service rejects a saved cursor with no time', async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    platform.rejectedCursors.add('5');
    const { storage, cursor } = memoryStorage({ version: 1, cursors: { connect: { eventId: '5' } } });
    const gitlab = recordingRoute(platform, 'gitlab');
    const { logger } = await startWorker(platform, { routes: [gitlab.route], storage });
    await subscribed(platform);

    await vi.waitFor(() => expect(gitlab.route.reconcile).toHaveBeenCalledTimes(1));
    expect(platform.streamRequests).toEqual([
      { topic: 'connect', lastEventId: '5' },
      { topic: 'connect', lastEventId: undefined },
    ]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('cursor was rejected'), expect.anything());

    const id = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: {},
    });
    await vi.waitFor(() => expect(cursor()).toBe(id));
    expect(gitlab.handled.map(event => event.id)).toEqual([id]);
  });

  it('resumes by time and reconciles once when the events service rejects a saved cursor it has a time for', async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    const gitlab = recordingRoute(platform, 'gitlab');
    const fields = { connectionId: 'conn-gitlab', integrationId: 'gitlab', eventType: 'Issue Hook', payload: '{}' };
    platform.publish('connect', fields, 1_000);
    const later = platform.publish('connect', fields, 2_000);
    platform.rejectedCursors.add('5');
    const { storage, cursor } = memoryStorage({ version: 1, cursors: { connect: { eventId: '5', timestamp: 1_000 } } });
    await startWorker(platform, { routes: [gitlab.route], storage });

    await vi.waitFor(() => expect(cursor()).toBe(later));
    expect(platform.streamRequests).toEqual([
      { topic: 'connect', lastEventId: '5' },
      { topic: 'connect', lastEventId: undefined, afterTimestamp: 999 },
    ]);
    // The event at the stored time is redelivered (handlers dedupe), and the gap is reconciled once.
    expect(gitlab.handled.map(event => event.id)).toEqual([String(BigInt(later) - 1n), later]);
    expect(gitlab.route.reconcile).toHaveBeenCalledTimes(1);
  });

  it('reconciles once when the events service has trimmed the events after the saved cursor', async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    const gitlab = recordingRoute(platform, 'gitlab');
    platform.trimmedCursors.add('5');
    const { storage, cursor } = memoryStorage({ version: 1, cursors: { connect: { eventId: '5', timestamp: 1_000 } } });
    const { logger } = await startWorker(platform, { routes: [gitlab.route], storage });
    await subscribed(platform);

    await vi.waitFor(() => expect(gitlab.route.reconcile).toHaveBeenCalledTimes(1));
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('events were missed'),
      expect.objectContaining({ reason: 'trimmed', after: '5' }),
    );
    // Once reconciled, the resumed position is saved, so a restart doesn't reconcile the same gap again.
    await vi.waitFor(() => expect(cursor()).not.toBe('5'));

    const id = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: {},
    });
    await vi.waitFor(() => expect(cursor()).toBe(id));
    expect(gitlab.route.reconcile).toHaveBeenCalledTimes(1);
  });

  it('drops a malformed saved cursor and starts from the live tail', async () => {
    const platform = await platformWith([]);
    const gitlab = recordingRoute(platform, 'gitlab');
    const { storage } = memoryStorage({ version: 1, cursors: { connect: 'not-a-cursor-object' } });
    await startWorker(platform, { routes: [gitlab.route], storage });
    await subscribed(platform);

    await vi.waitFor(() => expect(gitlab.route.reconcile).toHaveBeenCalledTimes(1));
    expect(platform.streamRequests).toEqual([{ topic: 'connect', lastEventId: undefined }]);
  });

  it("skips an event for a connection outside the Factory's project, after re-reading the listing once", async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    platform.orgConnections.push({ id: 'conn-other', integrationId: 'gitlab', status: 'active' });
    const gitlab = recordingRoute(platform, 'gitlab');
    const { storage, cursor } = memoryStorage();
    const { logger } = await startWorker(platform, { routes: [gitlab.route], storage });
    await subscribed(platform);
    const listing = `/v2/projects/${platform.projectId}/connections`;

    const id = platform.publishConnect({
      connectionId: 'conn-other',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: {},
    });
    await vi.waitFor(() => expect(cursor()).toBe(id));
    expect(gitlab.handled).toEqual([]);
    expect(platform.count('GET', listing)).toBe(2);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('outside the Factory'), expect.anything());

    // A connection linked since the last listing is found on the re-read.
    platform.linked.add('conn-other');
    const linked = platform.publishConnect({
      connectionId: 'conn-other',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: {},
    });
    await vi.waitFor(() => expect(gitlab.handled.map(event => event.id)).toEqual([linked]));
  });

  it('retries a failing handler three times, then gives up on that event, reconciles, and moves on', async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    const gitlab = recordingRoute(platform, 'gitlab');
    const poison = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: { poison: true },
    });
    gitlab.route.handle.mockImplementation(async event => {
      if (event.id === poison) throw new Error('boom');
      gitlab.handled.push(event);
    });
    // Start just before the poison event so it is replayed to the worker.
    const { storage, cursor } = memoryStorage({
      version: 1,
      cursors: { connect: { eventId: String(BigInt(poison) - 1n) } },
    });
    const { worker, logger } = await startWorker(platform, { routes: [gitlab.route], storage });
    const next = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: {},
    });

    await vi.waitFor(() => expect(cursor()).toBe(next));
    expect(gitlab.route.handle.mock.calls.filter(([event]) => event.id === poison)).toHaveLength(3);
    expect(gitlab.handled.map(event => event.id)).toEqual([next]);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('giving up'), expect.anything());
    // Started from a stored cursor, so the only reconcile is the one repairing the dropped event.
    expect(gitlab.route.reconcile).toHaveBeenCalledTimes(1);
    expect(worker.diagnostics()).toMatchObject({ topics: { connect: { handlerFailures: 1, cursor: next } } });
  });

  it('lets only the replica holding the lease subscribe', async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    const pubsub = new EventEmitterPubSub();
    const { storage } = memoryStorage();
    const a = await startWorker(platform, { routes: [recordingRoute(platform, 'gitlab').route], storage, pubsub });
    const b = await startWorker(platform, { routes: [recordingRoute(platform, 'gitlab').route], storage, pubsub });
    await subscribed(platform);
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(platform.streamRequests).toHaveLength(1);
    expect([a.worker.hasLease, b.worker.hasLease].filter(Boolean)).toHaveLength(1);
  });

  it('resumes from the cursor the previous lease holder saved when it takes over the lease', async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    const pubsub = new EventEmitterPubSub();
    const { storage, cursor } = memoryStorage();
    // Both replicas boot, and read their cursors, before anything is handled.
    const a = recordingRoute(platform, 'gitlab');
    const b = recordingRoute(platform, 'gitlab');
    const first = await startWorker(platform, { routes: [a.route], storage, pubsub, leaseTtlMs: 200 });
    const second = await startWorker(platform, { routes: [b.route], storage, pubsub, leaseTtlMs: 200 });
    await subscribed(platform);
    const [leader, leaderRoute, follower, followerRoute] = first.worker.hasLease
      ? [first.worker, a, second.worker, b]
      : [second.worker, b, first.worker, a];

    const handledByLeader = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Note Hook',
      payload: '{}',
    });
    await vi.waitFor(() => expect(cursor()).toBe(handledByLeader));
    await leader.stop();
    const sentDuringHandoff = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Note Hook',
      payload: '{}',
    });

    await vi.waitFor(() => expect(follower.hasLease).toBe(true), { timeout: 2_000 });
    await vi.waitFor(() => expect(followerRoute.handled.map(event => event.id)).toEqual([sentDuringHandoff]));
    expect(platform.streamRequests.at(-1)).toEqual({ topic: 'connect', lastEventId: handledByLeader });
    expect(leaderRoute.handled.map(event => event.id)).toEqual([handledByLeader]);
    expect(followerRoute.route.reconcile).not.toHaveBeenCalled();
  });

  it('reads extra topics with their own cursors', async () => {
    const platform = await platformWith([]);
    const received: string[] = [];
    const reconcile = vi.fn();
    const { storage, cursor } = memoryStorage();
    await startWorker(platform, {
      routes: [recordingRoute(platform, 'gitlab').route],
      storage,
      topics: [
        {
          topic: 'github-app',
          route: async event => {
            received.push(event.fields.kind!);
          },
          reconcile,
        },
      ],
    });
    await subscribed(platform, 2);

    const id = platform.publish('github-app', { kind: 'pull_request', payload: '{}' });
    await vi.waitFor(() => expect(cursor('github-app')).toBe(id));
    expect(received).toEqual(['pull_request']);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(cursor('connect')).not.toBe(id);
  });

  it('logs and retries when the events client cannot subscribe at all', async () => {
    const platform = await platformWith([{ id: 'conn-gitlab', integrationId: 'gitlab' }]);
    const gitlab = recordingRoute(platform, 'gitlab');
    const events = platform.connect().events;
    let attempts = 0;
    const connectEvents = events.connectEvents.bind(events);
    vi.spyOn(events, 'connectEvents').mockImplementation(options => {
      attempts += 1;
      if (attempts === 1) throw new Error('Missing Mastra project id');
      return connectEvents(options);
    });
    const worker = new PlatformEventsWorker({
      events,
      storage: memoryStorage().storage,
      routes: [gitlab.route],
      resubscribeDelayMs: 20,
    });
    const workerDeps = deps();
    await worker.init(workerDeps);
    await worker.start();
    onTestFinished(() => worker.stop());

    await subscribed(platform);
    expect(workerDeps.logger.error).toHaveBeenCalledWith(
      'Platform events subscription failed',
      expect.objectContaining({ error: 'Missing Mastra project id' }),
    );
    const id = platform.publishConnect({
      connectionId: 'conn-gitlab',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: {},
    });
    await vi.waitFor(() => expect(gitlab.handled.map(event => event.id)).toEqual([id]));
  });

  it('refuses two integrations claiming the same provider key', async () => {
    const platform = await platformWith([]);
    expect(
      () =>
        new PlatformEventsWorker({
          events: platform.connect().events,
          storage: memoryStorage().storage,
          routes: [
            recordingRoute(platform, 'gitlab').route,
            recordingRoute(platform, 'gitlab-again', ['gitlab']).route,
          ],
        }),
    ).toThrow(/provider key 'gitlab' is claimed by both gitlab and gitlab-again/);
  });
});
