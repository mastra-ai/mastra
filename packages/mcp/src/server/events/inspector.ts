import { randomUUID } from 'node:crypto';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { MCP_SERVER_EVENT_ERROR_IDS } from '@mastra/core/mcp';
import type {
  MCPServerEventInfo,
  MCPServerEventOccurrenceInfo,
  MCPServerEventsInspector,
  MCPServerEventStreamFrame,
} from '@mastra/core/mcp';
import { RequestContext } from '@mastra/core/request-context';
import { ProtocolError } from '@modelcontextprotocol/server';

import { EVENTS_ERROR_CODES, EVENTS_NOTIFICATIONS } from '../../shared/events';
import type { EventOccurrence } from '../../shared/events';
import { openEventStream, pollEvent } from './handlers';
import type { EventHandlerDeps } from './handlers';
import { toDescriptor } from './registry';
import type { StreamNotification } from './stream';

/** Prefix of the `eventId` of occurrences sent with the inspector's `emit`. */
export const TEST_EMIT_EVENT_ID_PREFIX = 'mastra-test-';

type InspectorDeps = Pick<
  EventHandlerDeps,
  'registry' | 'getLogger' | 'heartbeatIntervalMs' | 'maxStreams' | 'jsonSchema'
>;

let localStreamIds = 0;

/** Studio's view of the declared event types: the `events/list` descriptors plus `emittable`. */
export function listEventsInfo(deps: Pick<InspectorDeps, 'registry' | 'jsonSchema'>): MCPServerEventInfo[] {
  return deps.registry.list().map(event => ({
    ...toDescriptor(event, deps.jsonSchema),
    delivery: event.delivery,
    emittable: event.buffer !== undefined,
  }));
}

/**
 * Serves `events/poll` and `events/stream` in-process through the protocol handlers' code
 * paths, translating protocol errors into `MastraError`s with {@link MCP_SERVER_EVENT_ERROR_IDS}.
 */
export function createEventsInspector(deps: InspectorDeps): MCPServerEventsInspector {
  return {
    async poll(name, params, options = {}) {
      const result = await withMastraErrors(() =>
        pollEvent(
          deps,
          { name, arguments: params.arguments, cursor: params.cursor, maxEvents: params.maxEvents },
          {
            requestContext: options.requestContext ?? new RequestContext(),
            signal: options.signal ?? new AbortController().signal,
          },
        ),
      );
      return { ...result, events: result.events.map(toOccurrenceInfo) };
    },

    async stream(name, params, { requestContext, signal, onFrame }) {
      const stream = await withMastraErrors(() =>
        openEventStream(
          deps,
          { name, arguments: params.arguments, cursor: params.cursor },
          {
            subscriptionId: `local-${++localStreamIds}`,
            requestContext: requestContext ?? new RequestContext(),
            notify: async notification => {
              const frame = toFrame(notification);
              if (frame) onFrame(frame);
            },
            signal,
          },
        ),
      );
      return { closed: stream.closed };
    },

    async emit(name, data) {
      const occurrence = await deps.registry.emit(name, data, {
        eventId: `${TEST_EMIT_EVENT_ID_PREFIX}${randomUUID()}`,
      });
      return toOccurrenceInfo(occurrence);
    },
  };
}

function toOccurrenceInfo(occurrence: EventOccurrence): MCPServerEventOccurrenceInfo {
  const { eventId, name, timestamp, data, cursor, _meta } = occurrence;
  const info: MCPServerEventOccurrenceInfo = { eventId, name, timestamp, data };
  if (cursor !== undefined) info.cursor = cursor;
  if (_meta !== undefined) info._meta = _meta;
  return info;
}

function toFrame({ method, params }: StreamNotification): MCPServerEventStreamFrame | undefined {
  const { _meta: _subscription, ...rest } = params;
  switch (method) {
    case EVENTS_NOTIFICATIONS.active:
      return { type: 'active', cursor: cursorOf(rest.cursor), truncated: rest.truncated === true };
    case EVENTS_NOTIFICATIONS.event:
      return { type: 'event', occurrence: toOccurrenceInfo(rest as EventOccurrence) };
    case EVENTS_NOTIFICATIONS.heartbeat:
      return { type: 'heartbeat', cursor: cursorOf(rest.cursor) };
    case EVENTS_NOTIFICATIONS.error:
      return { type: 'error', message: 'The event stream reported an error' };
    case EVENTS_NOTIFICATIONS.terminated:
      return { type: 'terminated' };
    default:
      return undefined;
  }
}

function cursorOf(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

async function withMastraErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (!(error instanceof ProtocolError)) throw error;
    const id = protocolErrorId(error.code);
    if (!id) throw error;
    throw new MastraError({ id, domain: ErrorDomain.MCP, category: ErrorCategory.USER, text: error.message }, error);
  }
}

function protocolErrorId(
  code: number,
): (typeof MCP_SERVER_EVENT_ERROR_IDS)[keyof typeof MCP_SERVER_EVENT_ERROR_IDS] | undefined {
  switch (code) {
    case EVENTS_ERROR_CODES.NotFound:
      return MCP_SERVER_EVENT_ERROR_IDS.unknownEvent;
    case EVENTS_ERROR_CODES.Unsupported:
      return MCP_SERVER_EVENT_ERROR_IDS.unsupportedDelivery;
    case EVENTS_ERROR_CODES.InvalidParams:
      return MCP_SERVER_EVENT_ERROR_IDS.invalidArguments;
    case EVENTS_ERROR_CODES.Forbidden:
      return MCP_SERVER_EVENT_ERROR_IDS.forbidden;
    case EVENTS_ERROR_CODES.ResourceExhausted:
      return MCP_SERVER_EVENT_ERROR_IDS.tooManyStreams;
    default:
      return undefined;
  }
}
