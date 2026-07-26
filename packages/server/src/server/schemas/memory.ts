import { z } from 'zod/v4';
import { paginationInfoSchema, createPagePaginationSchema, successResponseSchema } from './common';

// Path parameter schemas
export const threadIdPathParams = z.object({
  threadId: z.string().describe('Unique identifier for the conversation thread'),
});

/**
 * Common query parameter: required agent ID
 */
export const agentIdQuerySchema = z.object({
  agentId: z.string(),
});

/**
 * Common query parameter: optional agent ID
 * Used for read operations that can fall back to storage when agentId is not provided
 */
export const optionalAgentIdQuerySchema = z.object({
  agentId: z.string().optional(),
});

/**
 * Storage order by configuration for threads and agents (have both createdAt and updatedAt)
 * Handles JSON parsing from query strings.
 *
 * The inner object is wrapped in `.optional()` so the preprocess can yield
 * `undefined` (e.g. when a legacy client sends a bare string like
 * `?orderBy=updatedAt`) without tripping a "expected object, received undefined"
 * Zod error. Without that inner `.optional()`, valid optional query usage
 * regresses into a hard 400.
 */
const storageOrderBySchema = z
  .preprocess(
    val => {
      if (val === undefined) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return undefined;
        }
      }
      return val;
    },
    z
      .object({
        field: z.enum(['createdAt', 'updatedAt']).optional(),
        direction: z.enum(['ASC', 'DESC']).optional(),
      })
      .optional(),
  )
  .optional();

/**
 * Storage order by configuration for messages (only have createdAt)
 * Handles JSON parsing from query strings. See `storageOrderBySchema` for why
 * the inner object schema is also `.optional()`.
 */
const messageOrderBySchema = z
  .preprocess(
    val => {
      if (val === undefined) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return undefined;
        }
      }
      return val;
    },
    z
      .object({
        field: z.enum(['createdAt']).optional(),
        direction: z.enum(['ASC', 'DESC']).optional(),
      })
      .optional(),
  )
  .optional();

/**
 * Include schema for message listing - handles JSON parsing from query strings
 */
const includeSchema = z
  .preprocess(
    val => {
      if (val === undefined) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          // Return invalid string to fail validation (z.array will reject string type)
          return val;
        }
      }
      return val;
    },
    z.array(
      z.object({
        id: z.string(),
        threadId: z.string().optional(),
        withPreviousMessages: z.number().optional(),
        withNextMessages: z.number().optional(),
      }),
    ),
  )
  .optional();

/**
 * Filter schema for message listing - handles JSON parsing from query strings
 */
const filterSchema = z
  .preprocess(
    val => {
      if (val === undefined) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          // Return invalid string to fail validation (z.object will reject string type)
          return val;
        }
      }
      return val;
    },
    z.object({
      dateRange: z
        .object({
          start: z.coerce.date().optional(),
          end: z.coerce.date().optional(),
          startExclusive: z.boolean().optional(),
          endExclusive: z.boolean().optional(),
        })
        .optional(),
      roles: z.array(z.string()).optional(),
    }),
  )
  .optional();

/**
 * Memory config schema - handles JSON parsing from query strings
 */
const memoryConfigSchema = z
  .preprocess(
    val => {
      if (val === undefined) return val;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          // Return invalid string to fail validation (z.record will reject string type)
          return val;
        }
      }
      return val;
    },
    z.record(z.string(), z.unknown()),
  )
  .optional();

/**
 * Thread object structure
 */
