/**
 * Project-scoped live-board stream: tenancy guards, one frame per board
 * change, tenant scoping, and listener release on disconnect.
 */

import EventEmitter from 'node:events';

import { EventEmitterPubSub } from '@mastra/core/events';
import type { EventCallback, SubscribeOptions } from '@mastra/core/events';
import { Hono } from 'hono';
import { SSEStreamingApi } from 'hono/streaming';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { feedTopic, touchFeed, touchIntake } from '../feed-events.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { buildFeedEventsRoutes } from './feed-events.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import type { TestAuthUser } from './test-utils.js';

type Seed = Awaited<ReturnType<typeof createFactoryStorageForTests>>;

const ORG = 'org-1';
const asAlice = { workosId: 'user-alice', organizationId: ORG, name: 'Alice' };

function buildApp(seed: Seed, pubsub: EventEmitterPubSub, user?: TestAuthUser) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as never, buildFeedEventsRoutes({ auth: fakeRouteAuth(), projects: seed.projects, pubsub }));
  return { app };
}

/** Reads the live SSE body incrementally; `stop()` cancels, which is what fires `onAbort`. */
function openFeed(response: Response) {
  const body = response.body;
  if (!body) throw new Error('feed response has no body');
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const frames: { event: string; data: string }[] = [];
  let buffer = '';
  const pump = (async () => {
    for (;;) {
      const { done, value } = await reader.read().catch(() => ({ done: true, value: undefined }));
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep: number;
      while ((sep = buffer.indexOf('\n\n')) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const event = frame.split('\n').find(line => line.startsWith('event:'));
        const data = frame.split('\n').find(line => line.startsWith('data:'));
        if (event && data) frames.push({ event: event.slice(6).trim(), data: data.slice(5).trim() });
      }
    }
  })();
  return {
    frames,
    async stop() {
      await reader.cancel();
      await pump;
    },
  };
}

/** A broker whose subscribe is a round trip the reader can outlive. */
class GatedPubSub extends EventEmitterPubSub {
  subscribed = false;

  constructor(
    emitter: EventEmitter,
    private readonly gate: Promise<void>,
  ) {
    super(emitter);
  }

  override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
    await this.gate;
    await super.subscribe(topic, cb, options);
    this.subscribed = true;
  }
}

