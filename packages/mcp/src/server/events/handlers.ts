import type { IMastraLogger } from '@mastra/core/logger';
import type { RequestContext } from '@mastra/core/request-context';
import { ProtocolError, ProtocolErrorCode } from '@modelcontextprotocol/server';
import type { Server, ServerContext } from '@modelcontextprotocol/server';

import {
  EVENTS_ERROR_CODES,
  EVENTS_METHODS,
  EVENTS_SUBSCRIPTION_ID_META_KEY,
  ListEventsRequestParamsSchema,
  ListEventsResultSchema,
  PollEventsRequestParamsSchema,
  PollEventsResultSchema,
  StreamEventsRequestParamsSchema,
  StreamEventsResultSchema,
  SubscribeEventsRequestParamsSchema,
  SubscribeEventsResultSchema,
  UnsubscribeEventsRequestParamsSchema,
  UnsubscribeEventsResultSchema,
} from '../../shared/events';
import type {
  EventDeliveryMode,
  EventOccurrence,
  ListEventsResult,
  PollEventsResult,
  StreamEventsResult,
  SubscribeEventsRequestParams,
} from '../../shared/events';
import { principalOf } from '../request';
import { toDescriptor, toTimestamp } from './registry';
import type { RegisteredEvent, ServerEventRegistry } from './registry';
import { EventStream } from './stream';
import type { WebhookDispatcher } from './webhook-dispatcher';

const DEFAULT_MAX_EVENTS = 100;
const DEFAULT_LIST_PAGE_SIZE = 100;
export const DEFAULT_EVENTS_MAX_STREAMS = 1024;

export interface EventHandlerDeps {
  registry: ServerEventRegistry;
  heartbeatIntervalMs: number;
  listPageSize?: number;
  maxStreams?: number;
  getLogger: () => IMastraLogger;
  /** Serves `events/subscribe` and `events/unsubscribe` when webhook delivery is configured. */
  webhooks?: WebhookDispatcher;
  jsonSchema: (schema: unknown, options: { io: 'input' | 'output' }) => Record<string, unknown> | undefined;
  /** Runs one request under the server's request span with its resolved request context. */
  trace: <T>(
    server: Server,
    method: string,
    params: Record<string, unknown>,
    ctx: ServerContext,
    fn: (requestContext: RequestContext) => Promise<T>,
  ) => Promise<T>;
}

/**
 * Registers `events/list`, `events/poll` and `events/stream` on one protocol instance, plus
 * `events/subscribe` and `events/unsubscribe` when webhook delivery is configured.
 */
