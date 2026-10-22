import { MastraError } from '@mastra/core/error';
import type { Mastra } from '@mastra/core/mastra';
import type {
  MCP_SERVER_EVENT_ERROR_IDS,
  MCPServerBase as MastraMCPServerImplementation,
  MCPServerEventStreamFrame,
  MCPServerEventsInspector,
  MCPToolExecutionResultV2,
  ServerInfo,
} from '@mastra/core/mcp';
import { SERVER_ERROR_CODES } from '../error-codes';
import type { ServerErrorCode } from '../error-codes';
import { HTTPException } from '../http-exception';
import {
  mcpServerDetailPathParams,
  mcpServerToolPathParams,
  executeToolBodySchema,
  listMcpServersQuerySchema,
  getMcpServerDetailQuerySchema,
  listMcpServersResponseSchema,
  serverDetailSchema,
  mcpServerIdPathParams,
  listMcpServerToolsResponseSchema,
  mcpToolInfoSchema,
  executeToolResponseSchema,
  mcpServerResourcePathParams,
  readResourceBodySchema,
  readResourceResponseSchema,
  listResourcesResponseSchema,
  mcpServerEventPathParams,
  listMcpServerEventsResponseSchema,
  pollMcpServerEventBodySchema,
  pollMcpServerEventResponseSchema,
  streamMcpServerEventBodySchema,
  mcpServerEventStreamFrameSchema,
  emitMcpServerEventBodySchema,
  emitMcpServerEventResponseSchema,
} from '../schemas/mcp';
import type { MCPServerTransport } from '../schemas/mcp';
import type { ServerContext } from '../server-adapter';
import type { SetMcpRequestAuth } from '../server-adapter/mcp-auth';
import { createRoute } from '../server-adapter/routes/route-builder';
import { handleError } from './error';

// ============================================================================
// Route Definitions (createRoute pattern for server adapters)
// ============================================================================

/**
 * Only `@mastra/mcp` 1.x servers implement the standalone HTTP+SSE transport; on a
 * 2026-07-28 server the inherited `startSSE`/`startHonoSSE` throw.
 */
function hasSSETransport(server: MastraMCPServerImplementation): boolean {
  return server.mcpVersion !== 2;
}

export interface MCPServerInfoResponse extends ServerInfo {
  /** Endpoints served under `/mcp/:serverId`; 2026-07-28 servers speak Streamable HTTP only. */
  transports: MCPServerTransport[];
  events_capability?: boolean;
}

function transportsOf(server: MastraMCPServerImplementation): MCPServerTransport[] {
  return hasSSETransport(server) ? ['streamable-http', 'sse'] : ['streamable-http'];
}