const threadSchema = z.object({
  id: z.string(),
  title: z.string().optional(),
  resourceId: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Message structure for storage
 * Extends coreMessageSchema with storage-specific fields
 */
const messageSchema = z.unknown();
// const messageSchema = coreMessageSchema.extend({
//   id: z.string(),
//   createdAt: z.coerce.date(),
//   threadId: z.string().optional(),
//   resourceId: z.string().optional(),
// });

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * GET /api/memory/status
 * Includes optional resourceId and threadId for OM status lookup
 */
export const getMemoryStatusQuerySchema = agentIdQuerySchema.extend({
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
});

/**
 * GET /memory/config
 */
export const getMemoryConfigQuerySchema = agentIdQuerySchema;

/**
 * Inner schema for GET /memory/threads. The outer `listThreadsQuerySchema`
 * wraps this with a back-compat preprocess (see below) that rewrites the
 * legacy `?orderBy=<field>&sortDirection=<dir>` shape — emitted by
 * `@mastra/client-js` < 1.18 (e.g. mobile clients pinned to 1.4.x) — into the
 * current `{ orderBy: { field, direction } }` object shape.
 */
const listThreadsQueryInnerSchema = createPagePaginationSchema(100).extend({
  agentId: z.string().optional(),
  resourceId: z.string().optional(),
  metadata: z
    .preprocess(
      val => {
        if (val === undefined) return val;
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            // Return invalid string to fail validation (z.record will reject string type)
            return val;
          }
        }
        return val;
      },
      z.record(z.string(), z.unknown()),
    )
    .optional(),
  orderBy: storageOrderBySchema,
});

/**
 * GET /memory/threads
 * agentId is optional - can use storage fallback when not provided
 * resourceId is optional - when omitted, returns all threads
 * metadata is optional - filters threads by metadata key-value pairs (AND logic)
 *
 * Accepts both the current shape (`orderBy[field]=...&orderBy[direction]=...`)
 * and the legacy shape used by `@mastra/client-js` < 1.18
 * (`orderBy=<field>&sortDirection=<dir>`). The legacy shape is fused into the
 * current shape before schema validation, so existing pinned clients continue
 * to work without server-side breakage.
 */
export const listThreadsQuerySchema = z.preprocess(val => {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) return val;
  const record = val as Record<string, unknown>;
  const rawOrderBy = record.orderBy;
  // Only rewrite the legacy bare-string shape. Object / bracket-notation /
  // JSON-stringified orderBy is left alone and handled by storageOrderBySchema.
  if (typeof rawOrderBy !== 'string') return val;
  // A JSON-stringified object is the current "stringified" shape, not legacy —
  // let storageOrderBySchema's preprocess parse it.
  const trimmed = rawOrderBy.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) return val;
  // Legacy shape detected: fuse into `{ field, direction }`.
  const direction = typeof record.sortDirection === 'string' ? record.sortDirection : undefined;
  const { sortDirection: _legacyDir, ...rest } = record;
  return {
    ...rest,
    orderBy: {
      field: rawOrderBy,
      ...(direction !== undefined ? { direction } : {}),
    },
  };
}, listThreadsQueryInnerSchema);

/**
 * GET /memory/threads/:threadId
 * agentId is optional - can use storage fallback when not provided
 * resourceId is optional - used for ownership validation fallback when not set via middleware
 */
export const getThreadByIdQuerySchema = optionalAgentIdQuerySchema.extend({
  resourceId: z.string().optional(),
});

/**
 * GET /memory/threads/:threadId/messages
 * agentId is optional - can use storage fallback when not provided
 */
export const listMessagesQuerySchema = createPagePaginationSchema(40).extend({
  agentId: z.string().optional(),
  resourceId: z.string().optional(),
  orderBy: messageOrderBySchema,
  include: includeSchema,
  filter: filterSchema,
  includeSystemReminders: z
    .preprocess(val => {
      if (val === undefined) return val;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return val;
    }, z.boolean())
    .optional(),
});

/**
 * GET /memory/threads/:threadId/working-memory
 */
export const getWorkingMemoryQuerySchema = z.object({
  agentId: z.string(),
  resourceId: z.string().optional(),
  memoryConfig: memoryConfigSchema,
});

