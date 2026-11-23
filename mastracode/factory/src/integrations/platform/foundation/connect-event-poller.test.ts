import type { LeaseProvider } from '@mastra/core/events';
import type { WorkerDeps } from '@mastra/core/worker';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { PlatformConnectBinding } from './connect-binding.js';
import { PlatformConnectEventPoller } from './connect-event-poller.js';
import type { PlatformConnectEventPollerStorage } from './connect-event-poller.js';
import type { PlatformConnectEventDelivery, PlatformConnectEventRoute } from './connect-events.js';
import { startFakePlatform } from './test-utils.js';
import type { FakeConnectionEvent, FakePlatform } from './test-utils.js';

const NOW = 1_000;

function settingsStorage(initial: unknown = null) {
  let value = initial;
  const save = vi.fn(async (_orgId: string, _userId: string, next: unknown) => {
    value = structuredClone(next);
  });
  return {
    storage: {
      integrationId: 'platform-connect-event-poller',
      settings: { get: vi.fn(async () => value), save },
    } as unknown as PlatformConnectEventPollerStorage,
    save,
    read: () => value as { connections: Record<string, { afterEventId: string }> } | null,
  };
}

function logEvent(id: string, overrides: Partial<FakeConnectionEvent> = {}): FakeConnectionEvent {
  return {
    id,
    timestamp: Number(id.split('-')[0]),
    integrationId: 'gitlab',
    eventType: 'Issue Hook',
    sourceEventId: null,
    payload: { n: id },
    ...overrides,
  };
}

function route(
  platform: FakePlatform,
  integrationId: string,
  handle: (event: PlatformConnectEventDelivery) => Promise<void> = async () => undefined,
  extra: Partial<PlatformConnectEventRoute> = {},
) {
  const handled: PlatformConnectEventDelivery[] = [];
  const reconcile = vi.fn();
  const r: PlatformConnectEventRoute = {
    binding: new PlatformConnectBinding({
      integrationId,
      providerKeys: [integrationId],
      connect: platform.connect(),
    }),
    handle: async event => {
      await handle(event);
      handled.push(event);
    },
    reconcile,
    ...extra,
  };
  return { route: r, handled, reconcile };
}

function deps(pubsub: unknown = {}): WorkerDeps {
  return {
    pubsub: pubsub as WorkerDeps['pubsub'],
    storage: {} as WorkerDeps['storage'],
    logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as WorkerDeps['logger'],
  };
}

async function start(poller: PlatformConnectEventPoller, workerDeps = deps()) {
  await poller.init(workerDeps);
  await poller.start();
  onTestFinished(() => poller.stop());
  return workerDeps;
}

function eventReads(platform: FakePlatform, connectionId: string): string[] {
  return platform.requests
    .filter(request => request.path === `/v2/connections/${connectionId}/events`)
    .map(request => request.query.get('afterEventId') ?? '');
}

async function platformWith(
  connections: Array<{ id: string; integrationId: string; status?: string; resourceId?: string }>,
) {
  const platform = await startFakePlatform();
  platform.orgConnections = connections.map(connection => ({ status: 'active', ...connection }));
  for (const connection of connections) platform.linked.add(connection.id);
  return platform;
}