export const LIST_MCP_SERVERS_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/v0/servers',
  responseType: 'json',
  queryParamSchema: listMcpServersQuerySchema,
  responseSchema: listMcpServersResponseSchema,
  summary: 'List MCP servers',
  description: 'Returns a list of registered MCP servers with pagination support',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({
    mastra,
    routePrefix,
    page,
    perPage,
    limit,
    offset,
  }: ServerContext & { page?: number; perPage?: number; limit?: number; offset?: number }) => {
    try {
      if (!mastra || typeof mastra.listMCPServers !== 'function') {
        throw new HTTPException(500, {
          message: 'Mastra instance or listMCPServers method not available',
          code: SERVER_ERROR_CODES.MCP_SERVERS_LIST_UNSUPPORTED,
        });
      }

      const servers = mastra.listMCPServers();

      if (!servers) {
        return { servers: [], total_count: 0, next: null };
      }

      const serverList = Object.values(servers);
      const totalCount = serverList.length;

      // Support both page/perPage and limit/offset for backwards compatibility
      // Detect which format user is using - prefer page/perPage if both provided
      const useLegacyFormat =
        (limit !== undefined || offset !== undefined) && page === undefined && perPage === undefined;

      // If perPage provided, use it; otherwise fall back to limit
      const finalPerPage = perPage ?? limit;
      // If page provided, use it; otherwise convert from offset
      let finalPage = page;
      if (finalPage === undefined && offset !== undefined && finalPerPage !== undefined && finalPerPage > 0) {
        finalPage = Math.floor(offset / finalPerPage);
      }

      // Calculate offset from page/perPage
      const actualOffset = finalPage !== undefined && finalPerPage !== undefined ? finalPage * finalPerPage : 0;

      // Apply pagination
      let paginatedServers = serverList;
      let nextUrl: string | null = null;

      if (finalPerPage !== undefined) {
        paginatedServers = serverList.slice(actualOffset, actualOffset + finalPerPage);

        // Calculate next URL if there are more results
        if (actualOffset + finalPerPage < totalCount) {
          const nextPage = (finalPage ?? 0) + 1;
          // Return next URL in same format as request (legacy limit/offset or page/perPage)
          const prefix = routePrefix ?? '';
          if (useLegacyFormat) {
            const nextOffset = actualOffset + finalPerPage;
            nextUrl = `${prefix}/mcp/v0/servers?limit=${finalPerPage}&offset=${nextOffset}`;
          } else {
            nextUrl = `${prefix}/mcp/v0/servers?perPage=${finalPerPage}&page=${nextPage}`;
          }
        }
      }

      // Get server info for each server
      const serverInfoList: MCPServerInfoResponse[] = paginatedServers.map(server => ({
        ...server.getServerInfo(),
        transports: transportsOf(server),
        ...eventsCapabilityOf(server),
      }));

      return {
        servers: serverInfoList,
        total_count: totalCount,
        next: nextUrl,
      };
    } catch (error) {
      return handleError(error, {
        message: 'Error listing MCP servers',
        code: SERVER_ERROR_CODES.MCP_SERVERS_LIST_FAILED,
      });
    }
  },
});

export const GET_MCP_SERVER_DETAIL_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/v0/servers/:id',
  responseType: 'json',
  pathParamSchema: mcpServerDetailPathParams,
  queryParamSchema: getMcpServerDetailQuerySchema,
  responseSchema: serverDetailSchema,
  summary: 'Get MCP server details',
  description: 'Returns detailed information about a specific MCP server',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, id, version }: ServerContext & { id: string; version?: string }) => {
    try {
      if (!mastra || typeof mastra.getMCPServerById !== 'function') {
        throw new HTTPException(500, {
          message: 'Mastra instance or getMCPServerById method not available',
          code: SERVER_ERROR_CODES.MCP_SERVER_LOOKUP_UNSUPPORTED,
        });
      }

      const server = mastra.getMCPServerById(id);

      if (!server) {
        throw new HTTPException(404, {
          message: `MCP server with ID '${id}' not found`,
          code: SERVER_ERROR_CODES.MCP_SERVER_NOT_FOUND,
          metadata: { serverId: id },
        });
      }

      const serverDetail = {
        ...server.getServerDetail(),
        transports: transportsOf(server),
        ...eventsCapabilityOf(server),
      };

      // If a specific version was requested, check if it matches
      if (version && serverDetail.version_detail.version !== version) {
        throw new HTTPException(404, {
          message: `MCP server with ID '${id}' found, but not version '${version}'. Available version: ${serverDetail.version_detail.version}`,
          code: SERVER_ERROR_CODES.MCP_SERVER_VERSION_NOT_FOUND,
          metadata: { serverId: id, version, availableVersion: serverDetail.version_detail.version },
        });
      }

      return serverDetail;
    } catch (error) {
      return handleError(error, {
        message: 'Error getting MCP server',
        code: SERVER_ERROR_CODES.MCP_SERVER_GET_FAILED,
      });
    }
  },
});

