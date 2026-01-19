import z from 'zod';
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
 * Handles JSON parsing from query strings
 */
const storageOrderBySchema = z.preprocess(
  val => {
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
);

/**
 * Storage order by configuration for messages (only have createdAt)
 * Handles JSON parsing from query strings
 */
const messageOrderBySchema = z.preprocess(
  val => {
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
);

/**
 * Include schema for message listing - handles JSON parsing from query strings
 */
const includeSchema = z.preprocess(
  val => {
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
    .array(
      z.object({
        id: z.string(),
        threadId: z.string().optional(),
        withPreviousMessages: z.number().optional(),
        withNextMessages: z.number().optional(),
      }),
    )
    .optional(),
);

/**
 * Filter schema for message listing - handles JSON parsing from query strings
 */
const filterSchema = z.preprocess(
  val => {
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
      dateRange: z
        .object({
          start: z.coerce.date().optional(),
          end: z.coerce.date().optional(),
        })
        .optional(),
    })
    .optional(),
);

/**
 * Memory config schema - handles JSON parsing from query strings
 */
const memoryConfigSchema = z.preprocess(val => {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }
  return val;
}, z.record(z.string(), z.unknown()).optional());

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
const messageSchema = z.any();
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
 * GET /api/memory/config
 */
export const getMemoryConfigQuerySchema = agentIdQuerySchema;

/**
 * GET /api/memory/threads
 * agentId is optional - can use storage fallback when not provided
 */
export const listThreadsQuerySchema = createPagePaginationSchema(100).extend({
  agentId: z.string().optional(),
  resourceId: z.string(),
  orderBy: storageOrderBySchema,
});

/**
 * GET /api/memory/threads/:threadId
 * agentId is optional - can use storage fallback when not provided
 */
export const getThreadByIdQuerySchema = optionalAgentIdQuerySchema;

/**
 * GET /api/memory/threads/:threadId/messages
 * agentId is optional - can use storage fallback when not provided
 */
export const listMessagesQuerySchema = createPagePaginationSchema(40).extend({
  agentId: z.string().optional(),
  resourceId: z.string().optional(),
  orderBy: messageOrderBySchema,
  include: includeSchema,
  filter: filterSchema,
});

/**
 * GET /api/memory/threads/:threadId/working-memory
 */
export const getWorkingMemoryQuerySchema = z.object({
  agentId: z.string(),
  resourceId: z.string().optional(),
  memoryConfig: memoryConfigSchema,
});

// ============================================================================
// Legacy /network Query Parameter Schemas (backward compatibility)
// ============================================================================

/**
 * GET /api/memory/network/status
 */
export const getMemoryStatusNetworkQuerySchema = agentIdQuerySchema;

/**
 * GET /api/memory/network/threads
 * agentId is optional - can use storage fallback when not provided
 */
export const listThreadsNetworkQuerySchema = createPagePaginationSchema(100).extend({
  agentId: z.string().optional(),
  resourceId: z.string(),
  orderBy: storageOrderBySchema,
});

/**
 * GET /api/memory/network/threads/:threadId
 * agentId is optional - can use storage fallback when not provided
 */
export const getThreadByIdNetworkQuerySchema = optionalAgentIdQuerySchema;

/**
 * GET /api/memory/network/threads/:threadId/messages
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
 * POST /api/memory/network/save-messages
 */
export const saveMessagesNetworkQuerySchema = agentIdQuerySchema;

/**
 * POST /api/memory/network/threads
 */
export const createThreadNetworkQuerySchema = agentIdQuerySchema;

/**
 * PATCH /api/memory/network/threads/:threadId
 */
export const updateThreadNetworkQuerySchema = agentIdQuerySchema;

/**
 * DELETE /api/memory/network/threads/:threadId
 */
export const deleteThreadNetworkQuerySchema = agentIdQuerySchema;

/**
 * POST /api/memory/network/messages/delete
 */
export const deleteMessagesNetworkQuerySchema = agentIdQuerySchema;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Response for GET /api/memory/status
 */
export const memoryStatusResponseSchema = z.object({
  result: z.boolean(),
  observationalMemory: z
    .object({
      enabled: z.boolean(),
      hasRecord: z.boolean().optional(),
      originType: z.string().optional(),
      lastObservedAt: z.date().optional().nullable(),
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
const observationalMemoryConfigSchema = z.object({
  enabled: z.boolean(),
  scope: z.enum(['thread', 'resource']).optional(),
  observationThreshold: z.union([z.number(), z.object({ min: z.number(), max: z.number() })]).optional(),
  reflectionThreshold: z.union([z.number(), z.object({ min: z.number(), max: z.number() })]).optional(),
  observerModel: z.string().optional(),
  reflectorModel: z.string().optional(),
});

/**
 * Response for GET /api/memory/config
 * MemoryConfig is complex with many optional fields - using passthrough
 */
export const memoryConfigResponseSchema = z.object({
  config: z.object({
    lastMessages: z.union([z.number(), z.literal(false)]).optional(),
    semanticRecall: z.union([z.boolean(), z.any()]).optional(),
    workingMemory: z.any().optional(),
    observationalMemory: observationalMemoryConfigSchema.optional(),
  }),
});

/**
 * Response for GET /api/memory/threads
 */
export const listThreadsResponseSchema = paginationInfoSchema.extend({
  threads: z.array(threadSchema),
});

/**
 * Response for GET /api/memory/threads/:threadId
 */
export const getThreadByIdResponseSchema = threadSchema;

/**
 * Response for GET /api/memory/threads/:threadId/messages
 */
export const listMessagesResponseSchema = z.object({
  messages: z.array(messageSchema),
  uiMessages: z.unknown(), // Converted messages in UI format
});

/**
 * Response for GET /api/memory/threads/:threadId/working-memory
 */
export const getWorkingMemoryResponseSchema = z.object({
  workingMemory: z.unknown(), // Can be string or structured object depending on template
  source: z.enum(['thread', 'resource']),
  workingMemoryTemplate: z.unknown(), // Template structure varies
  threadExists: z.boolean(),
});

// ============================================================================
// Body Parameter Schemas for POST/PUT/DELETE
// ============================================================================

/**
 * Body schema for POST /api/memory/messages
 */
export const saveMessagesBodySchema = z.object({
  messages: z.array(messageSchema),
});

/**
 * Body schema for POST /api/memory/threads
 */
export const createThreadBodySchema = z.object({
  resourceId: z.string(),
  title: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  threadId: z.string().optional(),
});

/**
 * Body schema for PUT /api/memory/threads/:threadId
 */
export const updateThreadBodySchema = z.object({
  title: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  resourceId: z.string().optional(),
});

/**
 * Body schema for PUT /api/memory/threads/:threadId/working-memory
 */
export const updateWorkingMemoryBodySchema = z.object({
  workingMemory: z.string(),
  resourceId: z.string().optional(),
  memoryConfig: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Body schema for POST /api/memory/messages/delete
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
 * Query schema for GET /api/memory/search
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
 * Body schema for POST /api/memory/threads/:threadId/clone
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
 * Response schema for POST /api/memory/threads/:threadId/clone
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
});

/**
 * Observational Memory record schema for API responses
 * Matches the ObservationalMemoryRecord type from @mastra/core/storage
 */
const observationalMemoryRecordSchema = z.object({
  id: z.string(),
  scope: z.enum(['thread', 'resource']),
  resourceId: z.string(),
  threadId: z.string().nullable(),
  activeObservations: z.string(),
  bufferedObservations: z.string().optional(),
  bufferedReflection: z.string().optional(),
  patterns: z.record(z.string(), z.array(z.string())).optional(),
  originType: z.enum(['initial', 'observation', 'reflection']),
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
