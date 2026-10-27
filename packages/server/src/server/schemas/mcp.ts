import { z } from 'zod/v4';
import { createCombinedPaginationSchema } from './common';

// Path parameters
export const mcpServerIdPathParams = z.object({
  serverId: z.string().describe('MCP server ID'),
});

export const mcpServerDetailPathParams = z.object({
  id: z.string().describe('MCP server ID'),
});

export const mcpServerToolPathParams = z.object({
  serverId: z.string().describe('MCP server ID'),
  toolId: z.string().describe('Tool ID'),
});

export const executeToolBodySchema = z.object({
  data: z.unknown().optional(),
  resumeData: z
    .unknown()
    .optional()
    .describe('Answer for a tool that reported `status: "suspended"`; 2026-07-28 servers only'),
  suspendPayload: z
    .unknown()
    .optional()
    .describe('The `suspendPayload` from the suspended response, echoed back with `resumeData`'),
});

// Query parameters
// Supports both page/perPage and limit/offset for backwards compatibility
export const listMcpServersQuerySchema = createCombinedPaginationSchema();

export const getMcpServerDetailQuerySchema = z.object({
  version: z.string().optional(),
});

// Response schemas
export const versionDetailSchema = z.object({
  version: z.string(),
  release_date: z.string(),
  is_latest: z.boolean(),
});

export const mcpServerTransportSchema = z.enum(['streamable-http', 'sse']);

/** Protocol transports the Studio/REST API exposes for a registered MCP server. */
export type MCPServerTransport = z.infer<typeof mcpServerTransportSchema>;

export const serverInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  version_detail: versionDetailSchema,
  /** Omitted by servers that predate transport reporting; treat absence as `['streamable-http', 'sse']`. */
  transports: z.array(mcpServerTransportSchema).optional(),
  /** Whether the server declares event types (experimental); see `GET /mcp/:serverId/events`. */
  events_capability: z.boolean().optional(),
  tasks_capability: z.boolean().optional(),
});

export const listMcpServersResponseSchema = z.object({
  servers: z.array(serverInfoSchema),
  total_count: z.number(),
  next: z.string().nullable(),
});

export const serverDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  version_detail: versionDetailSchema,
  package_canonical: z.string().optional(),
  packages: z.array(z.unknown()).optional(),
  remotes: z.array(z.unknown()).optional(),
  /** Omitted by servers that predate transport reporting; treat absence as `['streamable-http', 'sse']`. */
  transports: z.array(mcpServerTransportSchema).optional(),
  /** Whether the server declares event types (experimental); see `GET /mcp/:serverId/events`. */
  events_capability: z.boolean().optional(),
  tasks_capability: z.boolean().optional(),
});

// Tool schemas
export const mcpToolInfoSchema = z.object({
  /** Tool id as registered on the server; present when the MCP server reports it. */
  id: z.string().optional(),
  name: z.string(),
  description: z.string().optional(),
  inputSchema: z.unknown(),
  outputSchema: z.unknown().optional(),
  toolType: z.string().optional(),
  _meta: z.record(z.string(), z.unknown()).optional(),
});

export const listMcpServerToolsResponseSchema = z.object({
  tools: z.array(mcpToolInfoSchema),
});

export const executeToolResponseSchema = z.union([
  z.object({
    result: z.unknown(),
  }),
  z.object({
    status: z.literal('suspended').describe('The tool paused and asked for input; it did not complete'),
    suspendPayload: z.unknown().describe('What the tool suspended with'),
    resumeSchema: z.unknown().optional().describe('JSON Schema of the input the tool needs to resume'),
  }),
]);

// Resource schemas
export const mcpServerResourcePathParams = z.object({
  serverId: z.string().describe('MCP server ID'),
});

export const readResourceBodySchema = z.object({
  uri: z.string().describe('Resource URI to read'),
});

export const resourceContentSchema = z.object({
  uri: z.string(),
  text: z.string().optional(),
  blob: z.string().optional(),
  mimeType: z.string().optional(),
  _meta: z.record(z.string(), z.unknown()).optional(),
});

export const readResourceResponseSchema = z.object({
  contents: z.array(resourceContentSchema),
});

export const resourceInfoSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  _meta: z.record(z.string(), z.unknown()).optional(),
});

export const listResourcesResponseSchema = z.object({
  resources: z.array(resourceInfoSchema),
});

// JSON-RPC error response schema
export const jsonRpcErrorSchema = z.object({
  jsonrpc: z.literal('2.0'),
  error: z.object({
    code: z.number(),
    message: z.string(),
  }),
  id: z.null(),
});

// Event schemas (experimental)
export const mcpServerEventPathParams = z.object({
  serverId: z.string().describe('MCP server ID'),
  eventName: z.string().describe('Event type name'),
});

const jsonObjectSchema = z.record(z.string(), z.unknown());
const eventCursorSchema = z.string().nullable();

export const mcpServerEventInfoSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  delivery: z.array(z.enum(['push', 'poll', 'webhook'])),
  inputSchema: jsonObjectSchema.optional(),
  payloadSchema: jsonObjectSchema.optional(),
  /** Fed by `server.events.emit()`, so it can receive test events. */
  emittable: z.boolean(),
});