export const LIST_MCP_SERVER_TOOLS_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/:serverId/tools',
  responseType: 'json',
  pathParamSchema: mcpServerIdPathParams,
  responseSchema: listMcpServerToolsResponseSchema,
  summary: 'List MCP server tools',
  description: 'Returns a list of tools available on the specified MCP server',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId, requestContext }: ServerContext & { serverId: string }) => {
    try {
      if (!mastra || typeof mastra.getMCPServerById !== 'function') {
        throw new HTTPException(500, {
          message: 'Mastra instance or getMCPServerById method not available',
          code: SERVER_ERROR_CODES.MCP_SERVER_LOOKUP_UNSUPPORTED,
        });
      }

      const server = mastra.getMCPServerById(serverId);

      if (!server) {
        throw new HTTPException(404, {
          message: `MCP server with ID '${serverId}' not found`,
          code: SERVER_ERROR_CODES.MCP_SERVER_NOT_FOUND,
          metadata: { serverId },
        });
      }

      if (typeof server.getToolListInfo !== 'function') {
        throw new HTTPException(501, {
          message: `Server '${serverId}' cannot list tools in this way.`,
          code: SERVER_ERROR_CODES.MCP_TOOLS_UNSUPPORTED,
          metadata: { serverId },
        });
      }

      return await server.getToolListInfo(requestContext);
    } catch (error) {
      return handleError(error, {
        message: 'Error listing MCP server tools',
        code: SERVER_ERROR_CODES.MCP_SERVER_TOOLS_LIST_FAILED,
      });
    }
  },
});

export const GET_MCP_SERVER_TOOL_DETAIL_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/:serverId/tools/:toolId',
  responseType: 'json',
  pathParamSchema: mcpServerToolPathParams,
  responseSchema: mcpToolInfoSchema,
  summary: 'Get MCP server tool details',
  description: 'Returns detailed information about a specific tool on the MCP server',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId, toolId }: ServerContext & { serverId: string; toolId: string }) => {
    try {
      if (!mastra || typeof mastra.getMCPServerById !== 'function') {
        throw new HTTPException(500, {
          message: 'Mastra instance or getMCPServerById method not available',
          code: SERVER_ERROR_CODES.MCP_SERVER_LOOKUP_UNSUPPORTED,
        });
      }

      const server = mastra.getMCPServerById(serverId);

      if (!server) {
        throw new HTTPException(404, {
          message: `MCP server with ID '${serverId}' not found`,
          code: SERVER_ERROR_CODES.MCP_SERVER_NOT_FOUND,
          metadata: { serverId },
        });
      }

      if (typeof server.getToolInfo !== 'function') {
        throw new HTTPException(501, {
          message: `Server '${serverId}' cannot provide tool details in this way.`,
          code: SERVER_ERROR_CODES.MCP_TOOLS_UNSUPPORTED,
          metadata: { serverId },
        });
      }

      const toolInfo = await server.getToolInfo(toolId);
      if (!toolInfo) {
        throw new HTTPException(404, {
          message: `Tool with ID '${toolId}' not found on MCP server '${serverId}'`,
          code: SERVER_ERROR_CODES.MCP_TOOL_NOT_FOUND,
          metadata: { toolId, serverId },
        });
      }

      return toolInfo;
    } catch (error) {
      return handleError(error, {
        message: 'Error getting MCP server tool',
        code: SERVER_ERROR_CODES.MCP_SERVER_TOOL_GET_FAILED,
      });
    }
  },
});

