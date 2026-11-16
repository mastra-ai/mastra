import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { Mastra } from '@mastra/core/mastra';
import type {
  MCPServerBase,
  MCPServerEventInfo,
  MCPServerEventsInspector,
  MCPServerEventStreamFrame,
  ServerDetailInfo,
  ServerInfo,
} from '@mastra/core/mcp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { coreAuthMiddleware } from '../auth/helpers';
import { HTTPException } from '../http-exception';
import { listMcpServerEventsResponseSchema, mcpServerEventStreamFrameSchema } from '../schemas/mcp';
import {
  EMIT_MCP_SERVER_EVENT_ROUTE,
  GET_MCP_SERVER_DETAIL_ROUTE,
  LIST_MCP_SERVERS_ROUTE,
  LIST_MCP_SERVER_EVENTS_ROUTE,
  POLL_MCP_SERVER_EVENT_ROUTE,
  STREAM_MCP_SERVER_EVENT_ROUTE,
} from './mcp';
import { createTestServerContext } from './test-utils';

const info: ServerInfo = {
  id: 'events',
  name: 'Events',
  version_detail: { version: '1.0.0', release_date: '2026-01-01T00:00:00Z', is_latest: true },
};

const ticketCreated: MCPServerEventInfo = {
  name: 'ticket.created',
  description: 'A ticket was created',
  delivery: ['push', 'poll'],
  inputSchema: { type: 'object', properties: { project: { type: 'string' } } },
  payloadSchema: { type: 'object', properties: { id: { type: 'string' } } },
  emittable: true,
};

const occurrence = {
  eventId: 'evt-1',
  name: 'ticket.created',
  timestamp: '2026-01-01T00:00:00.000Z',
  data: { id: '1' },
  cursor: 'c1',
};

function eventError(id: string, text = `upstream detail for ${id}`) {
  return new MastraError({ id, domain: ErrorDomain.MCP, category: ErrorCategory.USER, text });
}

/** A fake inspector whose `stream` records the signal and exposes `push`/`end` for the test. */
function fakeInspector() {
  let onFrame: ((frame: MCPServerEventStreamFrame) => void) | undefined;
  let signal: AbortSignal | undefined;
  let resolveClosed!: () => void;
  const closed = new Promise<void>(resolve => {
    resolveClosed = resolve;
  });
  const inspector = {
    poll: vi.fn<MCPServerEventsInspector['poll']>(async () => ({ events: [occurrence], cursor: 'c1' })),
    stream: vi.fn<MCPServerEventsInspector['stream']>(async (_name, _params, options) => {
      onFrame = options.onFrame;
      signal = options.signal;
      options.signal.addEventListener('abort', () => resolveClosed(), { once: true });
      onFrame({ type: 'active', cursor: 'c0', truncated: false });
      return { closed };
    }),
    emit: vi.fn<MCPServerEventsInspector['emit']>(async () => ({ ...occurrence, eventId: 'mastra-test-1' })),
  };
  return {
    inspector,
    push: (frame: MCPServerEventStreamFrame) => onFrame?.(frame),
    end: () => resolveClosed(),
    get signal() {
      return signal;
    },
  };
}

function makeMastra(server: Partial<MCPServerBase> | undefined) {
  const logger = { error: vi.fn() };
  const mastra = {
    getMCPServerById: vi.fn(() => server as MCPServerBase | undefined),
    listMCPServers: vi.fn(() => (server ? { events: server as MCPServerBase } : {})),
    getLogger: vi.fn(() => logger),
  } as unknown as Mastra;
  return { mastra, logger };
}

function makeServer(inspector?: ReturnType<typeof fakeInspector>['inspector'], events = [ticketCreated]) {
  return {
    id: 'events',
    getServerInfo: vi.fn(() => info),
    getServerDetail: vi.fn((): ServerDetailInfo => info),
    getEventsInfo: vi.fn(() => ({ events })),
    getEventsInspector: vi.fn(() => inspector),
  } satisfies Partial<MCPServerBase>;
}

async function readFrames(stream: ReadableStream<MCPServerEventStreamFrame>, count: number) {
  const reader = stream.getReader();
  const frames: MCPServerEventStreamFrame[] = [];
  while (frames.length < count) {
    const { value, done } = await reader.read();
    if (done) break;
    frames.push(value);
  }
  return { frames, reader };
}