describe('PlatformConnectEventPoller', () => {
  it('starts a new connection at the present, reconciles once, then delivers new events in order and resumes from its cursor', async () => {
    const platform = await platformWith([{ id: 'conn-1', integrationId: 'gitlab' }]);
    platform.connectionEvents.set('conn-1', [logEvent('900-0')]);
    const gitlab = route(platform, 'gitlab');
    const settings = settingsStorage();
    const poller = new PlatformConnectEventPoller({
      storage: settings.storage,
      routes: [gitlab.route],
      intervalMs: 20,
      now: () => NOW,
    });
    await start(poller);

    await vi.waitFor(() => expect(eventReads(platform, 'conn-1')).toContain(`${NOW}-0`));
    // History from before the connection was first read is the reconcile's to repair.
    expect(gitlab.reconcile).toHaveBeenCalledOnce();
    expect(gitlab.handled).toEqual([]);

    platform.connectionEvents.get('conn-1')!.push(logEvent('1500-0', { sourceEventId: 'gl-1' }), logEvent('1500-1'));
    await vi.waitFor(() => expect(gitlab.handled).toHaveLength(2));
    expect(gitlab.handled).toEqual([
      expect.objectContaining({
        id: '1500-0',
        connectionId: 'conn-1',
        integrationId: 'gitlab',
        eventType: 'Issue Hook',
        sourceEventId: 'gl-1',
        payload: { n: '1500-0' },
        unverified: false,
        dedupeKey: 'gl-1',
      }),
      expect.objectContaining({ id: '1500-1', sourceEventId: null, dedupeKey: '1500-1' }),
    ]);
    await vi.waitFor(() => expect(eventReads(platform, 'conn-1').at(-1)).toBe('1500-1'));
    expect(settings.read()).toEqual({ version: 1, connections: { 'conn-1': { afterEventId: '1500-1' } } });
    expect(gitlab.reconcile).toHaveBeenCalledOnce();
    await poller.stop();

    // A restarted poller resumes from the saved cursor without reconciling again.
    const restarted = route(platform, 'gitlab');
    const again = new PlatformConnectEventPoller({
      storage: settings.storage,
      routes: [restarted.route],
      intervalMs: 20,
      now: () => NOW,
    });
    platform.connectionEvents.get('conn-1')!.push(logEvent('1600-0'));
    await start(again);
    await vi.waitFor(() => expect(restarted.handled.map(event => event.id)).toEqual(['1600-0']));
    expect(restarted.reconcile).not.toHaveBeenCalled();
  });

  it('routes each connection to the integration that owns it, polling a connection once even if two routes list it', async () => {
    const platform = await platformWith([
      { id: 'conn-gl', integrationId: 'gitlab' },
      { id: 'conn-lin', integrationId: 'linear' },
    ]);
    platform.connectionEvents.set('conn-gl', [logEvent('2000-0')]);
    platform.connectionEvents.set('conn-lin', [logEvent('2000-0', { integrationId: 'linear' })]);
    const settings = settingsStorage({
      version: 1,
      connections: { 'conn-gl': { afterEventId: '1-0' }, 'conn-lin': { afterEventId: '1-0' } },
    });
    const gitlab = route(platform, 'gitlab');
    const linear = route(platform, 'linear');
    const gitlabAgain = route(platform, 'gitlab');
    const poller = new PlatformConnectEventPoller({
      storage: settings.storage,
      routes: [gitlab.route, linear.route, gitlabAgain.route],
      intervalMs: 60_000,
    });
    await start(poller);

    await vi.waitFor(() => expect(linear.handled).toHaveLength(1));
    expect(gitlab.handled.map(event => event.connectionId)).toEqual(['conn-gl']);
    expect(linear.handled.map(event => event.connectionId)).toEqual(['conn-lin']);
    expect(gitlabAgain.handled).toEqual([]);
    expect(eventReads(platform, 'conn-gl')).toHaveLength(1);
  });

  it('reads only the provider keys a route takes events from, and no end-user connection', async () => {
    const platform = await platformWith([
      { id: 'conn-app', integrationId: 'factory-github' },
      { id: 'conn-reviews', integrationId: 'factory-reviews-github' },
      { id: 'conn-user', integrationId: 'factory-github', resourceId: 'user-1' },
    ]);
    const github = route(platform, 'factory-github', undefined, {
      binding: new PlatformConnectBinding({
        integrationId: 'github',
        providerKeys: ['factory-github', 'factory-reviews-github'],
        connect: platform.connect(),
      }),
      eventProviderKeys: ['factory-github'],
    });
    const poller = new PlatformConnectEventPoller({
      storage: settingsStorage().storage,
      routes: [github.route],
      intervalMs: 60_000,
    });
    await start(poller);

    await vi.waitFor(() => expect(eventReads(platform, 'conn-app')).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(eventReads(platform, 'conn-reviews')).toEqual([]);
    expect(eventReads(platform, 'conn-user')).toEqual([]);
  });

  it('passes on that the platform could not verify an event, so the handler can drop it', async () => {
    const platform = await platformWith([{ id: 'conn-1', integrationId: 'gitlab' }]);
    platform.connectionEvents.set('conn-1', [logEvent('2000-0', { unverified: true }), logEvent('2000-1')]);
    const settings = settingsStorage({ version: 1, connections: { 'conn-1': { afterEventId: '1-0' } } });
    const gitlab = route(platform, 'gitlab');
    const poller = new PlatformConnectEventPoller({
      storage: settings.storage,
      routes: [gitlab.route],
      intervalMs: 60_000,
    });
    await start(poller);

    await vi.waitFor(() => expect(gitlab.handled).toHaveLength(2));
    expect(gitlab.handled.map(event => [event.id, event.unverified])).toEqual([
      ['2000-0', true],
      ['2000-1', false],
    ]);
  });

  it('saves the cursor only past events whose handler finished', async () => {
    const platform = await platformWith([{ id: 'conn-1', integrationId: 'gitlab' }]);
    platform.connectionEvents.set('conn-1', [logEvent('2000-0'), logEvent('2000-1')]);
    const settings = settingsStorage({ version: 1, connections: { 'conn-1': { afterEventId: '1-0' } } });
    let release!: () => void;
    const blocked = new Promise<void>(resolve => (release = resolve));
    const gitlab = route(platform, 'gitlab', async event => {
      if (event.id === '2000-1') await blocked;
    });
    const poller = new PlatformConnectEventPoller({ storage: settings.storage, routes: [gitlab.route] });
    await start(poller);

    await vi.waitFor(() => expect(settings.read()?.connections['conn-1']?.afterEventId).toBe('2000-0'));
    expect(gitlab.handled.map(event => event.id)).toEqual(['2000-0']);
    release();
    await vi.waitFor(() => expect(settings.read()?.connections['conn-1']?.afterEventId).toBe('2000-1'));
  });

  it('delivers an event again when its cursor could not be saved, never skipping past it', async () => {
    const platform = await platformWith([{ id: 'conn-1', integrationId: 'gitlab' }]);
    platform.connectionEvents.set('conn-1', [logEvent('2000-0')]);
    const settings = settingsStorage({ version: 1, connections: { 'conn-1': { afterEventId: '1-0' } } });
    settings.save.mockRejectedValueOnce(new Error('storage unavailable'));
    const gitlab = route(platform, 'gitlab');
    const poller = new PlatformConnectEventPoller({
      storage: settings.storage,
      routes: [gitlab.route],
      intervalMs: 20,
    });
    await start(poller);

    await vi.waitFor(() => expect(settings.read()?.connections['conn-1']?.afterEventId).toBe('2000-0'));
    expect(gitlab.handled.map(event => event.id)).toEqual(['2000-0', '2000-0']);
    expect(eventReads(platform, 'conn-1').slice(0, 2)).toEqual(['1-0', '1-0']);
  });

  it('retries a failing handler, then skips the event and asks its integration to reconcile', async () => {
    const platform = await platformWith([{ id: 'conn-1', integrationId: 'gitlab' }]);
    platform.connectionEvents.set('conn-1', [logEvent('2000-0'), logEvent('2000-1')]);
    const settings = settingsStorage({ version: 1, connections: { 'conn-1': { afterEventId: '1-0' } } });
    const attempts: string[] = [];
    const gitlab = route(platform, 'gitlab', async event => {
      attempts.push(event.id);
      if (event.id === '2000-0') throw new Error('rules unavailable');
    });
    const poller = new PlatformConnectEventPoller({
      storage: settings.storage,
      routes: [gitlab.route],
      retryDelayMs: 1,
    });
    const workerDeps = await start(poller);

    await vi.waitFor(() => expect(gitlab.handled.map(event => event.id)).toEqual(['2000-1']));
    expect(attempts).toEqual(['2000-0', '2000-0', '2000-0', '2000-1']);
    expect(gitlab.reconcile).toHaveBeenCalledOnce();
    expect(poller.diagnostics()).toEqual(expect.objectContaining({ handlerFailures: 1 }));
    expect(workerDeps.logger.error).toHaveBeenCalledWith(
      'Platform Connect events: giving up on an event; reconciling to repair it',
      expect.objectContaining({ connectionId: 'conn-1', eventId: '2000-0', attempts: 3 }),
    );
  });

  it('hands over to the next connection after ten pages and resumes the busy one next cycle', async () => {
    const platform = await platformWith([
      { id: 'conn-busy', integrationId: 'gitlab' },
      { id: 'conn-quiet', integrationId: 'gitlab' },
    ]);
    // 5,001 events: ten full pages of 500, and one more left over.
    platform.connectionEvents.set(
      'conn-busy',
      Array.from({ length: 5_001 }, (_, index) => logEvent(`3000-${index}`)),
    );
    platform.connectionEvents.set('conn-quiet', [logEvent('3000-0')]);
    const settings = settingsStorage({
      version: 1,
      connections: { 'conn-busy': { afterEventId: '1-0' }, 'conn-quiet': { afterEventId: '1-0' } },
    });
    const gitlab = route(platform, 'gitlab');
    const poller = new PlatformConnectEventPoller({
      storage: settings.storage,
      routes: [gitlab.route],
      intervalMs: 20,
    });
    await start(poller);

    await vi.waitFor(() => expect(gitlab.handled).toHaveLength(5_002), { timeout: 20_000 });
    const order = gitlab.handled.map(event => `${event.connectionId}:${event.id}`);
    // The quiet connection is served after the busy one's ten pages, before its last event.
    expect(order.indexOf('conn-quiet:3000-0')).toBe(5_000);
    expect(order.at(-1)).toBe('conn-busy:3000-5000');
    expect(eventReads(platform, 'conn-busy').slice(0, 11)).toContain('3000-4999');
  }, 30_000);

  it('keeps reading other connections when one answers 401, and reads no connection that needs reauth', async () => {
    const platform = await platformWith([
      { id: 'conn-revoked', integrationId: 'gitlab' },
      { id: 'conn-stale', integrationId: 'gitlab', status: 'needs_reauth' },
      { id: 'conn-2', integrationId: 'gitlab' },
    ]);
    platform.nextEventReplies.set('conn-revoked', [
      { status: 401, body: { message: 'Connection requires reauthorization.' } },
    ]);
    platform.connectionEvents.set('conn-2', [logEvent('2000-0')]);
    const settings = settingsStorage({
      version: 1,
      connections: {
        'conn-revoked': { afterEventId: '1-0' },
        'conn-stale': { afterEventId: '1-0' },
        'conn-2': { afterEventId: '1-0' },
      },
    });
    const gitlab = route(platform, 'gitlab');
    const poller = new PlatformConnectEventPoller({
      storage: settings.storage,
      routes: [gitlab.route],
      intervalMs: 60_000,
    });
    const workerDeps = await start(poller);

    await vi.waitFor(() => expect(gitlab.handled).toHaveLength(1));
    expect(eventReads(platform, 'conn-stale')).toEqual([]);
    expect(workerDeps.logger.warn).toHaveBeenCalledWith(
      'Platform Connect connection is unavailable; skipped this cycle',
      expect.objectContaining({ connectionId: 'conn-revoked', status: 401 }),
    );
    expect(workerDeps.logger.error).not.toHaveBeenCalled();
  });

  it('reads at the shortest interval its routes ask for', async () => {
    const platform = await platformWith([]);
    const poller = new PlatformConnectEventPoller({
      storage: settingsStorage().storage,
      routes: [
        route(platform, 'gitlab', undefined, { pollIntervalMs: 45_000 }).route,
        route(platform, 'linear', undefined, { pollIntervalMs: 30_000 }).route,
        route(platform, 'github').route,
      ],
    });
    const lease: LeaseProvider = {
      acquireLease: vi.fn(async () => ({ acquired: false, owner: 'other' })),
      getLeaseOwner: vi.fn(async () => 'other'),
      releaseLease: vi.fn(async () => undefined),
      renewLease: vi.fn(async () => false),
      transferLease: vi.fn(async () => true),
    };
    await start(poller, deps(lease));
    // The lease TTL is three intervals.
    await vi.waitFor(() =>
      expect(lease.acquireLease).toHaveBeenCalledWith(
        'platform-connect-event-poller:platform-connect-event-poller',
        expect.any(String),
        90_000,
      ),
    );
  });

  it('reads nothing while another replica holds the lease', async () => {
    const platform = await platformWith([{ id: 'conn-1', integrationId: 'gitlab' }]);
    const settings = settingsStorage();
    const lease: LeaseProvider = {
      acquireLease: vi.fn(async () => ({ acquired: false, owner: 'other' })),
      getLeaseOwner: vi.fn(async () => 'other'),
      releaseLease: vi.fn(async () => undefined),
      renewLease: vi.fn(async () => false),
      transferLease: vi.fn(async () => true),
    };
    const poller = new PlatformConnectEventPoller({
      storage: settings.storage,
      routes: [route(platform, 'gitlab').route],
      intervalMs: 20,
    });
    await start(poller, deps(lease));

    await vi.waitFor(() => expect(vi.mocked(lease.acquireLease).mock.calls.length).toBeGreaterThanOrEqual(2));
    expect(platform.requests).toEqual([]);
    expect(settings.save).not.toHaveBeenCalled();
    await poller.stop();
    expect(lease.releaseLease).not.toHaveBeenCalled();
  });

  it('saves no cursor for an event whose handler outlived its lease', async () => {
    // Only lease renewal runs on an interval; the fake platform keeps real timeouts.
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const platform = await platformWith([{ id: 'conn-1', integrationId: 'gitlab' }]);
    platform.connectionEvents.set('conn-1', [logEvent('2000-0')]);
    const settings = settingsStorage({ version: 1, connections: { 'conn-1': { afterEventId: '1-0' } } });
    let release!: () => void;
    const blocked = new Promise<void>(resolve => (release = resolve));
    const gitlab = route(platform, 'gitlab', () => blocked);
    const lease: LeaseProvider = {
      acquireLease: vi
        .fn()
        .mockImplementationOnce(async (_key: string, owner: string) => ({ acquired: true, owner }))
        .mockResolvedValue({ acquired: false, owner: 'other' }),
      getLeaseOwner: vi.fn(async () => 'other'),
      releaseLease: vi.fn(async () => undefined),
      renewLease: vi.fn(async () => false),
      transferLease: vi.fn(async () => true),
    };
    const poller = new PlatformConnectEventPoller({
      storage: settings.storage,
      routes: [gitlab.route],
      intervalMs: 20,
    });
    await start(poller, deps(lease));

    await vi.waitFor(() => expect(eventReads(platform, 'conn-1')).toEqual(['1-0']));
    // Renewal runs every third of the 30-second lease and is refused.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(lease.renewLease).toHaveBeenCalled();
    release();
    await vi.waitFor(() => expect(gitlab.handled).toHaveLength(1));
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(settings.read()?.connections['conn-1']?.afterEventId).toBe('1-0');
  });

  it('releases its lease on a clean stop and reads no further', async () => {
    const platform = await platformWith([{ id: 'conn-1', integrationId: 'gitlab' }]);
    const lease: LeaseProvider = {
      acquireLease: vi.fn(async (_key, owner) => ({ acquired: true, owner })),
      getLeaseOwner: vi.fn(async () => undefined),
      releaseLease: vi.fn(async () => undefined),
      renewLease: vi.fn(async () => true),
      transferLease: vi.fn(async () => true),
    };
    const poller = new PlatformConnectEventPoller({
      storage: settingsStorage().storage,
      routes: [route(platform, 'gitlab').route],
      intervalMs: 20,
    });
    await start(poller, deps(lease));
    await vi.waitFor(() => expect(eventReads(platform, 'conn-1').length).toBeGreaterThan(0));

    await poller.stop();
    const owner = vi.mocked(lease.acquireLease).mock.calls[0]?.[1];
    expect(lease.releaseLease).toHaveBeenCalledWith(
      'platform-connect-event-poller:platform-connect-event-poller',
      owner,
    );
    const reads = platform.requests.length;
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(platform.requests).toHaveLength(reads);
  });

  it('rejects a non-positive polling interval', () => {
    expect(
      () => new PlatformConnectEventPoller({ storage: settingsStorage().storage, routes: [], intervalMs: 0 }),
    ).toThrow('Platform Connect event polling interval must be a positive number.');
  });
});