export const EXECUTE_MCP_SERVER_TOOL_ROUTE = createRoute({
  method: 'POST',
  path: '/mcp/:serverId/tools/:toolId/execute',
  responseType: 'json',
  pathParamSchema: mcpServerToolPathParams,
  bodySchema: executeToolBodySchema,
  responseSchema: executeToolResponseSchema,
  summary: 'Execute MCP server tool',
  description: 'Executes a tool on the specified MCP server with the provided arguments',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({
    mastra,
    serverId,
    toolId,
    data,
    resumeData,
    suspendPayload,
    requestContext,
  }: ServerContext & {
    serverId: string;
    toolId: string;
    data?: unknown;
    resumeData?: unknown;
    suspendPayload?: unknown;
  }) => {
    try {
      if (!mastra || typeof mastra.getMCPServerById !== 'function') {
        throw new HTTPException(500, {
          message: 'Mastra instance or getMCPServerById method not available',
          code: SERVER_ERROR_CODES.MCP_SERVER_LOOKUP_UNSUPPORTED,
        });
      }

      const server = mastra.getMCPServerById(serverId);

      if (!server) {
        throw new HTTPException(404, {
          message: `MCP server with ID '${serverId}' not found`,
          code: SERVER_ERROR_CODES.MCP_SERVER_NOT_FOUND,
          metadata: { serverId },
        });
      }

      if (typeof server.executeTool !== 'function') {
        throw new HTTPException(501, {
          message: `Server '${serverId}' cannot execute tools in this way.`,
          code: SERVER_ERROR_CODES.MCP_TOOLS_UNSUPPORTED,
          metadata: { serverId },
        });
      }

      if (server.mcpVersion === 2) {
        // A 2026-07-28 server runs the tool with no protocol client attached: a tool
        // that suspends for input is reported as such instead of pretending it finished, and
        // the caller answers by sending the same args with `resumeData` and `suspendPayload`.
        let execution: MCPToolExecutionResultV2;
        try {
          execution = await server.executeTool(toolId, data, { requestContext, resumeData, suspendPayload });
        } catch (error) {
          if (error instanceof MastraError && error.id === 'MCP_SERVER_TOOL_INVALID_INPUT') {
            throw new HTTPException(400, {
              message: error.message,
              cause: error,
              code: SERVER_ERROR_CODES.MCP_TOOL_INPUT_INVALID,
              metadata: { serverId, toolId },
            });
          }
          throw error;
        }
        if (execution.status === 'suspended') {
          return {
            status: 'suspended' as const,
            suspendPayload: execution.suspendPayload,
            resumeSchema: execution.resumeSchema,
          };
        }
        return { result: execution.output };
      }

      const result = await server.executeTool(toolId, data, { requestContext });
      return { result };
    } catch (error) {
      return handleError(error, {
        message: 'Error executing MCP server tool',
        code: SERVER_ERROR_CODES.MCP_SERVER_TOOL_EXECUTE_FAILED,
      });
    }
  },
});

// ============================================================================
// MCP Resource Routes
// ============================================================================

export const LIST_MCP_SERVER_RESOURCES_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/:serverId/resources',
  responseType: 'json',
  pathParamSchema: mcpServerResourcePathParams,
  responseSchema: listResourcesResponseSchema,
  summary: 'List MCP server resources',
  description: 'Returns a list of resources available on the MCP server, including ui:// app resources',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId }: ServerContext & { serverId: string }) => {
    try {
      if (!mastra || typeof mastra.getMCPServerById !== 'function') {
        throw new HTTPException(500, {
          message: 'Mastra instance or getMCPServerById method not available',
          code: SERVER_ERROR_CODES.MCP_SERVER_LOOKUP_UNSUPPORTED,
        });
      }

      const server = mastra.getMCPServerById(serverId);

      if (!server) {
        throw new HTTPException(404, {
          message: `MCP server with ID '${serverId}' not found`,
          code: SERVER_ERROR_CODES.MCP_SERVER_NOT_FOUND,
          metadata: { serverId },
        });
      }

      if (typeof server.listResources !== 'function') {
        return { resources: [] };
      }

      return server.listResources();
    } catch (error) {
      return handleError(error, {
        message: 'Error listing MCP server resources',
        code: SERVER_ERROR_CODES.MCP_SERVER_RESOURCES_LIST_FAILED,
      });
    }
  },
});

