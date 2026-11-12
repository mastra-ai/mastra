/**
 * The project's live-board stream: one SSE frame each time something on the
 * board changes, so open boards re-read instead of polling. A change to the
 * intake candidates is its own `intake` frame, which rereads only that list.
 */

import { withAck } from '@mastra/core/events';
import type { EventCallback, PubSub } from '@mastra/core/events';
import type { ApiRoute } from '@mastra/core/server';
import { registerApiRoute } from '@mastra/core/server';
import { streamSSE } from 'hono/streaming';

import { feedTopic, INTAKE_TOUCHED } from '../feed-events.js';
import type { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import { loose } from './route.js';
import type { RouteAuth } from './route.js';

/** Proxies drop an idle stream, and `write` can't detect a dead peer. */
const FEED_KEEPALIVE_MS = 25_000;
// Ceiling: one broker subscription per open tab, not per project. A per-replica
// topic multiplexer is the upgrade path if tab counts ever make that hurt.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface FeedEventsRouteDependencies {
  auth: RouteAuth;
  projects: FactoryProjectsStorage;
  pubsub: PubSub;
}

export function buildFeedEventsRoutes({ auth, projects, pubsub }: FeedEventsRouteDependencies): ApiRoute[] {
  return [
    registerApiRoute('/web/factory/projects/:id/feed-events', {
      method: 'GET',
      handler: async cc => {
        const c = loose(cc);
        await auth.ensureUser(c);
        const tenant = auth.tenant(c);
        if (!tenant) return c.json({ error: 'unauthorized' }, 401);
        if (!tenant.orgId) {
          return c.json({ error: 'organization_required', message: 'The board stream requires an organization.' }, 403);
        }
        const orgId = tenant.orgId;

        const projectId = c.req.param('id');
        if (!projectId || !UUID_RE.test(projectId)) return c.json({ error: 'Project not found' }, 404);
        await projects.ensureReady();
        const project = await projects.get({ orgId, id: projectId });
        if (!project) return c.json({ error: 'Project not found' }, 404);

        const topic = feedTopic(orgId, projectId);
        return streamSSE(c, async stream => {
          // `withAck` settles every delivery: on a durable broker (Redis
          // Streams) an unacked event stays in the subscription's pending set
          // and in the broker client's in-flight bookkeeping for the life of
          // this connection — a leak that grows with every board change on
          // long-lived dashboard tabs. Frames are fire-and-forget
          // invalidations, so a delivery is acked even when the tab is gone.
          const onEvent: EventCallback = withAck(async event => {
            if (stream.aborted) return;
            try {
              // A reader that predates `intake` ignores it, so the board frame keeps its name.
              await stream.writeSSE({ event: event.type === INTAKE_TOUCHED ? 'intake' : 'feed', data: '{}' });
            } catch {
              // A write to a half-closed socket must not reach `withAck` as a
              // rejection: the nack would republish the event to the shared
              // topic, duplicating the invalidation for every tab.
            }
          });
          // Claimed before any await: `onAbort` handlers registered after the
          // reader is gone never run, and a broker subscribe is a round trip.
          const closed = new Promise<void>(resolve => stream.onAbort(resolve));
          let keepalive: ReturnType<typeof setInterval> | undefined;
          try {
            // Without `latest`, a retaining broker replays its whole backlog into
            // every new connection as spurious invalidations.
            await pubsub.subscribe(topic, onEvent, { startFrom: 'latest' });
            if (!stream.aborted) {
              const ping = () => {
                if (stream.aborted) return;
                void stream.write(': ping\n\n');
              };
              // A proxy that holds the response until its first byte would keep the reader waiting a whole keepalive.
              ping();
              keepalive = setInterval(ping, FEED_KEEPALIVE_MS);
              // `streamSSE` closes the stream the moment this callback returns.
              await closed;
            }
          } finally {
            clearInterval(keepalive);
            await pubsub.unsubscribe(topic, onEvent);
          }
        });
      },
    }),
  ];
}
