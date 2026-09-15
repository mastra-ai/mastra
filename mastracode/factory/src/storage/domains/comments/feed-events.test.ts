/**
 * Project-scoped SSE feed channel: tenancy guards, one frame per feed
 * mutation, tenant scoping, and listener release on disconnect.
 */

import EventEmitter from 'node:events';

import { EventEmitterPubSub } from '@mastra/core/events';
import type { EventCallback, SubscribeOptions } from '@mastra/core/events';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { feedTopic } from '../../../feed-events.js';
import { fakeRouteAuth, mountApiRoutes } from '../../../routes/test-utils.js';
import type { TestAuthUser } from '../../../routes/test-utils.js';
import { createFactoryStorageForTests } from '../../test-utils.js';
import { CommentsDomain } from './domain.js';

type Seed = Awaited<ReturnType<typeof createFactoryStorageForTests>>;

const ORG = 'org-1';
const asAlice = { workosId: 'user-alice', organizationId: ORG, name: 'Alice' };

function buildApp(seed: Seed, pubsub: EventEmitterPubSub, user?: TestAuthUser) {
  const domain = new CommentsDomain({
    auth: fakeRouteAuth(),
    comments: seed.comments,
    workItems: seed.workItems,
    projects: seed.projects,
    channelIdentity: seed.channelIdentity,
    pubsub,
  });
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(app as never, domain.routes());
  return { app, domain };
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
  const { item } = await seed.workItems.upsert({
    orgId,
    userId,
    factoryProjectId: project.id,
    input: { title: 'Fix login', stages: ['intake'], sessions: {}, metadata: {} },
  });
  return { project, item };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('feed events stream', () => {
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

  it('pushes a frame for every feed mutation: create, edit and delete', async () => {
    const seed = await createFactoryStorageForTests();
    const { project, item } = await seedProjectItem(seed);
    const { app, domain } = buildApp(seed, new EventEmitterPubSub(), asAlice);

    const response = await app.request(`/web/factory/projects/${project.id}/feed-events`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const feed = openFeed(response);

    const author = { kind: 'user' as const, id: 'user-alice', displayName: 'Alice' };
    const created = await domain.createComment({ orgId: ORG, workItemId: item.id, author, body: 'first' });
    if (created.status !== 'created') throw new Error(`create failed: ${created.status}`);

    const editor = { userId: 'user-alice', canModerate: async () => false };
    const edited = await domain.editComment({
      orgId: ORG,
      workItemId: item.id,
      commentId: created.comment.id,
      body: 'first, revised',
      editor,
    });
    expect(edited.status).toBe('edited');

    const deleted = await domain.deleteComment({
      orgId: ORG,
      workItemId: item.id,
      commentId: created.comment.id,
      editor,
    });
    expect(deleted.status).toBe('deleted');

    await vi.waitFor(() => expect(feed.frames).toHaveLength(3));
    expect(feed.frames.map(frame => frame.event)).toEqual(['feed', 'feed', 'feed']);
    expect(feed.frames.map(frame => JSON.parse(frame.data))).toEqual([
      { workItemId: item.id },
      { workItemId: item.id },
      { workItemId: item.id },
    ]);

    await feed.stop();
  });

  it('carries no frame for a comment in another project', async () => {
    const seed = await createFactoryStorageForTests();
    const { project, item } = await seedProjectItem(seed);
    const other = await seedProjectItem(seed);
    const { app, domain } = buildApp(seed, new EventEmitterPubSub(), asAlice);
    const author = { kind: 'user' as const, id: 'user-alice', displayName: 'Alice' };

    const feed = openFeed(await app.request(`/web/factory/projects/${project.id}/feed-events`));
    expect(
      (await domain.createComment({ orgId: ORG, workItemId: other.item.id, author, body: 'elsewhere' })).status,
    ).toBe('created');
    expect((await domain.createComment({ orgId: ORG, workItemId: item.id, author, body: 'here' })).status).toBe(
      'created',
    );

    // The in-project comment is the liveness proof: the stream is open, and the
    // foreign one still never lands on it.
    await vi.waitFor(() => expect(feed.frames).toHaveLength(1));
    expect(JSON.parse(feed.frames[0]!.data)).toEqual({ workItemId: item.id });

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

describe('project-wide touches on the feed stream', () => {
  it('forwards a touch that names no work item', async () => {
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
