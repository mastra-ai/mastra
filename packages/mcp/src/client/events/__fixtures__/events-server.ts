import { ProtocolError } from '@modelcontextprotocol/server';
import type { Server } from '@modelcontextprotocol/server';
import {
  EVENTS_ERROR_CODES,
  EVENTS_METHODS,
  EVENTS_NOTIFICATIONS,
  EVENTS_SUBSCRIPTION_ID_META_KEY,
  ListEventsRequestParamsSchema,
  PollEventsRequestParamsSchema,
  StreamEventsRequestParamsSchema,
} from '../../../shared/events';
import type {
  EventDescriptor,
  EventOccurrence,
  PollEventsRequestParams,
  StreamEventsRequestParams,
} from '../../../shared/events';

export const EVENT_DESCRIPTORS: EventDescriptor[] = [
  {
    name: 'repo.push',
    description: 'A push to a repository',
    delivery: ['push', 'poll'],
    inputSchema: { type: 'object', properties: { repo: { type: 'string' } }, required: ['repo'] },
  },
  { name: 'ticks', delivery: ['poll'] },
];

interface Stored extends EventOccurrence {
  seq: number;
  arguments: Record<string, unknown> | undefined;
}

interface LiveStream {
  name: string;
  arguments: Record<string, unknown> | undefined;
  send(occurrence: Stored): Promise<void>;
}

const sameArguments = (a: Record<string, unknown> | undefined, b: Record<string, unknown> | undefined) =>
  JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});

/**
 * Event state shared by every server instance it is installed on (Streamable HTTP builds one per
 * request). `install` serves `events/list`, `events/poll` and `events/stream`. Occurrences exist
 * only when the test calls `emit`, and reach only subscriptions whose name and arguments match.
 * Cursors are the sequence number of the last occurrence covered.
 */
export function createEventsFixture() {
  const log: Stored[] = [];
  const live = new Set<LiveStream>();
  const pollRequests: PollEventsRequestParams[] = [];
  const streamRequests: StreamEventsRequestParams[] = [];
  let closedStreams = 0;

  const validate = (name: string, args: Record<string, unknown> | undefined) => {
    if (!EVENT_DESCRIPTORS.some(descriptor => descriptor.name === name)) {
      throw new ProtocolError(EVENTS_ERROR_CODES.NotFound, `Unknown event ${name}`, { kind: 'event' });
    }
    if (args?.repo === 'forbidden') throw new ProtocolError(EVENTS_ERROR_CODES.Forbidden, 'Not allowed');
  };
  const matching = (name: string, args: Record<string, unknown> | undefined, after: number) =>
    log.filter(entry => entry.seq > after && entry.name === name && sameArguments(entry.arguments, args));
  const head = () => log.at(-1)?.seq ?? 0;
  const toWire = ({ seq: _seq, arguments: _args, ...occurrence }: Stored): EventOccurrence => occurrence;

  const install = (server: Server) => {
    server.setRequestHandler(
      EVENTS_METHODS.list,
      { params: ListEventsRequestParamsSchema.optional() },
      async params => {
        if (params?.cursor === 'page-2') return { events: EVENT_DESCRIPTORS.slice(1) };
        return { events: EVENT_DESCRIPTORS.slice(0, 1), nextCursor: 'page-2' };
      },
    );

    server.setRequestHandler(EVENTS_METHODS.poll, { params: PollEventsRequestParamsSchema }, async params => {
      pollRequests.push(params);
      validate(params.name, params.arguments);
      if (params.cursor === null || params.cursor === undefined) {
        return { events: [], cursor: String(head()), nextPollMs: 0 };
      }
      const pending = matching(params.name, params.arguments, Number(params.cursor));
      const page = pending.slice(0, params.maxEvents ?? pending.length);
      return {
        events: page.map(toWire),
        cursor: String(page.at(-1)?.seq ?? Math.max(Number(params.cursor), head())),
        hasMore: page.length < pending.length,
        nextPollMs: 0,
      };
    });

    server.setRequestHandler(
      EVENTS_METHODS.stream,
      { params: StreamEventsRequestParamsSchema },
      async (params, ctx) => {
        streamRequests.push(params);
        validate(params.name, params.arguments);
        const id = ctx.mcpReq.id;
        const meta = { [EVENTS_SUBSCRIPTION_ID_META_KEY]: id };
        const from = params.cursor === null || params.cursor === undefined ? head() : Number(params.cursor);
        await ctx.mcpReq.notify({ method: EVENTS_NOTIFICATIONS.active, params: { cursor: String(from), _meta: meta } });

        const stream: LiveStream = {
          name: params.name,
          arguments: params.arguments,
          send: occurrence =>
            ctx.mcpReq.notify({ method: EVENTS_NOTIFICATIONS.event, params: { ...toWire(occurrence), _meta: meta } }),
        };
        for (const missed of matching(params.name, params.arguments, from)) await stream.send(missed);
        live.add(stream);
        await new Promise<void>(resolve => {
          if (ctx.mcpReq.signal.aborted) resolve();
          ctx.mcpReq.signal.addEventListener('abort', () => resolve(), { once: true });
        });
        live.delete(stream);
        closedStreams++;
        return {};
      },
    );
  };

  return {
    install,
    pollRequests,
    streamRequests,
    get liveStreams() {
      return live.size;
    },
    get closedStreams() {
      return closedStreams;
    },
    async emit(name: string, args: Record<string, unknown> | undefined, data: Record<string, unknown>) {
      const seq = head() + 1;
      const stored: Stored = {
        seq,
        arguments: args,
        eventId: `evt-${seq}`,
        name,
        timestamp: new Date().toISOString(),
        data,
        cursor: String(seq),
      };
      log.push(stored);
      for (const stream of live) {
        if (stream.name === name && sameArguments(stream.arguments, args)) await stream.send(stored);
      }
      return stored.eventId;
    },
  };
}

export type EventsFixture = ReturnType<typeof createEventsFixture>;