export const READ_MCP_SERVER_RESOURCE_ROUTE = createRoute({
  method: 'POST',
  path: '/mcp/:serverId/resources/read',
  responseType: 'json',
  pathParamSchema: mcpServerResourcePathParams,
  bodySchema: readResourceBodySchema,
  responseSchema: readResourceResponseSchema,
  summary: 'Read MCP server resource content',
  description: 'Reads the content of a resource by URI, used for rendering MCP App ui:// resources',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId, uri }: ServerContext & { serverId: string; uri: string }) => {
    try {
      if (!mastra || typeof mastra.getMCPServerById !== 'function') {
        throw new HTTPException(500, {
          message: 'Mastra instance or getMCPServerById method not available',
          code: SERVER_ERROR_CODES.MCP_SERVER_LOOKUP_UNSUPPORTED,
        });
      }

      const server = mastra.getMCPServerById(serverId);

      if (!server) {
        throw new HTTPException(404, {
          message: `MCP server with ID '${serverId}' not found`,
          code: SERVER_ERROR_CODES.MCP_SERVER_NOT_FOUND,
          metadata: { serverId },
        });
      }

      if (typeof server.readResource !== 'function') {
        throw new HTTPException(501, {
          message: `Server '${serverId}' does not support reading resources`,
          code: SERVER_ERROR_CODES.MCP_RESOURCES_UNSUPPORTED,
          metadata: { serverId },
        });
      }

      try {
        return await server.readResource(uri);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('not found') || message.includes('not configured')) {
          throw new HTTPException(404, {
            message: `Resource '${uri}' not found on server '${serverId}'`,
            code: SERVER_ERROR_CODES.MCP_RESOURCE_NOT_FOUND,
            metadata: { uri, serverId },
          });
        }
        throw error;
      }
    } catch (error) {
      return handleError(error, {
        message: 'Error reading MCP server resource',
        code: SERVER_ERROR_CODES.MCP_SERVER_RESOURCE_READ_FAILED,
      });
    }
  },
});

// ============================================================================
// MCP Event Routes (experimental; used by Studio)
// ============================================================================

/** Present only for servers that declare event types, so older responses stay unchanged. */
function eventsCapabilityOf(server: MastraMCPServerImplementation): { events_capability?: true } {
  const events = typeof server.getEventsInfo === 'function' ? server.getEventsInfo()?.events : undefined;
  return events && events.length > 0 ? { events_capability: true } : {};
}

function isTestEmitEnabled(): boolean {
  return process.env.MASTRA_DEV === 'true';
}

function getEventsServer(mastra: Mastra | undefined, serverId: string): MastraMCPServerImplementation {
  if (!mastra || typeof mastra.getMCPServerById !== 'function') {
    throw new HTTPException(500, {
      message: 'Mastra instance or getMCPServerById method not available',
      code: SERVER_ERROR_CODES.MCP_SERVER_LOOKUP_UNSUPPORTED,
    });
  }
  let server: MastraMCPServerImplementation | undefined;
  try {
    server = mastra.getMCPServerById(serverId);
  } catch (error) {
    return handleError(error, { message: 'Error getting MCP server', code: SERVER_ERROR_CODES.MCP_SERVER_GET_FAILED });
  }
  if (!server) {
    throw new HTTPException(404, {
      message: `MCP server with ID '${serverId}' not found`,
      code: SERVER_ERROR_CODES.MCP_SERVER_NOT_FOUND,
      metadata: { serverId },
    });
  }
  return server;
}

function getEventsInspector(server: MastraMCPServerImplementation): MCPServerEventsInspector {
  const inspector = typeof server.getEventsInspector === 'function' ? server.getEventsInspector() : undefined;
  if (!inspector) {
    throw new HTTPException(404, { message: 'Event not found', code: SERVER_ERROR_CODES.MCP_EVENT_NOT_FOUND });
  }
  return inspector;
}

type EventErrorId = (typeof MCP_SERVER_EVENT_ERROR_IDS)[keyof typeof MCP_SERVER_EVENT_ERROR_IDS];

// Keyed by the literal ids rather than the core constant, so @mastra/server still
// runs against a @mastra/core release that doesn't export MCP_SERVER_EVENT_ERROR_IDS.
// The record type keeps the ids in sync with core at compile time.
const EVENT_ERROR_RESPONSES: Record<
  EventErrorId,
  { status: 400 | 403 | 404 | 429; message: string; code: ServerErrorCode }
