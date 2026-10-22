import { MastraError } from '@mastra/core/error';
import { noopLogger } from '@mastra/core/logger';
import type { MCPServerEventStreamFrame } from '@mastra/core/mcp';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { MCPServer } from '../server';
import { defineEvent } from './define-event';
import { createEventsInspector, TEST_EMIT_EVENT_ID_PREFIX } from './inspector';
import { ServerEventRegistry } from './registry';
import type { MCPServerEventDefinition } from './types';

const ticketCreated = () =>
  defineEvent({
    description: 'A ticket was created',
    inputSchema: z.object({ project: z.string().optional() }),
    payloadSchema: z.object({ id: z.string(), project: z.string() }),
    match: (args, data) => !args.project || data.project === args.project,
  });

const buildFinished = () =>
  defineEvent({
    description: 'A build finished',
    inputSchema: z.object({ branch: z.string() }),
    poll: async context => ({
      events: [{ eventId: `build-${context.arguments.branch}`, data: { branch: context.arguments.branch } }],
      cursor: 'next',
      nextPollMs: 5_000,
    }),
  });

function setup(events: Record<string, MCPServerEventDefinition>, maxStreams?: number) {
  const registry = new ServerEventRegistry(events);
  const inspector = createEventsInspector({
    registry,
    heartbeatIntervalMs: 60_000,
    maxStreams,
    getLogger: () => noopLogger,
    jsonSchema: () => undefined,
  });
  return { registry, inspector };
}

function collect() {
  const frames: MCPServerEventStreamFrame[] = [];
  return { frames, onFrame: (frame: MCPServerEventStreamFrame) => void frames.push(frame) };
}

