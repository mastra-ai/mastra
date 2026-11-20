import type {
  McpServerEventInfo,
  McpServerEventListResponse,
  McpServerEventOccurrence,
  McpServerEventStreamFrame,
  McpServerInfo,
} from '@mastra/client-js';

const versionDetail: McpServerInfo['version_detail'] = {
  version: '1.0.0',
  release_date: '2026-07-28T00:00:00Z',
  is_latest: true,
};

/** A server that declares events. */
export const eventsServer: McpServerInfo = {
  id: 'tickets',
  name: 'Tickets',
  version_detail: versionDetail,
  transports: ['streamable-http'],
  events_capability: true,
};

/** A push type fed by `server.events.emit()`. */
export const ticketCreated: McpServerEventInfo = {
  name: 'ticket.created',
  description: 'A ticket was created',
  delivery: ['push', 'poll'],
  inputSchema: { type: 'object', properties: { project: { type: 'string' } } },
  payloadSchema: { type: 'object', properties: { title: { type: 'string' } }, required: ['title'] },
  emittable: true,
};

/** A poll-only type backed by a `poll()` source. */
export const buildFinished: McpServerEventInfo = {
  name: 'build.finished',
  description: 'A CI build finished',
  delivery: ['poll'],
  emittable: false,
};

export const eventList = (testEmit: boolean): McpServerEventListResponse => ({
  events: [ticketCreated, buildFinished],
  testEmit,
});

export const occurrence = (eventId: string, title: string): McpServerEventOccurrence => ({
  eventId,
  name: 'ticket.created',
  timestamp: '2026-07-28T10:00:00.000Z',
  data: { title },
  cursor: `cursor-${eventId}`,
});

export const activeFrame = (truncated = false): McpServerEventStreamFrame => ({
  type: 'active',
  cursor: 'cursor-start',
  truncated,
});

export const eventFrame = (eventId: string, title: string): McpServerEventStreamFrame => ({
  type: 'event',
  occurrence: occurrence(eventId, title),
});

export const sseChunk = (frame: McpServerEventStreamFrame) => `data: ${JSON.stringify(frame)}\n\n`;