> = {
  MCP_SERVER_UNKNOWN_EVENT: { status: 404, message: 'Event not found', code: SERVER_ERROR_CODES.MCP_EVENT_NOT_FOUND },
  MCP_SERVER_EVENT_UNSUPPORTED_DELIVERY: {
    status: 400,
    message: 'This event does not support streaming; poll it instead',
    code: SERVER_ERROR_CODES.MCP_EVENT_DELIVERY_UNSUPPORTED,
  },
  MCP_SERVER_EVENT_INVALID_ARGUMENTS: {
    status: 400,
    message: 'Invalid event arguments',
    code: SERVER_ERROR_CODES.MCP_EVENT_ARGUMENTS_INVALID,
  },
  MCP_SERVER_EVENT_NOT_EMITTABLE: {
    status: 400,
    message: 'This event is fed by a poll source and cannot be emitted',
    code: SERVER_ERROR_CODES.MCP_EVENT_NOT_EMITTABLE,
  },
  MCP_SERVER_EVENT_INVALID_PAYLOAD: {
    status: 400,
    message: 'Invalid event data',
    code: SERVER_ERROR_CODES.MCP_EVENT_PAYLOAD_INVALID,
  },
  MCP_SERVER_EVENT_FORBIDDEN: {
    status: 403,
    message: 'Not allowed to use this event',
    code: SERVER_ERROR_CODES.MCP_EVENT_ACCESS_DENIED,
  },
  MCP_SERVER_EVENT_TOO_MANY_STREAMS: {
    status: 429,
    message: 'Too many open event streams',
    code: SERVER_ERROR_CODES.MCP_EVENT_STREAMS_LIMIT_EXCEEDED,
  },
};

/**
 * Maps event errors to generic HTTP errors. The details (which can come from a poll
 * source or an upstream API) are only logged, never returned.
 */
function toEventsHttpError(error: unknown, mastra: Mastra | undefined, context: string): HTTPException {
  if (error instanceof HTTPException) return error;
  const known = error instanceof MastraError ? EVENT_ERROR_RESPONSES[error.id as EventErrorId] : undefined;
  if (known) return new HTTPException(known.status, { message: known.message, code: known.code });
  mastra?.getLogger()?.error(`MCP event request failed: ${context}`, { error });
  return new HTTPException(500, { message: 'Event request failed', code: SERVER_ERROR_CODES.MCP_EVENT_REQUEST_FAILED });
}

export const LIST_MCP_SERVER_EVENTS_ROUTE = createRoute({
  method: 'GET',
  path: '/mcp/:serverId/events',
  responseType: 'json',
  pathParamSchema: mcpServerIdPathParams,
  responseSchema: listMcpServerEventsResponseSchema,
  summary: 'List MCP server events',
  description: 'Returns the event types the MCP server declares (experimental)',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId }: ServerContext & { serverId: string }) => {
    const server = getEventsServer(mastra, serverId);
    const events = typeof server.getEventsInfo === 'function' ? (server.getEventsInfo()?.events ?? []) : [];
    return { events, testEmit: isTestEmitEnabled() };
  },
});

export const POLL_MCP_SERVER_EVENT_ROUTE = createRoute({
  method: 'POST',
  path: '/mcp/:serverId/events/:eventName/poll',
  responseType: 'json',
  pathParamSchema: mcpServerEventPathParams,
  bodySchema: pollMcpServerEventBodySchema,
  responseSchema: pollMcpServerEventResponseSchema,
  summary: 'Poll an MCP server event',
  description: 'Reads occurrences of an event type, like the events/poll MCP request (experimental)',
  tags: ['MCP'],
  requiresAuth: true,
  // Same permission as streaming: both read occurrences through the event's source.
  requiresPermission: 'mcp:execute',
  handler: async ({
    mastra,
    serverId,
    eventName,
    arguments: args,
    cursor,
    maxEvents,
    requestContext,
    abortSignal,
  }: ServerContext & {
    serverId: string;
    eventName: string;
    arguments?: Record<string, unknown>;
    cursor?: string | null;
    maxEvents?: number;
  }) => {
    const inspector = getEventsInspector(getEventsServer(mastra, serverId));
    try {
      return await inspector.poll(
        eventName,
        { arguments: args, cursor, maxEvents },
        { requestContext, signal: abortSignal },
      );
    } catch (error) {
      throw toEventsHttpError(error, mastra, `poll ${serverId}/${eventName}`);
    }
  },
});