/** Lets the stream's notification queue flush. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

async function expectMastraError(promise: Promise<unknown>, id: string) {
  const error = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(MastraError);
  expect((error as MastraError).id).toBe(id);
}

describe('MCPServer events inspector', () => {
  describe('getEventsInfo', () => {
    it('returns the events/list descriptors plus whether each type is emittable', () => {
      const server = new MCPServer({
        id: 'events',
        name: 'Events',
        version: '1.0.0',
        tools: {},
        events: { 'ticket.created': ticketCreated(), 'build.finished': buildFinished() },
      });

      const info = server.getEventsInfo();

      expect(info?.events).toEqual(
        server.events.list().map(descriptor => ({
          ...descriptor,
          emittable: descriptor.name === 'ticket.created',
        })),
      );
      expect(info?.events[0]?.inputSchema).toBeDefined();
    });

    it('returns undefined for a server without events', () => {
      const server = new MCPServer({ id: 'plain', name: 'Plain', version: '1.0.0', tools: {} });

      expect(server.getEventsInfo()).toBeUndefined();
      expect(server.getEventsInspector()).toBeUndefined();
    });
  });

  describe('poll', () => {
    it('reads the ring buffer from a cursor, filtered by match', async () => {
      const { registry, inspector } = setup({ 'ticket.created': ticketCreated() });
      const first = await registry.emit('ticket.created', { id: '1', project: 'web' });
      await registry.emit('ticket.created', { id: '2', project: 'api' });
      await registry.emit('ticket.created', { id: '3', project: 'web' });

      const result = await inspector.poll('ticket.created', { arguments: { project: 'web' }, cursor: first.cursor });

      expect(result.events.map(event => event.data.id)).toEqual(['3']);
      expect(result.cursor).toEqual(expect.any(String));
    });

    it('calls a poll source with the arguments and cursor', async () => {
      const { inspector } = setup({ 'build.finished': buildFinished() });

      const result = await inspector.poll('build.finished', { arguments: { branch: 'main' } });

      expect(result).toMatchObject({
        events: [{ eventId: 'build-main', name: 'build.finished', data: { branch: 'main' } }],
        cursor: 'next',
        nextPollMs: 5_000,
      });
    });

    it('reports invalid arguments and unknown events with stable error ids', async () => {
      const { inspector } = setup({ 'build.finished': buildFinished() });

      await expectMastraError(
        inspector.poll('build.finished', { arguments: {} }),
        'MCP_SERVER_EVENT_INVALID_ARGUMENTS',
      );
      await expectMastraError(inspector.poll('nope', {}), 'MCP_SERVER_UNKNOWN_EVENT');
    });
  });

  describe('stream', () => {
    it('sends active, then the replay from the cursor, then live occurrences', async () => {
      const { registry, inspector } = setup({ 'ticket.created': ticketCreated() });
      const first = await registry.emit('ticket.created', { id: '1', project: 'web' });
      await registry.emit('ticket.created', { id: '2', project: 'web' });
      const controller = new AbortController();
      const { frames, onFrame } = collect();

      await inspector.stream('ticket.created', { cursor: first.cursor }, { signal: controller.signal, onFrame });
      await registry.emit('ticket.created', { id: '3', project: 'web' });
      await flush();

      expect(frames.map(frame => frame.type)).toEqual(['active', 'event', 'event']);
      expect(frames[0]).toEqual({ type: 'active', cursor: first.cursor, truncated: false });
      expect(frames.slice(1).map(frame => frame.type === 'event' && frame.occurrence.data.id)).toEqual(['2', '3']);
      const live = frames[2];
      expect(live?.type === 'event' && live.occurrence._meta).toBeFalsy();
      controller.abort();
    });

    it('marks the active frame truncated when the cursor fell out of the buffer', async () => {
      const { registry, inspector } = setup({ 'ticket.created': defineEvent({ bufferSize: 1 }) });
      const first = await registry.emit('ticket.created', { n: 1 });
      await registry.emit('ticket.created', { n: 2 });
      await registry.emit('ticket.created', { n: 3 });
      const controller = new AbortController();
      const { frames, onFrame } = collect();

      await inspector.stream('ticket.created', { cursor: first.cursor }, { signal: controller.signal, onFrame });
      await flush();

      expect(frames[0]).toMatchObject({ type: 'active', truncated: true });
      controller.abort();
    });

    it('removes its listener and open stream when aborted', async () => {
      const { registry, inspector } = setup({ 'ticket.created': ticketCreated() });
      const controller = new AbortController();
      const { onFrame } = collect();

      const { closed } = await inspector.stream('ticket.created', {}, { signal: controller.signal, onFrame });
      expect(registry.listenerCount()).toBe(1);
      expect(registry.openStreams.size).toBe(1);

      controller.abort();
      await closed;

      expect(registry.listenerCount()).toBe(0);
      expect(registry.openStreams.size).toBe(0);
    });

    it('leaks no listener when the client disconnects before the first frame', async () => {
      const { registry, inspector } = setup({ 'ticket.created': ticketCreated() });
      const controller = new AbortController();
      const { frames, onFrame } = collect();

      // Aborted while arguments are validated, before `active` can be sent.
      const opening = inspector.stream('ticket.created', {}, { signal: controller.signal, onFrame });
      controller.abort();
      const { closed } = await opening;
      await closed;
      await flush();

      expect(frames).toEqual([]);
      expect(registry.listenerCount()).toBe(0);
      expect(registry.openStreams.size).toBe(0);
    });

    it('ends local streams when the server closes', async () => {
      const server = new MCPServer({
        id: 'events',
        name: 'Events',
        version: '1.0.0',
        tools: {},
        events: { 'ticket.created': ticketCreated() },
      });
      const { onFrame } = collect();

      const { closed } = await server
        .getEventsInspector()!
        .stream('ticket.created', {}, { signal: new AbortController().signal, onFrame });
      await server.close();

      await expect(closed).resolves.toBeUndefined();
    });

    it('reports streams past maxStreams with a stable error id until one closes', async () => {
      const { registry, inspector } = setup({ 'ticket.created': ticketCreated() }, 2);
      const open = () => {
        const controller = new AbortController();
        return inspector
          .stream('ticket.created', {}, { signal: controller.signal, onFrame: () => {} })
          .then(({ closed }) => ({ controller, closed }));
      };
      const first = await open();
      await open();

      await expectMastraError(open(), 'MCP_SERVER_EVENT_TOO_MANY_STREAMS');
      expect(registry.openStreams.size).toBe(2);

      first.controller.abort();
      await first.closed;
      await expect(open()).resolves.toBeDefined();
    });

    it('rejects a poll-only type', async () => {
      const { inspector } = setup({ 'build.finished': buildFinished() });

      await expectMastraError(
        inspector.stream(
          'build.finished',
          { arguments: { branch: 'main' } },
          { signal: new AbortController().signal, onFrame: () => {} },
        ),
        'MCP_SERVER_EVENT_UNSUPPORTED_DELIVERY',
      );
    });
  });

  describe('authorize', () => {
    function guarded() {
      const seen: Array<{ user: unknown; delivery: string }> = [];
      const definition = defineEvent({
        description: 'A ticket was created',
        inputSchema: z.object({ project: z.string() }),
        payloadSchema: z.object({ id: z.string(), project: z.string() }),
        authorize: ({ requestContext, delivery }) => {
          const user = requestContext.get('user') as { id: string } | undefined;
          seen.push({ user, delivery });
          return user?.id === 'a';
        },
      });
      return { seen, ...setup({ 'ticket.created': definition }) };
    }

    const as = (id: string) => {
      const requestContext = new RequestContext();
      requestContext.set('user', { id });
      return requestContext;
    };

    it("passes the caller's requestContext to authorize on stream and poll", async () => {
      const { inspector, registry, seen } = guarded();
      const controller = new AbortController();
      const { frames, onFrame } = collect();

      const stream = await inspector.stream(
        'ticket.created',
        { arguments: { project: 'web' } },
        { requestContext: as('a'), signal: controller.signal, onFrame },
      );
      await inspector.poll('ticket.created', { arguments: { project: 'web' } }, { requestContext: as('a') });

      expect(seen).toEqual([
        { user: { id: 'a' }, delivery: 'push' },
        { user: { id: 'a' }, delivery: 'poll' },
      ]);
      registry.emit('ticket.created', { id: 't-1', project: 'web' });
      await flush();
      expect(frames.some(frame => frame.type === 'event')).toBe(true);
      controller.abort();
      await stream.closed;
    });

    it('rejects a denied caller with a stable error id and holds no stream slot', async () => {
      const { inspector, registry } = guarded();

      await expectMastraError(
        inspector.stream(
          'ticket.created',
          { arguments: { project: 'web' } },
          { requestContext: as('b'), signal: new AbortController().signal, onFrame: () => {} },
        ),
        'MCP_SERVER_EVENT_FORBIDDEN',
      );
      await expectMastraError(
        inspector.poll('ticket.created', { arguments: { project: 'web' } }, { requestContext: as('b') }),
        'MCP_SERVER_EVENT_FORBIDDEN',
      );
      expect(registry.openStreams.size).toBe(0);
    });
  });

  describe('emit', () => {
    it('stamps test occurrences and delivers them to open streams', async () => {
      const { inspector } = setup({ 'ticket.created': ticketCreated() });
      const controller = new AbortController();
      const { frames, onFrame } = collect();
      await inspector.stream('ticket.created', {}, { signal: controller.signal, onFrame });

      const occurrence = await inspector.emit('ticket.created', { id: '9', project: 'web' });
      await flush();

      expect(occurrence.eventId.startsWith(TEST_EMIT_EVENT_ID_PREFIX)).toBe(true);
      expect(frames.at(-1)).toEqual({ type: 'event', occurrence });
      controller.abort();
    });

    it('rejects poll-sourced types and invalid payloads', async () => {
      const { inspector } = setup({ 'ticket.created': ticketCreated(), 'build.finished': buildFinished() });

      await expectMastraError(inspector.emit('build.finished', { branch: 'main' }), 'MCP_SERVER_EVENT_NOT_EMITTABLE');
      await expectMastraError(inspector.emit('ticket.created', { id: 1 }), 'MCP_SERVER_EVENT_INVALID_PAYLOAD');
    });
  });
});