describe('MCP event routes', () => {
  const originalDev = process.env.MASTRA_DEV;

  beforeEach(() => {
    delete process.env.MASTRA_DEV;
  });

  afterEach(() => {
    if (originalDev === undefined) delete process.env.MASTRA_DEV;
    else process.env.MASTRA_DEV = originalDev;
  });

  describe('server list and detail', () => {
    it('flags servers that declare events', async () => {
      const { mastra } = makeMastra(makeServer());

      const list = await LIST_MCP_SERVERS_ROUTE.handler(createTestServerContext({ mastra }));
      const detail = await GET_MCP_SERVER_DETAIL_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        id: 'events',
      });

      expect(list.servers[0]).toMatchObject({ id: 'events', events_capability: true });
      expect(detail).toMatchObject({ id: 'events', events_capability: true });
    });

    it('omits the flag for servers without events or without the method', async () => {
      const withoutEvents = makeMastra(makeServer(undefined, []));
      const legacy = makeMastra({ id: 'events', getServerInfo: () => info, getServerDetail: () => info });

      for (const { mastra } of [withoutEvents, legacy]) {
        const list = await LIST_MCP_SERVERS_ROUTE.handler(createTestServerContext({ mastra }));
        expect(list.servers[0]).not.toHaveProperty('events_capability');
      }
    });
  });

  describe('LIST_MCP_SERVER_EVENTS_ROUTE', () => {
    it('returns the declared events and whether test emit is served', async () => {
      const { mastra } = makeMastra(makeServer());

      const result = await LIST_MCP_SERVER_EVENTS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        serverId: 'events',
      });

      expect(result).toEqual({ events: [ticketCreated], testEmit: false });
      expect(listMcpServerEventsResponseSchema.parse(result)).toEqual(result);
    });

    it('reports testEmit under mastra dev', async () => {
      process.env.MASTRA_DEV = 'true';
      const { mastra } = makeMastra(makeServer());

      const result = await LIST_MCP_SERVER_EVENTS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        serverId: 'events',
      });

      expect(result.testEmit).toBe(true);
    });

    it('returns no events for a server without events support', async () => {
      const { mastra } = makeMastra({ id: 'plain' });

      const result = await LIST_MCP_SERVER_EVENTS_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        serverId: 'plain',
      });

      expect(result.events).toEqual([]);
    });

    it('returns 404 for an unknown server', async () => {
      const { mastra } = makeMastra(undefined);

      await expect(
        LIST_MCP_SERVER_EVENTS_ROUTE.handler({ ...createTestServerContext({ mastra }), serverId: 'nope' }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('POLL_MCP_SERVER_EVENT_ROUTE', () => {
    it('passes arguments, cursor and maxEvents through', async () => {
      const fake = fakeInspector();
      const { mastra } = makeMastra(makeServer(fake.inspector));
      const context = createTestServerContext({ mastra });

      const result = await POLL_MCP_SERVER_EVENT_ROUTE.handler({
        ...context,
        serverId: 'events',
        eventName: 'ticket.created',
        arguments: { project: 'web' },
        cursor: 'c0',
        maxEvents: 5,
      });

      expect(result).toEqual({ events: [occurrence], cursor: 'c1' });
      expect(fake.inspector.poll).toHaveBeenCalledWith(
        'ticket.created',
        { arguments: { project: 'web' }, cursor: 'c0', maxEvents: 5 },
        { requestContext: context.requestContext, signal: context.abortSignal },
      );
    });

    it('maps known errors to generic 4xx responses', async () => {
      const fake = fakeInspector();
      const { mastra } = makeMastra(makeServer(fake.inspector));
      fake.inspector.poll.mockRejectedValueOnce(eventError('MCP_SERVER_EVENT_INVALID_ARGUMENTS'));
      fake.inspector.poll.mockRejectedValueOnce(eventError('MCP_SERVER_UNKNOWN_EVENT'));
      const call = () =>
        POLL_MCP_SERVER_EVENT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          serverId: 'events',
          eventName: 'ticket.created',
        });

      await expect(call()).rejects.toMatchObject({ status: 400, message: 'Invalid event arguments' });
      await expect(call()).rejects.toMatchObject({ status: 404, message: 'Event not found' });
    });

    it('logs unexpected errors and returns a generic 500 without the upstream detail', async () => {
      const fake = fakeInspector();
      const { mastra, logger } = makeMastra(makeServer(fake.inspector));
      const upstream = new Error('upstream API key sk-secret rejected');
      fake.inspector.poll.mockRejectedValueOnce(upstream);

      const error = await POLL_MCP_SERVER_EVENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        serverId: 'events',
        eventName: 'ticket.created',
      }).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HTTPException);
      expect(error).toMatchObject({ status: 500, message: 'Event request failed' });
      expect(JSON.stringify(error)).not.toContain('sk-secret');
      expect((error as HTTPException).cause).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(expect.any(String), { error: upstream });
    });
  });

  describe('STREAM_MCP_SERVER_EVENT_ROUTE', () => {
    it('streams the active frame, then events, and ends when the stream closes', async () => {
      const fake = fakeInspector();
      const { mastra } = makeMastra(makeServer(fake.inspector));

      const stream = (await STREAM_MCP_SERVER_EVENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        serverId: 'events',
        eventName: 'ticket.created',
        arguments: { project: 'web' },
        cursor: null,
      })) as ReadableStream<MCPServerEventStreamFrame>;
      fake.push({ type: 'event', occurrence });
      const { frames, reader } = await readFrames(stream, 2);
      fake.end();

      expect(frames).toEqual([
        { type: 'active', cursor: 'c0', truncated: false },
        { type: 'event', occurrence },
      ]);
      for (const frame of frames) expect(mcpServerEventStreamFrameSchema.parse(frame)).toEqual(frame);
      expect(await reader.read()).toEqual({ done: true, value: undefined });
      expect(fake.inspector.stream).toHaveBeenCalledWith(
        'ticket.created',
        { arguments: { project: 'web' }, cursor: null },
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      );
    });

    it('aborts the event stream once when the request aborts', async () => {
      const fake = fakeInspector();
      const { mastra } = makeMastra(makeServer(fake.inspector));
      const request = new AbortController();

      const stream = (await STREAM_MCP_SERVER_EVENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        abortSignal: request.signal,
        serverId: 'events',
        eventName: 'ticket.created',
      })) as ReadableStream<MCPServerEventStreamFrame>;
      const onAbort = vi.fn();
      fake.signal?.addEventListener('abort', onAbort);
      request.abort();
      request.abort();

      expect(fake.signal?.aborted).toBe(true);
      expect(onAbort).toHaveBeenCalledTimes(1);
      const { frames } = await readFrames(stream, 10);
      expect(frames).toEqual([{ type: 'active', cursor: 'c0', truncated: false }]);
    });

    it('aborts the event stream when the client cancels the response body', async () => {
      const fake = fakeInspector();
      const { mastra } = makeMastra(makeServer(fake.inspector));

      const stream = (await STREAM_MCP_SERVER_EVENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        serverId: 'events',
        eventName: 'ticket.created',
      })) as ReadableStream<MCPServerEventStreamFrame>;
      await stream.cancel();

      expect(fake.signal?.aborted).toBe(true);
      // Frames arriving after the cancel are dropped rather than enqueued on a closed stream.
      expect(() => fake.push({ type: 'event', occurrence })).not.toThrow();
    });

    it('returns a generic 429 for streams past the server limit and frees the slot on abort', async () => {
      // Mirrors MCPServer: at most `maxStreams` open, further opens fail with the stable id.
      const maxStreams = 2;
      const open = new Set<AbortSignal>();
      const inspector = {
        ...fakeInspector().inspector,
        stream: vi.fn<MCPServerEventsInspector['stream']>(async (_name, _params, options) => {
          if (open.size >= maxStreams) {
            throw eventError('MCP_SERVER_EVENT_TOO_MANY_STREAMS', 'Too many open event streams (upstream)');
          }
          open.add(options.signal);
          const closed = new Promise<void>(resolve =>
            options.signal.addEventListener('abort', () => (open.delete(options.signal), resolve()), { once: true }),
          );
          options.onFrame({ type: 'active', cursor: 'c0', truncated: false });
          return { closed };
        }),
      };
      const { mastra, logger } = makeMastra(makeServer(inspector));
      const request = () => {
        const controller = new AbortController();
        const response = STREAM_MCP_SERVER_EVENT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          serverId: 'events',
          eventName: 'ticket.created',
          abortSignal: controller.signal,
        });
        return { controller, response };
      };

      const first = request();
      await first.response;
      await request().response;

      const rejected = await request().response.catch((error: unknown) => error);
      expect(rejected).toBeInstanceOf(HTTPException);
      expect(rejected).toMatchObject({ status: 429, message: 'Too many open event streams' });
      expect(logger.error).not.toHaveBeenCalled();

      first.controller.abort();
      await expect(request().response).resolves.toBeInstanceOf(ReadableStream);
    });

    it('returns 400 for a poll-only event before opening a stream', async () => {
      const fake = fakeInspector();
      const { mastra } = makeMastra(makeServer(fake.inspector));
      fake.inspector.stream.mockRejectedValueOnce(eventError('MCP_SERVER_EVENT_UNSUPPORTED_DELIVERY'));

      await expect(
        STREAM_MCP_SERVER_EVENT_ROUTE.handler({
          ...createTestServerContext({ mastra }),
          serverId: 'events',
          eventName: 'build.finished',
        }),
      ).rejects.toMatchObject({ status: 400, message: 'This event does not support streaming; poll it instead' });
    });

    it("returns 403 when the event's authorize denies the caller, on stream and poll, without logging", async () => {
      const fake = fakeInspector();
      const { mastra, logger } = makeMastra(makeServer(fake.inspector));
      const denied = eventError('MCP_SERVER_EVENT_FORBIDDEN', 'Not allowed to subscribe to event "ticket.created"');
      fake.inspector.stream.mockRejectedValueOnce(denied);
      fake.inspector.poll.mockRejectedValueOnce(denied);
      const context = { ...createTestServerContext({ mastra }), serverId: 'events', eventName: 'ticket.created' };

      await expect(STREAM_MCP_SERVER_EVENT_ROUTE.handler(context)).rejects.toMatchObject({
        status: 403,
        message: 'Not allowed to use this event',
      });
      await expect(POLL_MCP_SERVER_EVENT_ROUTE.handler(context)).rejects.toMatchObject({
        status: 403,
        message: 'Not allowed to use this event',
      });
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe('EMIT_MCP_SERVER_EVENT_ROUTE', () => {
    const emit = (mastra: Mastra, data: Record<string, unknown> = { id: '9' }, eventName = 'ticket.created') =>
      EMIT_MCP_SERVER_EVENT_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        serverId: 'events',
        eventName,
        data,
      });

    it('is not served outside mastra dev', async () => {
      const fake = fakeInspector();
      const { mastra } = makeMastra(makeServer(fake.inspector));

      await expect(emit(mastra)).rejects.toMatchObject({ status: 404 });
      expect(fake.inspector.emit).not.toHaveBeenCalled();
    });

    it('emits a test occurrence under mastra dev', async () => {
      process.env.MASTRA_DEV = 'true';
      const fake = fakeInspector();
      const { mastra } = makeMastra(makeServer(fake.inspector));

      const result = await emit(mastra);

      expect(result.occurrence.eventId).toBe('mastra-test-1');
      expect(fake.inspector.emit).toHaveBeenCalledWith('ticket.created', { id: '9' });
    });

    it('returns generic 400s for poll-sourced types and invalid data', async () => {
      process.env.MASTRA_DEV = 'true';
      const fake = fakeInspector();
      const { mastra } = makeMastra(makeServer(fake.inspector));
      fake.inspector.emit.mockRejectedValueOnce(eventError('MCP_SERVER_EVENT_NOT_EMITTABLE'));
      fake.inspector.emit.mockRejectedValueOnce(
        eventError('MCP_SERVER_EVENT_INVALID_PAYLOAD', 'Invalid payload: secret field value'),
      );

      await expect(emit(mastra, {}, 'build.finished')).rejects.toMatchObject({
        status: 400,
        message: 'This event is fed by a poll source and cannot be emitted',
      });
      await expect(emit(mastra, { id: 1 })).rejects.toMatchObject({ status: 400, message: 'Invalid event data' });
    });

    it('still requires an authenticated caller when an auth provider is configured', async () => {
      process.env.MASTRA_DEV = 'true';

      const result = await coreAuthMiddleware({
        path: '/api/mcp/events/events/ticket.created/emit',
        method: 'POST',
        getHeader: name => (name === 'x-mastra-dev-playground' ? 'true' : undefined),
        mastra: { getServer: () => ({}), getLogger: () => null } as unknown as Mastra,
        authConfig: { authenticateToken: async () => null },
        requestContext: { get: () => undefined, set: () => {} },
        rawRequest: {} as never,
        token: null,
        requiresAuth: EMIT_MCP_SERVER_EVENT_ROUTE.requiresAuth,
        buildAuthorizeContext: () => null,
      });

      expect(EMIT_MCP_SERVER_EVENT_ROUTE.requiresAuth).toBe(true);
      expect(result).toMatchObject({ action: 'error', status: 401 });
    });
  });
});