/**
 * DELETE /memory/threads/:threadId
 * agentId is required
 * resourceId is optional - used for ownership validation fallback when not set via middleware
 */
export const deleteThreadQuerySchema = agentIdQuerySchema.extend({
  resourceId: z.string().optional(),
});

/**
 * POST /memory/messages/delete
 * agentId is required
 * resourceId is optional - used for ownership validation fallback when not set via middleware
 */
export const deleteMessagesQuerySchema = agentIdQuerySchema.extend({
  resourceId: z.string().optional(),
});

// ============================================================================
// Legacy /network Query Parameter Schemas (backward compatibility)
// ============================================================================

/**
 * GET /memory/network/status
 */
export const getMemoryStatusNetworkQuerySchema = agentIdQuerySchema;

/**
 * GET /memory/network/threads
 * agentId is optional - can use storage fallback when not provided
 * resourceId is optional - when omitted, returns all threads
 * metadata is optional - filters threads by metadata key-value pairs (AND logic)
 */
export const listThreadsNetworkQuerySchema = createPagePaginationSchema(100).extend({
  agentId: z.string().optional(),
  resourceId: z.string().optional(),
  metadata: z
    .preprocess(
      val => {
        if (val === undefined) return val;
        if (typeof val === 'string') {
          try {
            return JSON.parse(val);
          } catch {
            // Return invalid string to fail validation (z.record will reject string type)
            return val;
          }
        }
        return val;
      },
      z.record(z.string(), z.unknown()),
    )
    .optional(),
  orderBy: storageOrderBySchema,
});

/**
 * GET /memory/network/threads/:threadId
 * agentId is optional - can use storage fallback when not provided
 * resourceId is optional - used for ownership validation fallback when not set via middleware
 */
export const getThreadByIdNetworkQuerySchema = optionalAgentIdQuerySchema.extend({
  resourceId: z.string().optional(),
});

/**
 * GET /memory/network/threads/:threadId/messages
 * agentId is optional - can use storage fallback when not provided
 */
export const listMessagesNetworkQuerySchema = createPagePaginationSchema(40).extend({
  agentId: z.string().optional(),
  resourceId: z.string().optional(),
  orderBy: messageOrderBySchema,
  include: includeSchema,
  filter: filterSchema,
});

/**
 * POST /memory/network/save-messages
 */
export const saveMessagesNetworkQuerySchema = agentIdQuerySchema;

/**
 * POST /memory/network/threads
 */
export const createThreadNetworkQuerySchema = agentIdQuerySchema;

/**
 * PATCH /memory/network/threads/:threadId
 */
export const updateThreadNetworkQuerySchema = agentIdQuerySchema;

/**
 * DELETE /memory/network/threads/:threadId
 * resourceId is optional - used for ownership validation fallback when not set via middleware
 */
export const deleteThreadNetworkQuerySchema = agentIdQuerySchema.extend({
  resourceId: z.string().optional(),
});

/**
 * POST /memory/network/messages/delete
 * resourceId is optional - used for ownership validation fallback when not set via middleware
 */