export function registerEventHandlers(server: Server, deps: EventHandlerDeps): void {
  const { registry } = deps;

  server.setRequestHandler(
    EVENTS_METHODS.list,
    { params: ListEventsRequestParamsSchema, result: ListEventsResultSchema },
    (params, ctx) =>
      deps.trace(server, EVENTS_METHODS.list, params, ctx, async (): Promise<ListEventsResult> => {
        const pageSize = deps.listPageSize ?? DEFAULT_LIST_PAGE_SIZE;
        const offset = params.cursor === undefined ? 0 : decodeListCursor(params.cursor);
        const events = registry.list();
        const page = events.slice(offset, offset + pageSize).map(event => toDescriptor(event, deps.jsonSchema));
        const next = offset + pageSize;
        return next < events.length ? { events: page, nextCursor: encodeListCursor(next) } : { events: page };
      }),
  );

  server.setRequestHandler(
    EVENTS_METHODS.poll,
    { params: PollEventsRequestParamsSchema, result: PollEventsResultSchema },
    (params, ctx) =>
      deps.trace(server, EVENTS_METHODS.poll, params, ctx, async (requestContext): Promise<PollEventsResult> => {
        const event = registry.resolve(params.name, 'poll');
        const args = await registry.validateArguments(event, params.arguments ?? {});
        await authorizeOrThrow(event, args, requestContext, 'poll', deps);
        const maxEvents = params.maxEvents ?? DEFAULT_MAX_EVENTS;
        const { poll, match, pollIntervalMs } = event.definition;

        if (poll) {
          let result;
          try {
            result = await poll({
              arguments: args,
              cursor: params.cursor ?? null,
              maxEvents,
              maxAgeMs: params.maxAgeMs,
              requestContext,
              signal: ctx.mcpReq.signal,
            });
          } catch (error) {
            deps.getLogger().error(`Poll source for event "${event.name}" failed`, { error });
            throw new ProtocolError(ProtocolErrorCode.InternalError, `Polling event "${event.name}" failed`);
          }
          return withOptional(
            {
              events: result.events.map(
                (polled): EventOccurrence => ({
                  eventId: polled.eventId,
                  name: event.name,
                  timestamp: toTimestamp(polled.timestamp),
                  data: polled.data,
                }),
              ),
              cursor: result.cursor,
            },
            { hasMore: result.hasMore, nextPollMs: result.nextPollMs, truncated: result.truncated },
          );
        }

        const read = bufferOf(event).read(params.cursor, {
          maxEvents,
          maxAgeMs: params.maxAgeMs,
          match:
            match &&
            (data => {
              try {
                return match(args, data);
              } catch (error) {
                deps.getLogger().error(`Event filter for "${event.name}" failed`, { error });
                throw new ProtocolError(ProtocolErrorCode.InternalError, `Event filter for "${event.name}" failed`);
              }
            }),
        });
        return withOptional(
          { events: read.events, cursor: read.cursor },
          { hasMore: read.hasMore || undefined, truncated: read.truncated || undefined, nextPollMs: pollIntervalMs },
        );
      }),
  );

  server.setRequestHandler(
    EVENTS_METHODS.stream,
    { params: StreamEventsRequestParamsSchema, result: StreamEventsResultSchema },
    (params, ctx) =>
      deps.trace(server, EVENTS_METHODS.stream, params, ctx, async (requestContext): Promise<StreamEventsResult> => {
        const event = registry.resolve(params.name, 'push');
        const args = await registry.validateArguments(event, params.arguments ?? {});
        // Before the stream cap, so a forbidden caller never holds a slot.
        await authorizeOrThrow(event, args, requestContext, 'push', deps);
        const buffer = bufferOf(event);
        if (registry.openStreams.size >= (deps.maxStreams ?? DEFAULT_EVENTS_MAX_STREAMS)) {
          throw new ProtocolError(EVENTS_ERROR_CODES.ResourceExhausted, 'Too many open event streams');
        }
        const subscriptionId = ctx.mcpReq.id;
        const { match } = event.definition;
        const stream = new EventStream({
          subscriptionId,
          notify: notification => ctx.mcpReq.notify(notification),
          heartbeatIntervalMs: deps.heartbeatIntervalMs,
          match: match && (data => match(args, data)),
          onError: error =>
            deps.getLogger().warn(`Event stream for "${event.name}" reported an error`, { error, subscriptionId }),
        });

        // Replay and live registration happen in the same tick, so no emit falls between them.
        const replay = buffer.read(params.cursor, {
          maxEvents: Number.POSITIVE_INFINITY,
          maxAgeMs: params.maxAgeMs,
          match: data => stream.matches(data),
        });
        const unsubscribe = registry.subscribe(event, entry => stream.deliver(entry));
        registry.openStreams.add(stream);
        stream.onClose(() => {
          unsubscribe();
          registry.openStreams.delete(stream);
        });

        const { signal } = ctx.mcpReq;
        const onAbort = () => stream.close();
        if (signal.aborted) stream.close();
        else signal.addEventListener('abort', onAbort, { once: true });
        stream.onClose(() => signal.removeEventListener('abort', onAbort));

        stream.start({
          cursor: params.cursor == null ? buffer.head : replay.from,
          truncated: replay.truncated,
          replay: replay.events,
        });
        await stream.closed;
        return { _meta: { [EVENTS_SUBSCRIPTION_ID_META_KEY]: subscriptionId } };
      }),
  );

  const { webhooks } = deps;
  if (!webhooks) return;

  server.setRequestHandler(
    EVENTS_METHODS.subscribe,
    { params: SubscribeEventsRequestParamsSchema, result: SubscribeEventsResultSchema },
    (params, ctx) =>
      // The signing secret must not reach span input and the exporters behind it.
      deps.trace(server, EVENTS_METHODS.subscribe, withoutSecret(params), ctx, async requestContext => {
        const principal = requirePrincipal(ctx, requestContext);
        const event = registry.resolve(params.name, 'webhook');
        const args = await registry.validateArguments(event, params.arguments ?? {});
        try {
          // Refreshes are repeat subscribes, so a caller who lost access is stopped here.
          await authorizeOrThrow(event, args, requestContext, 'webhook', deps);
        } catch (error) {
          if (error instanceof ProtocolError && error.code === EVENTS_ERROR_CODES.Forbidden) {
            await webhooks.unsubscribe({ principal, url: params.delivery.url, name: event.name, arguments: args });
          }
          throw error;
        }
        return webhooks.subscribe(event, args, params, principal);
      }),
  );

  server.setRequestHandler(
    EVENTS_METHODS.unsubscribe,
    { params: UnsubscribeEventsRequestParamsSchema, result: UnsubscribeEventsResultSchema },
    (params, ctx) =>
      deps.trace(server, EVENTS_METHODS.unsubscribe, params, ctx, async requestContext => {
        const principal = requirePrincipal(ctx, requestContext);
        const event = registry.resolve(params.name, 'webhook');
        const args = await registry.validateArguments(event, params.arguments ?? {});
        await webhooks.unsubscribe({ principal, url: params.delivery.url, name: event.name, arguments: args });
        return {};
      }),
  );
}