export const listMcpServerEventsResponseSchema = z.object({
  events: z.array(mcpServerEventInfoSchema),
  /** Whether `POST /mcp/:serverId/events/:eventName/emit` is served (only under `mastra dev`). */
  testEmit: z.boolean(),
});

export const mcpServerEventOccurrenceSchema = z.object({
  eventId: z.string(),
  name: z.string(),
  timestamp: z.string(),
  data: jsonObjectSchema,
  cursor: eventCursorSchema.optional(),
  _meta: jsonObjectSchema.optional(),
});

export const pollMcpServerEventBodySchema = z.object({
  arguments: jsonObjectSchema.optional(),
  cursor: eventCursorSchema.optional(),
  maxEvents: z.number().int().min(1).max(1000).optional(),
});

export const pollMcpServerEventResponseSchema = z.object({
  events: z.array(mcpServerEventOccurrenceSchema),
  cursor: eventCursorSchema,
  hasMore: z.boolean().optional(),
  truncated: z.boolean().optional(),
  nextPollMs: z.number().optional(),
});

export const streamMcpServerEventBodySchema = z.object({
  arguments: jsonObjectSchema.optional(),
  cursor: eventCursorSchema.optional(),
});

/** One SSE frame of `POST /mcp/:serverId/events/:eventName/stream`. */
export const mcpServerEventStreamFrameSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('active'), cursor: eventCursorSchema, truncated: z.boolean() }),
  z.object({ type: z.literal('event'), occurrence: mcpServerEventOccurrenceSchema }),
  z.object({ type: z.literal('heartbeat'), cursor: eventCursorSchema }),
  z.object({ type: z.literal('error'), message: z.string() }),
  z.object({ type: z.literal('terminated') }),
]);

export const emitMcpServerEventBodySchema = z.object({
  data: jsonObjectSchema,
});

export const emitMcpServerEventResponseSchema = z.object({
  occurrence: mcpServerEventOccurrenceSchema,
});

// Task schemas (experimental; Studio admin view)
export const mcpServerTaskPathParams = z.object({
  serverId: z.string().describe('MCP server ID'),
  taskKey: z.string().describe('Task key (a hash of the task id, as listed)'),
});

/** Tasks listed when the caller doesn't ask for a number. */
export const DEFAULT_MCP_SERVER_TASKS_LIMIT = 50;

const mcpServerTaskStatusSchema = z.enum(['working', 'input_required', 'completed', 'failed', 'cancelled']);

export const listMcpServerTasksQuerySchema = z.object({
  /** How many of the most recent tasks to list; defaults to 50, at most 200. */
  limit: z.coerce.number().int().min(1).max(200).optional(),
  /** `nextCursor` of the previous page. */
  cursor: z.string().min(1).optional(),
  status: mcpServerTaskStatusSchema.optional(),
  /** The tool, workflow or agent name. */
  surface: z.string().min(1).optional(),
  /** A client key (`principalKey`) as listed. */
  client: z.string().min(1).optional(),
  /** A task key as listed, to read one task. */
  key: z.string().min(1).optional(),
});

/** The raw MCP task id goes in the body so it never lands in URLs or access logs. */
export const findMcpServerTaskBodySchema = z.object({
  taskId: z.string().min(1).max(512),
});

export const mcpServerTaskSurfaceSchema = z.object({
  name: z.string(),
  type: z.enum(['tool', 'workflow', 'agent']),
  mode: z.enum(['auto', 'always']),
  recover: z.boolean(),
  /** Clients that don't declare the tasks extension are refused for this surface. */
  required: z.boolean(),
  ttlMs: z.number().nullable(),
});

export const mcpServerTaskSummarySchema = z.object({
  taskKey: z.string(),
  surface: z.string(),
  status: mcpServerTaskStatusSchema,
  statusMessage: z.string().optional(),
  createdAt: z.string(),
  lastUpdatedAt: z.string(),
  expiresAt: z.string().optional(),
  principalKey: z.string(),
  inputRequests: z
    .record(z.string(), z.object({ method: z.string(), params: jsonObjectSchema.optional() }).passthrough())
    .optional(),
  result: jsonObjectSchema.optional(),
  error: jsonObjectSchema.optional(),
});

export const listMcpServerTasksResponseSchema = z.object({
  surfaces: z.array(mcpServerTaskSurfaceSchema),
  /**
   * Why `tasks` is empty regardless of what exists: the task store can't be listed, or the
   * caller is scoped to a resource, which has no mapping to MCP principals.
   */
  unavailable: z.enum(['not_listable', 'resource_scoped']).optional(),
  /** The most recent matching tasks first, at most `limit`. */
  tasks: z.array(mcpServerTaskSummarySchema),
  /** Pass as `cursor` for the next page; absent when no older task matches. */
  nextCursor: z.string().optional(),
});

export const findMcpServerTaskResponseSchema = z.object({ task: mcpServerTaskSummarySchema });

export const answerMcpServerTaskBodySchema = z.object({
  inputResponses: z.record(z.string(), jsonObjectSchema),
});

export const mcpServerTaskActionResponseSchema = z.object({ success: z.literal(true) });