export const deleteMessagesNetworkQuerySchema = agentIdQuerySchema.extend({
  resourceId: z.string().optional(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Response for GET /memory/status
 */
export const memoryStatusResponseSchema = z.object({
  result: z.boolean(),
  memoryType: z.enum(['local', 'gateway']).optional(),
  observationalMemory: z
    .object({
      enabled: z.boolean(),
      hasRecord: z.boolean().optional(),
      originType: z.string().optional(),
      lastObservedAt: z.date().optional(),
      tokenCount: z.number().optional(),
      observationTokenCount: z.number().optional(),
      isObserving: z.boolean().optional(),
      isReflecting: z.boolean().optional(),
    })
    .optional(),
});

/**
 * Observational Memory config schema for API responses
 */
const observationalMemoryModelRoutingSchema = z.array(
  z.object({
    upTo: z.number(),
    model: z.string(),
  }),
);

const observationalMemoryConfigSchema = z.object({
  enabled: z.boolean(),
  scope: z.enum(['thread', 'resource']).optional(),
  shareTokenBudget: z.boolean().optional(),
  messageTokens: z.union([z.number(), z.object({ min: z.number(), max: z.number() })]).optional(),
  observationTokens: z.union([z.number(), z.object({ min: z.number(), max: z.number() })]).optional(),
  observationModel: z.string().optional(),
  reflectionModel: z.string().optional(),
  observationModelRouting: observationalMemoryModelRoutingSchema.optional(),
  reflectionModelRouting: observationalMemoryModelRoutingSchema.optional(),
});

/**
 * Response for GET /memory/config
 * MemoryConfig is complex with many optional fields - using passthrough
 */
export const memoryConfigResponseSchema = z.object({
  memoryType: z.enum(['local', 'gateway']).optional(),
  config: z
    .object({
      lastMessages: z.union([z.number(), z.literal(false)]).optional(),
      semanticRecall: z.union([z.boolean(), z.unknown()]).optional(),
      workingMemory: z
        .object({
          enabled: z.boolean().optional(),
          scope: z.enum(['thread', 'resource']).optional(),
          template: z.string().optional(),
          schema: z.unknown().optional(),
          version: z.enum(['stable', 'vnext']).optional(),
        })
        .passthrough() // WorkingMemory has additional experimental fields (useStateSignals, agentManaged)
        .optional(),
      observationalMemory: observationalMemoryConfigSchema.optional(),
    })
    .nullable(),
});

/**
 * Response for GET /memory/threads
 */
export const listThreadsResponseSchema = paginationInfoSchema.extend({
  threads: z.array(threadSchema),
});

/**
 * Response for GET /memory/threads/:threadId
 */
export const getThreadByIdResponseSchema = threadSchema;

/**
 * Response for GET /memory/threads/:threadId/messages
 */
export const listMessagesResponseSchema = z.object({
  messages: z.array(messageSchema),
  uiMessages: z.array(z.unknown()).nullable(), // Converted messages in UI format
});

/**
 * Response for GET /memory/threads/:threadId/working-memory
 */
export const getWorkingMemoryResponseSchema = z.object({
  workingMemory: z.unknown().nullable(), // Can be string or structured object depending on template
  source: z.enum(['thread', 'resource']),
  workingMemoryTemplate: z.unknown().nullable(), // Template structure varies
  threadExists: z.boolean(),
});

// ============================================================================
// Body Parameter Schemas for POST/PUT/DELETE
// ============================================================================

/**
 * Body schema for POST /memory/messages
 */
export const saveMessagesBodySchema = z.object({
  messages: z.array(messageSchema),
});

/**
 * Body schema for POST /memory/threads
 */
export const createThreadBodySchema = z.object({
  resourceId: z.string(),
  title: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  threadId: z.string().optional(),
});

/**
 * Body schema for PUT /memory/threads/:threadId
 */
export const updateThreadBodySchema = z.object({
  title: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  resourceId: z.string().optional(),
});

/**
 * Body schema for PUT /memory/threads/:threadId/working-memory
 */
export const updateWorkingMemoryBodySchema = z.object({
  workingMemory: z.string(),
  resourceId: z.string().optional(),
  memoryConfig: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Body schema for POST /memory/messages/delete
 * Accepts: string | string[] | { id: string } | { id: string }[]
 */
export const deleteMessagesBodySchema = z.object({
  messageIds: z.union([
    z.string(),
    z.array(z.string()),
    z.object({ id: z.string() }),
    z.array(z.object({ id: z.string() })),
  ]),
});

/**
 * Query schema for GET /memory/search
 */
export const searchMemoryQuerySchema = z.object({
  agentId: z.string(),
  searchQuery: z.string(),
  resourceId: z.string(),
  threadId: z.string().optional(),
  limit: z.coerce.number().optional().default(20),
  memoryConfig: memoryConfigSchema,
});

/**
 * Response schemas
 */
export const saveMessagesResponseSchema = z.object({
  messages: z.array(messageSchema),
});

export const deleteThreadResponseSchema = z.object({
  result: z.string(),
});

export const updateWorkingMemoryResponseSchema = successResponseSchema;

export const deleteMessagesResponseSchema = successResponseSchema.extend({
  message: z.string(),
});

export const searchMemoryResponseSchema = z.object({
  results: z.array(z.unknown()),
  count: z.number(),
  query: z.string(),
  searchScope: z.string().optional(),
  searchType: z.string().optional(),
});

/**
 * Body schema for POST /memory/threads/:threadId/clone
 */
export const cloneThreadBodySchema = z.object({
  newThreadId: z.string().optional(),
  resourceId: z.string().optional(),
  title: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  options: z
    .object({
      messageLimit: z.number().optional(),
      messageFilter: z
        .object({
          startDate: z.coerce.date().optional(),
          endDate: z.coerce.date().optional(),
          messageIds: z.array(z.string()).optional(),
        })
        .optional(),
    })
    .optional(),
});

/**
 * Response schema for POST /memory/threads/:threadId/clone
 */
export const cloneThreadResponseSchema = z.object({
  thread: threadSchema,
  clonedMessages: z.array(messageSchema),
});

// ============================================================================
// Observational Memory Schemas
// ============================================================================

/**
 * Query schema for GET /api/memory/observational-memory
 */
export const getObservationalMemoryQuerySchema = z.object({
  agentId: z.string(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  offset: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).optional(),
});

/**
 * Observational Memory record schema for API responses
 * Matches the ObservationalMemoryRecord type from @mastra/core/storage
 */
const bufferedObservationChunkSchema = z.object({
  id: z.string().optional(),
  cycleId: z.string(),
  observations: z.string(),
  tokenCount: z.number(),
  messageIds: z.array(z.string()).optional(),
  messageTokens: z.number(),
  lastObservedAt: z.date().optional(),
  createdAt: z.date().optional(),
  suggestedContinuation: z.string().optional(),
  currentTask: z.string().optional(),
  threadTitle: z.string().optional(),
  extractedValues: z.record(z.string(), z.unknown()).optional(),
  extractionFailures: z.array(z.object({ slug: z.string(), error: z.string() })).optional(),
});

const observationalMemoryRecordSchema = z.object({
  id: z.string(),
  scope: z.enum(['thread', 'resource']),
  resourceId: z.string(),
  threadId: z.string().nullable(),
  activeObservations: z.string(),
  bufferedObservations: z.string().optional(),
  bufferedObservationChunks: z.array(bufferedObservationChunkSchema).optional(),
  bufferedReflection: z.string().optional(),
  originType: z.enum(['initial', 'observation', 'reflection']),
  generationCount: z.number(),
  lastObservedAt: z.date().optional(),
  totalTokensObserved: z.number(),
  observationTokenCount: z.number(),
  pendingMessageTokens: z.number(),
  isObserving: z.boolean(),
  isReflecting: z.boolean(),
  config: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

/**
 * Response schema for GET /api/memory/observational-memory
 */
export const getObservationalMemoryResponseSchema = z.object({
  record: observationalMemoryRecordSchema.nullable(),
  history: z.array(observationalMemoryRecordSchema).optional(),
});

/**
 * Body schema for POST /api/memory/observational-memory/buffer-status
 */
export const awaitBufferStatusBodySchema = z.object({
  agentId: z.string(),
  resourceId: z.string().optional(),
  threadId: z.string().optional(),
});

/**
 * Response schema for POST /api/memory/observational-memory/buffer-status
 */
export const awaitBufferStatusResponseSchema = z.object({
  record: observationalMemoryRecordSchema.nullable(),
});