export const STREAM_MCP_SERVER_EVENT_ROUTE = createRoute({
  method: 'POST',
  path: '/mcp/:serverId/events/:eventName/stream',
  responseType: 'stream' as const,
  streamFormat: 'sse' as const,
  sseFlushOnConnect: true,
  pathParamSchema: mcpServerEventPathParams,
  bodySchema: streamMcpServerEventBodySchema,
  responseSchema: mcpServerEventStreamFrameSchema,
  summary: 'Stream an MCP server event',
  description:
    'Streams occurrences of an event type as server-sent events, like the events/stream MCP request (experimental)',
  tags: ['MCP', 'Streaming'],
  requiresAuth: true,
  handler: async ({
    mastra,
    serverId,
    eventName,
    arguments: args,
    cursor,
    requestContext,
    abortSignal,
  }: ServerContext & {
    serverId: string;
    eventName: string;
    arguments?: Record<string, unknown>;
    cursor?: string | null;
  }) => {
    const inspector = getEventsInspector(getEventsServer(mastra, serverId));
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (abortSignal?.aborted) abort();
    else abortSignal?.addEventListener('abort', abort, { once: true });

    // Frames sent before the stream's `start` runs are buffered here.
    const buffered: MCPServerEventStreamFrame[] = [];
    let sink: ReadableStreamDefaultController<MCPServerEventStreamFrame> | undefined;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      abortSignal?.removeEventListener('abort', abort);
      abort();
      try {
        sink?.close();
      } catch {
        // Already closed or cancelled by the client.
      }
    };

    let closed: Promise<void>;
    try {
      ({ closed } = await inspector.stream(
        eventName,
        { arguments: args, cursor },
        {
          signal: controller.signal,
          requestContext,
          onFrame: frame => {
            if (done) return;
            if (sink) sink.enqueue(frame);
            else buffered.push(frame);
            if (frame.type === 'terminated') finish();
          },
        },
      ));
    } catch (error) {
      finish();
      throw toEventsHttpError(error, mastra, `stream ${serverId}/${eventName}`);
    }
    void closed.then(finish);

    return new ReadableStream<MCPServerEventStreamFrame>({
      start(streamController) {
        if (done) {
          for (const frame of buffered.splice(0)) streamController.enqueue(frame);
          streamController.close();
          return;
        }
        sink = streamController;
        for (const frame of buffered.splice(0)) streamController.enqueue(frame);
      },
      cancel() {
        finish();
      },
    });
  },
});

export const EMIT_MCP_SERVER_EVENT_ROUTE = createRoute({
  method: 'POST',
  path: '/mcp/:serverId/events/:eventName/emit',
  responseType: 'json',
  pathParamSchema: mcpServerEventPathParams,
  bodySchema: emitMcpServerEventBodySchema,
  responseSchema: emitMcpServerEventResponseSchema,
  summary: 'Send a test MCP server event',
  description:
    'Emits a test occurrence of an emit-fed event type. Only served under `mastra dev`; otherwise 404 (experimental)',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({
    mastra,
    serverId,
    eventName,
    data,
  }: ServerContext & { serverId: string; eventName: string; data: Record<string, unknown> }) => {
    if (!isTestEmitEnabled()) {
      throw new HTTPException(404, { message: 'Not Found', code: SERVER_ERROR_CODES.ROUTE_NOT_FOUND });
    }
    const inspector = getEventsInspector(getEventsServer(mastra, serverId));
    try {
      return { occurrence: await inspector.emit(eventName, data) };
    } catch (error) {
      throw toEventsHttpError(error, mastra, `emit ${serverId}/${eventName}`);
    }
  },
});

// ============================================================================
// MCP Transport Routes (Streamable HTTP and SSE)
// ============================================================================

/**
 * MCP transport options that can be passed to startHTTP() or startSSE().
 * Includes serverless mode for running in stateless environments like Cloudflare Workers or Vercel Edge.
 */
export interface MCPTransportOptions {
  /**
   * When true, runs in stateless mode without session management.
   * Ideal for serverless environments where you can't maintain persistent connections.
   */
  serverless?: boolean;
  /**
   * Custom session ID generator function.
   */
  sessionIdGenerator?: () => string;
  /**
   * Sets `req.auth` before the MCP transport reads it. Overrides the default
   * bridge that forwards the principal resolved by `server.auth`.
   */
  setRequestAuth?: SetMcpRequestAuth;
}