async function seedProjectItem(seed: Seed, { orgId = ORG, userId = 'user-alice' } = {}) {
  const project = await seed.projects.create({ orgId, userId, input: { name: 'Acme' } });
  await seed.workItems.upsert({
    orgId,
    userId,
    factoryProjectId: project.id,
    input: { title: 'Fix login', stages: ['intake'], sessions: {}, metadata: {} },
  });
  return { project };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('board feed stream', () => {
  it('404s a project outside the caller organization with a JSON body', async () => {
    const seed = await createFactoryStorageForTests();
    const { project } = await seedProjectItem(seed, { orgId: 'other-org', userId: 'user-x' });
    const { app } = buildApp(seed, new EventEmitterPubSub(), asAlice);

    const response = await app.request(`/web/factory/projects/${project.id}/feed-events`);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Project not found' });
  });

  it('404s a malformed project id before opening a stream', async () => {
    const seed = await createFactoryStorageForTests();
    const { app } = buildApp(seed, new EventEmitterPubSub(), asAlice);

    const response = await app.request('/web/factory/projects/not-a-uuid/feed-events');
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Project not found' });
  });

  it('401s an unauthenticated reader', async () => {
    const seed = await createFactoryStorageForTests();
    const { project } = await seedProjectItem(seed);
    const { app } = buildApp(seed, new EventEmitterPubSub());

    const response = await app.request(`/web/factory/projects/${project.id}/feed-events`);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it('pushes one frame to a board when one of its cards changes, and none to another project', async () => {
    const seed = await createFactoryStorageForTests();
    const { project } = await seedProjectItem(seed);
    const { project: other } = await seedProjectItem(seed);
    const pubsub = new EventEmitterPubSub();
    seed.workItems.onBoardChanged(scope => touchFeed(pubsub, scope));
    const { app } = buildApp(seed, pubsub, asAlice);
    const feed = openFeed(await app.request(`/web/factory/projects/${project.id}/feed-events`));
    const otherFeed = openFeed(await app.request(`/web/factory/projects/${other.id}/feed-events`));

    const input = { title: 'Fix logout', stages: ['intake'], sessions: {}, metadata: {} };
    await seed.workItems.upsert({ orgId: ORG, userId: 'user-alice', factoryProjectId: project.id, input });
    await seed.workItems.upsert({ orgId: ORG, userId: 'user-alice', factoryProjectId: other.id, input });

    await vi.waitFor(() => expect(otherFeed.frames).toHaveLength(1));
    expect(feed.frames).toHaveLength(1);

    await feed.stop();
    await otherFeed.stop();
  });

  it('tells a board that its intake candidates changed in a frame of its own, and that a card moved in the other', async () => {
    const seed = await createFactoryStorageForTests();
    const { project } = await seedProjectItem(seed);
    const { project: other } = await seedProjectItem(seed);
    const pubsub = new EventEmitterPubSub();
    seed.workItems.onBoardChanged(scope => touchFeed(pubsub, scope));
    seed.workItems.onIntakeChanged(scope => touchIntake(pubsub, scope));
    const { app } = buildApp(seed, pubsub, asAlice);
    const feed = openFeed(await app.request(`/web/factory/projects/${project.id}/feed-events`));
    const otherFeed = openFeed(await app.request(`/web/factory/projects/${other.id}/feed-events`));
    const source = { integrationId: 'github', type: 'issue', externalId: 'github:10:issue:7' };
    const scope = { orgId: ORG, factoryProjectId: project.id };

    await seed.workItems.storeIntakeCandidate({ ...scope, source, title: 'Issue 7', metadata: { state: 'open' } });
    await vi.waitFor(() => expect(feed.frames).toEqual([{ event: 'intake', data: '{}' }]));

    await seed.workItems.storeIntakeCandidate({ ...scope, source, title: 'Issue 7', metadata: { state: 'open' } });
    await seed.workItems.upsert({
      ...scope,
      userId: 'user-alice',
      input: { title: 'Issue 7', stages: ['intake'], sessions: {}, metadata: {}, externalSource: source },
    });

    await vi.waitFor(() => expect(feed.frames).toHaveLength(3));
    expect(feed.frames.map(frame => frame.event).sort()).toEqual(['feed', 'intake', 'intake']);
    expect(otherFeed.frames).toEqual([]);

    await feed.stop();
    await otherFeed.stop();
  });

  it('sends a new reader a first byte at once, before any change or keepalive is due', async () => {
    const seed = await createFactoryStorageForTests();
    const { project } = await seedProjectItem(seed);
    const { app } = buildApp(seed, new EventEmitterPubSub(), asAlice);
    const response = await app.request(`/web/factory/projects/${project.id}/feed-events`);
    if (!response.body) throw new Error('feed response has no body');
    const reader = response.body.getReader();
    let firstBytes: string | undefined;
    void reader.read().then(({ value }) => {
      firstBytes = new TextDecoder().decode(value);
    });

    await vi.waitFor(() => expect(firstBytes).toBe(': ping\n\n'));

    await reader.cancel();
  });

  it('acknowledges every delivery so durable brokers can settle it', async () => {
    // On Redis Streams an unacked event stays pending (broker PEL + client
    // in-flight map) for the life of the SSE connection — a per-tab leak.
    const seed = await createFactoryStorageForTests();
    const { project } = await seedProjectItem(seed);
    const captured: EventCallback[] = [];
    class CapturingPubSub extends EventEmitterPubSub {
      override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
        captured.push(cb);
        await super.subscribe(topic, cb, options);
      }
    }
    const { app } = buildApp(seed, new CapturingPubSub(), asAlice);

    const feed = openFeed(await app.request(`/web/factory/projects/${project.id}/feed-events`));
    await vi.waitFor(() => expect(captured).toHaveLength(1));

    const ack = vi.fn(async () => {});
    await captured[0]!(
      {
        id: 'evt-1',
        type: 'factory.feed.touched',
        runId: project.id,
        data: {},
        createdAt: new Date(),
      },
      ack,
    );
    expect(ack).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => expect(feed.frames).toHaveLength(1));

    await feed.stop();
  });

  it('acknowledges a delivery whose SSE write throws instead of nacking it', async () => {
    // A rejection out of the handler is a nack; on a durable broker that
    // republishes the event to the shared feed topic, duplicating the
    // invalidation for every connected tab. A failed write to one dying
    // connection must stay that connection's problem.
    const seed = await createFactoryStorageForTests();
    const { project } = await seedProjectItem(seed);
    const captured: EventCallback[] = [];
    class CapturingPubSub extends EventEmitterPubSub {
      override async subscribe(topic: string, cb: EventCallback, options?: SubscribeOptions): Promise<void> {
        captured.push(cb);
        await super.subscribe(topic, cb, options);
      }
    }
    const { app } = buildApp(seed, new CapturingPubSub(), asAlice);

    const feed = openFeed(await app.request(`/web/factory/projects/${project.id}/feed-events`));
    await vi.waitFor(() => expect(captured).toHaveLength(1));

    const writeSSE = vi
      .spyOn(SSEStreamingApi.prototype, 'writeSSE')
      .mockRejectedValueOnce(new Error('write after close'));
    const ack = vi.fn(async () => {});
    await expect(
      captured[0]!(
        {
          id: 'evt-1',
          type: 'factory.feed.touched',
          runId: project.id,
          data: {},
          createdAt: new Date(),
        },
        ack,
      ),
    ).resolves.toBeUndefined();
    expect(writeSSE).toHaveBeenCalledTimes(1);
    expect(ack).toHaveBeenCalledTimes(1);

    await feed.stop();
  });

  it('releases its subscription when the reader disconnects', async () => {
    const seed = await createFactoryStorageForTests();
    const { project } = await seedProjectItem(seed);
    const emitter = new EventEmitter();
    const { app } = buildApp(seed, new EventEmitterPubSub(emitter), asAlice);
    const topic = feedTopic(ORG, project.id);

    const feed = openFeed(await app.request(`/web/factory/projects/${project.id}/feed-events`));
    await vi.waitFor(() => expect(emitter.listenerCount(topic)).toBe(1));

    await feed.stop();
    await vi.waitFor(() => expect(emitter.listenerCount(topic)).toBe(0));
  });

  it('releases a subscription the reader disconnected from before the broker answered', async () => {
    const seed = await createFactoryStorageForTests();
    const { project } = await seedProjectItem(seed);
    const emitter = new EventEmitter();
    let openGate = () => {};
    const pubsub = new GatedPubSub(
      emitter,
      new Promise<void>(resolve => {
        openGate = resolve;
      }),
    );
    const { app } = buildApp(seed, pubsub, asAlice);
    const topic = feedTopic(ORG, project.id);

    const feed = openFeed(await app.request(`/web/factory/projects/${project.id}/feed-events`));
    expect(emitter.listenerCount(topic)).toBe(0);

    await feed.stop();
    openGate();

    await vi.waitFor(() => expect(pubsub.subscribed).toBe(true));
    await vi.waitFor(() => expect(emitter.listenerCount(topic)).toBe(0));
  });
});

describe('direct touches on the board feed stream', () => {
  it('forwards a touch published straight to the project topic', async () => {
    const seed = await createFactoryStorageForTests();
    const { project } = await seedProjectItem(seed);
    const emitter = new EventEmitter();
    const pubsub = new EventEmitterPubSub(emitter);
    const { app } = buildApp(seed, pubsub, asAlice);
    const topic = feedTopic(ORG, project.id);

    const feed = openFeed(await app.request(`/web/factory/projects/${project.id}/feed-events`));
    await vi.waitFor(() => expect(emitter.listenerCount(topic)).toBe(1));
    await pubsub.publish(topic, { type: 'factory.feed.touched', runId: project.id, data: {} });

    await vi.waitFor(() => expect(feed.frames).toHaveLength(1));
    expect(feed.frames[0]).toEqual({ event: 'feed', data: '{}' });
    await feed.stop();
  });
});
