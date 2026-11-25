import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { PlatformConnectBinding } from './connect-binding.js';
import type { PlatformConnectEventDelivery, PlatformConnectEventRoute } from './events-worker.js';
import { startEventsWorker, startFakePlatform } from './test-utils.js';
import type { FakePlatform } from './test-utils.js';

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

async function platformWith(connections: Array<{ id: string; integrationId: string; resourceId?: string }>) {
  const platform = await startFakePlatform();
  platform.orgConnections = connections.map(connection => ({ ...connection, status: 'active' }));
  for (const connection of connections) platform.linked.add(connection.id);
  return platform;
}

const startWorker = startEventsWorker;

const issue = (connectionId: string, integrationId: string, extra: { sourceEventId?: string; unverified?: boolean; resourceId?: string } = {}) => ({
  connectionId,
  integrationId,
  eventType: 'issue.created',
  payload: { id: connectionId },
  ...extra,
});

describe('PlatformEventsWorker', () => {
  it("routes each event to the integrations that own its provider key, keyed on the provider's delivery id", async () => {
    const platform = await platformWith([
      { id: 'conn-pylon', integrationId: 'pylon' },
      { id: 'conn-acme', integrationId: 'acme' },
      { id: 'conn-other', integrationId: 'other' },
    ]);
    const pylon = recordingRoute(platform, 'pylon');
    const acme = recordingRoute(platform, 'acme');
    await startWorker(platform, [pylon.route, acme.route]);

    const first = platform.publishConnect(issue('conn-pylon', 'pylon', { sourceEventId: 'delivery-1' }));
    platform.publishConnect(issue('conn-other', 'other'));
    const third = platform.publishConnect(issue('conn-acme', 'acme'));

    await vi.waitFor(() => expect(acme.handled).toHaveLength(1));
    expect(pylon.handled.map(event => [event.id, event.dedupeKey, event.provider])).toEqual([
      [first, 'delivery-1', 'pylon'],
    ]);
    expect(acme.handled.map(event => [event.id, event.dedupeKey])).toEqual([[third, third]]);
  });

  it('only routes the provider keys a route asks for events from', async () => {
    const platform = await platformWith([
      { id: 'conn-app', integrationId: 'factory-github' },
      { id: 'conn-reviews', integrationId: 'factory-reviews-github' },
    ]);
    const github = recordingRoute(platform, 'github', ['factory-github', 'factory-reviews-github']);
    await startWorker(platform, [{ ...github.route, eventProviderKeys: ['factory-github'] }]);

    platform.publishConnect(issue('conn-reviews', 'factory-reviews-github'));
    const app = platform.publishConnect(issue('conn-app', 'factory-github'));

    await vi.waitFor(() => expect(github.handled).toHaveLength(1));
    expect(github.handled[0]!.id).toBe(app);
  });

  it('passes unverified events on, flagged as such', async () => {
    const platform = await platformWith([{ id: 'conn-pylon', integrationId: 'pylon' }]);
    const pylon = recordingRoute(platform, 'pylon');
    await startWorker(platform, [pylon.route]);

    platform.publishConnect(issue('conn-pylon', 'pylon', { unverified: true }));

    await vi.waitFor(() => expect(pylon.handled).toHaveLength(1));
    expect(pylon.handled[0]!.unverified).toBe(true);
  });

  it("skips events from connections outside the Factory's project and from end users' connections", async () => {
    const platform = await platformWith([
      { id: 'conn-pylon', integrationId: 'pylon' },
      { id: 'conn-user', integrationId: 'pylon', resourceId: 'user-1' },
    ]);
    platform.orgConnections.push({ id: 'conn-unlinked', integrationId: 'pylon', status: 'active' });
    const pylon = recordingRoute(platform, 'pylon');
    const { logger } = await startWorker(platform, [pylon.route]);

    platform.publishConnect(issue('conn-unlinked', 'pylon'));
    platform.publishConnect(issue('conn-user', 'pylon', { resourceId: 'user-1' }));
    const owned = platform.publishConnect(issue('conn-pylon', 'pylon'));

    await vi.waitFor(() => expect(pylon.handled).toHaveLength(1));
    expect(pylon.handled[0]!.id).toBe(owned);
    expect(logger.warn).toHaveBeenCalledWith(
      "Platform events: skipped an event for a connection outside the Factory's project",
      expect.objectContaining({ connectionId: 'conn-unlinked' }),
    );
  });

  it('handles an event from a connection linked after the listing was cached', async () => {
    const platform = await platformWith([{ id: 'conn-pylon', integrationId: 'pylon' }]);
    const pylon = recordingRoute(platform, 'pylon');
    await startWorker(platform, [pylon.route]);
    await pylon.route.binding.listConnections();

    platform.orgConnections.push({ id: 'conn-new', integrationId: 'pylon', status: 'active' });
    platform.linked.add('conn-new');
    const event = platform.publishConnect(issue('conn-new', 'pylon'));

    await vi.waitFor(() => expect(pylon.handled.map(handled => handled.id)).toEqual([event]));
  });

  it('asks every integration to reconcile when it starts, since earlier events are not read', async () => {
    const platform = await platformWith([]);
    const pylon = recordingRoute(platform, 'pylon');
    const acme = recordingRoute(platform, 'acme');
    platform.publishConnect(issue('conn-pylon', 'pylon'));

    await startWorker(platform, [pylon.route, acme.route]);

    expect(pylon.route.reconcile).toHaveBeenCalledTimes(1);
    expect(acme.route.reconcile).toHaveBeenCalledTimes(1);
    expect(platform.streamRequests[0]!.lastEventId).toBeUndefined();
    expect(pylon.handled).toEqual([]);
  });

  it('asks every integration to reconcile when the events service reports a gap', async () => {
    const platform = await platformWith([{ id: 'conn-pylon', integrationId: 'pylon' }]);
    const pylon = recordingRoute(platform, 'pylon');
    await startWorker(platform, [pylon.route]);
    const read = platform.publishConnect(issue('conn-pylon', 'pylon'));
    await vi.waitFor(() => expect(pylon.handled).toHaveLength(1));
    pylon.route.reconcile.mockClear();

    platform.trimmedCursors.add(read);
    platform.dropStreams();

    await vi.waitFor(() => expect(pylon.route.reconcile).toHaveBeenCalledTimes(1));
    expect(platform.streamRequests.at(-1)!.lastEventId).toBe(read);
  });

  it('retries a failing handler, then reconciles its integration and moves on', async () => {
    const platform = await platformWith([{ id: 'conn-pylon', integrationId: 'pylon' }]);
    const pylon = recordingRoute(platform, 'pylon');
    const handle = pylon.route.handle.getMockImplementation()!;
    pylon.route.handle.mockImplementation(async event => {
      if (event.sourceEventId === 'bad') throw new Error('provider unavailable');
      await handle(event);
    });
    await startWorker(platform, [pylon.route]);
    pylon.route.reconcile.mockClear();

    platform.publishConnect(issue('conn-pylon', 'pylon', { sourceEventId: 'bad' }));
    const good = platform.publishConnect(issue('conn-pylon', 'pylon', { sourceEventId: 'good' }));

    await vi.waitFor(() => expect(pylon.handled.map(event => event.id)).toEqual([good]));
    expect(pylon.route.handle).toHaveBeenCalledTimes(4);
    expect(pylon.route.reconcile).toHaveBeenCalledTimes(1);
  });

  it('does not reconcile for a handler that succeeds on a retry', async () => {
    const platform = await platformWith([{ id: 'conn-pylon', integrationId: 'pylon' }]);
    const pylon = recordingRoute(platform, 'pylon');
    const handle = pylon.route.handle.getMockImplementation()!;
    pylon.route.handle.mockImplementationOnce(async () => {
      throw new Error('rate limited');
    });
    pylon.route.handle.mockImplementation(handle);
    await startWorker(platform, [pylon.route]);
    pylon.route.reconcile.mockClear();

    platform.publishConnect(issue('conn-pylon', 'pylon'));

    await vi.waitFor(() => expect(pylon.handled).toHaveLength(1));
    expect(pylon.route.reconcile).not.toHaveBeenCalled();
  });

  it('reads again from the last event it handled after the stream drops', async () => {
    const platform = await platformWith([{ id: 'conn-pylon', integrationId: 'pylon' }]);
    const pylon = recordingRoute(platform, 'pylon');
    await startWorker(platform, [pylon.route]);
    const first = platform.publishConnect(issue('conn-pylon', 'pylon'));
    await vi.waitFor(() => expect(pylon.handled).toHaveLength(1));

    platform.dropStreams();
    await vi.waitFor(() => expect(platform.openStreams).toBe(1));
    const second = platform.publishConnect(issue('conn-pylon', 'pylon'));

    await vi.waitFor(() => expect(pylon.handled.map(event => event.id)).toEqual([first, second]));
    expect(platform.streamRequests.at(-1)!.lastEventId).toBe(first);
  });
});