/** Webhook subscriptions are keyed by the caller, so they need an authenticated one. */
function requirePrincipal(ctx: ServerContext, requestContext: RequestContext): string {
  if (!ctx.http?.authInfo) {
    throw new ProtocolError(EVENTS_ERROR_CODES.Forbidden, 'Webhook subscriptions require an authenticated caller');
  }
  return principalOf(ctx, requestContext);
}

/** Runs the definition's `authorize`; rejects with -32024 when it denies the caller. */
export async function authorizeOrThrow(
  event: RegisteredEvent,
  args: Record<string, unknown>,
  requestContext: RequestContext,
  delivery: EventDeliveryMode,
  deps: Pick<EventHandlerDeps, 'getLogger'>,
): Promise<void> {
  const { authorize } = event.definition;
  if (!authorize) return;
  let allowed: boolean;
  try {
    allowed = await authorize({ arguments: args, requestContext, delivery });
  } catch (error) {
    deps.getLogger().error(`Authorization check for event "${event.name}" failed`, { error });
    throw new ProtocolError(ProtocolErrorCode.InternalError, `Authorizing event "${event.name}" failed`);
  }
  if (allowed !== true) {
    throw new ProtocolError(EVENTS_ERROR_CODES.Forbidden, `Not allowed to subscribe to event "${event.name}"`);
  }
}

function withoutSecret(params: SubscribeEventsRequestParams): Record<string, unknown> {
  return { ...params, delivery: { ...params.delivery, secret: '[redacted]' } };
}

function bufferOf(event: RegisteredEvent) {
  // A type without a buffer never advertises push, and with a poll source poll never reads it.
  if (!event.buffer) {
    throw new ProtocolError(EVENTS_ERROR_CODES.Unsupported, `Event "${event.name}" has no emitted history`, {
      feature: 'deliveryMode',
    });
  }
  return event.buffer;
}

function withOptional<T extends Record<string, unknown>>(base: T, optional: Record<string, unknown>): T {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== undefined) result[key] = value;
  }
  return result as T;
}

function encodeListCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
}

function decodeListCursor(cursor: string): number {
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString());
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'o' in parsed &&
      Number.isInteger(parsed.o) &&
      Number(parsed.o) >= 0
    ) {
      return Number(parsed.o);
    }
  } catch {
    // Falls through to the error below.
  }
  throw new ProtocolError(ProtocolErrorCode.InvalidParams, 'Invalid events/list cursor');
}