/**
 * MCP HTTP Transport response type.
 * Adapters use this to set up the HTTP transport via MCPServer.startHTTP()
 */
export interface MCPHttpTransportResult {
  server: MastraMCPServerImplementation;
  httpPath: string;
  /**
   * Optional MCP transport options for this specific route.
   * These override any class-level mcpOptions configured on the adapter.
   */
  mcpOptions?: MCPTransportOptions;
}

/**
 * MCP SSE Transport response type.
 * Adapters use this to set up the SSE transport via MCPServer.startSSE() or startHonoSSE()
 *
 * Note: SSE transport is inherently stateful and doesn't support serverless mode.
 */
export interface MCPSseTransportResult {
  /** A 1.x server: the SSE route only resolves servers that still implement the transport. */
  server: MastraMCPServerImplementation;
  ssePath: string;
  messagePath: string;
}

export const MCP_HTTP_TRANSPORT_ROUTE = createRoute({
  method: 'ALL',
  path: '/mcp/:serverId/mcp',
  responseType: 'mcp-http',
  pathParamSchema: mcpServerIdPathParams,
  summary: 'MCP HTTP Transport',
  description: 'Streamable HTTP transport endpoint for MCP protocol communication',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId }: ServerContext & { serverId: string }): Promise<MCPHttpTransportResult> => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, {
        message: 'Mastra instance or getMCPServerById method not available',
        code: SERVER_ERROR_CODES.MCP_SERVER_LOOKUP_UNSUPPORTED,
      });
    }

    const server = mastra.getMCPServerById(serverId);

    if (!server) {
      throw new HTTPException(404, {
        message: `MCP server '${serverId}' not found`,
        code: SERVER_ERROR_CODES.MCP_SERVER_NOT_FOUND,
        metadata: { serverId },
      });
    }

    return {
      server,
      httpPath: `/mcp/${serverId}/mcp`,
    };
  },
});

export const MCP_SSE_TRANSPORT_ROUTE = createRoute({
  method: 'ALL',
  path: '/mcp/:serverId/sse',
  responseType: 'mcp-sse',
  pathParamSchema: mcpServerIdPathParams,
  summary: 'MCP SSE Transport',
  description: 'SSE transport endpoint for MCP protocol communication',
  tags: ['MCP'],
  requiresAuth: true,
  handler: async ({ mastra, serverId }: ServerContext & { serverId: string }): Promise<MCPSseTransportResult> => {
    if (!mastra || typeof mastra.getMCPServerById !== 'function') {
      throw new HTTPException(500, {
        message: 'Mastra instance or getMCPServerById method not available',
        code: SERVER_ERROR_CODES.MCP_SERVER_LOOKUP_UNSUPPORTED,
      });
    }

    const server = mastra.getMCPServerById(serverId);

    if (!server) {
      throw new HTTPException(404, {
        message: `MCP server '${serverId}' not found`,
        code: SERVER_ERROR_CODES.MCP_SERVER_NOT_FOUND,
        metadata: { serverId },
      });
    }

    if (!hasSSETransport(server)) {
      throw new HTTPException(404, {
        message: 'Legacy SSE transport is unavailable for MCP v2 servers',
        code: SERVER_ERROR_CODES.MCP_SSE_TRANSPORT_UNAVAILABLE,
      });
    }

    return {
      server,
      ssePath: `/mcp/${serverId}/sse`,
      messagePath: `/mcp/${serverId}/messages`,
    };
  },
});

export const MCP_SSE_MESSAGES_ROUTE = createRoute({
  method: 'POST',
  path: '/mcp/:serverId/messages',
  responseType: 'mcp-sse',
  pathParamSchema: mcpServerIdPathParams,
  summary: 'MCP SSE Messages',
  description: 'Message endpoint for SSE transport (posts messages to active SSE streams)',
  tags: ['MCP'],
  requiresAuth: true,
  handler: MCP_SSE_TRANSPORT_ROUTE.handler,
});
