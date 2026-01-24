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
        // Return invalid string to fail validation (z.array will reject string type)
        return val;
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
        // Return invalid string to fail validation (z.object will reject string type)
        return val;
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
      roles: z.array(z.string()).optional(),
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
      // Return invalid string to fail validation (z.record will reject string type)
      return val;
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
 * GET /memory/status
 */
export const getMemoryStatusQuerySchema = agentIdQuerySchema;

/**
 * GET /memory/config
 */
export const getMemoryConfigQuerySchema = agentIdQuerySchema;

/**
 * GET /memory/threads
 * agentId is optional - can use storage fallback when not provided
 * resourceId is optional - when omitted, returns all threads
 * metadata is optional - filters threads by metadata key-value pairs (AND logic)
 */
export const listThreadsQuerySchema = createPagePaginationSchema(100).extend({
  agentId: z.string().optional(),
  resourceId: z.string().optional(),
  metadata: z.preprocess(
    val => {
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
    z.optional(z.record(z.string(), z.any())),
  ),
  orderBy: storageOrderBySchema,
});

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
  metadata: z.preprocess(
    val => {
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
    z.optional(z.record(z.string(), z.any())),
  ),
  orderBy: storageOrderBySchema,
});

/**
 * GET /memory/network/threads/:threadId
 * agentId is optional - can use storage fallback when not provided
 */
export const getThreadByIdNetworkQuerySchema = optionalAgentIdQuerySchema;

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
 */
export const deleteThreadNetworkQuerySchema = agentIdQuerySchema;

/**
 * POST /memory/network/messages/delete
 */
export const deleteMessagesNetworkQuerySchema = agentIdQuerySchema;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Response for GET /memory/status
 */
export const memoryStatusResponseSchema = z.object({
  result: z.boolean(),
});

/**
 * Response for GET /memory/config
 * MemoryConfig is complex with many optional fields - using passthrough
 */
export const memoryConfigResponseSchema = z.object({
  config: z.object({
    lastMessages: z.union([z.number(), z.literal(false)]).optional(),
    semanticRecall: z.union([z.boolean(), z.any()]).optional(),
    workingMemory: z.any().optional(),
  }),
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
  uiMessages: z.unknown(), // Converted messages in UI format
});

/**
 * Response for GET /memory/threads/:threadId/working-memory
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
