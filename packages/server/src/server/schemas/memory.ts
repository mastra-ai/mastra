import z from 'zod';
import {
  paginationInfoSchema,
  createPagePaginationSchema,
  createOffsetPaginationSchema,
  coreMessageSchema,
  successResponseSchema,
} from './common';

// Path parameter schemas
export const threadIdPathParams = z.object({
  threadId: z.string().describe('Unique identifier for the conversation thread'),
});

/**
 * Common query parameter: optional agent ID
 */
export const agentIdQuerySchema = z.object({
  agentId: z.string(),
});

/**
 * Storage order by configuration
 */
const storageOrderBySchema = z.object({
  field: z.enum(['createdAt', 'updatedAt']).optional(),
  direction: z.enum(['ASC', 'DESC']).optional(),
});

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
const messageSchema = coreMessageSchema.extend({
  id: z.string(),
  createdAt: z.date(),
  threadId: z.string(),
  resourceId: z.string(),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * GET /api/memory/status
 */
export const getMemoryStatusQuerySchema = agentIdQuerySchema;

/**
 * GET /api/memory/config
 */
export const getMemoryConfigQuerySchema = agentIdQuerySchema;

/**
 * GET /api/memory/threads
 */
export const listThreadsQuerySchema = createOffsetPaginationSchema(100).extend({
  agentId: z.string(),
  resourceId: z.string(),
  orderBy: storageOrderBySchema.optional(),
});

/**
 * GET /api/memory/threads/:threadId
 */
export const getThreadByIdQuerySchema = agentIdQuerySchema;

/**
 * GET /api/memory/threads/:threadId/messages
 */
export const getMessagesQuerySchema = createPagePaginationSchema(40).extend({
  agentId: z.string(),
  orderBy: storageOrderBySchema.optional(),
  include: z.unknown().optional(),
  filter: z.unknown().optional(),
});

/**
 * GET /api/memory/threads/:threadId/working-memory
 */
export const getWorkingMemoryQuerySchema = z.object({
  agentId: z.string(),
  resourceId: z.string().optional(),
  memoryConfig: z.record(z.string(), z.unknown()).optional(), // Complex config object
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Response for GET /api/memory/status
 */
export const memoryStatusResponseSchema = z.object({
  result: z.boolean(),
});

/**
 * Response for GET /api/memory/config
 * MemoryConfig is complex with many optional fields - using passthrough
 */
export const memoryConfigResponseSchema = z.object({
  config: z
    .object({
      lastMessages: z.union([z.number(), z.literal(false)]).optional(),
      semanticRecall: z.union([z.boolean(), z.object({}).passthrough()]).optional(),
      workingMemory: z.object({}).passthrough().optional(),
    })
    .passthrough(),
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
export const getMessagesResponseSchema = z.object({
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
  workingMemory: z.unknown(),
  resourceId: z.string().optional(),
  memoryConfig: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Query schema for GET /api/memory/messages
 */
export const listMessagesQuerySchema = createPagePaginationSchema(40).extend({
  agentId: z.string(),
  threadId: z.string(),
  resourceId: z.string().optional(),
  orderBy: storageOrderBySchema.optional(),
  include: z.unknown().optional(),
  filter: z.unknown().optional(),
});

/**
 * Query schema for DELETE /api/memory/messages
 */
export const deleteMessagesQuerySchema = z.object({
  messageIds: z.union([z.string(), z.array(z.string())]),
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
  memoryConfig: z.record(z.string(), z.unknown()).optional(),
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

export const listMessagesResponseSchema = z.object({
  messages: z.array(coreMessageSchema),
  pagination: paginationInfoSchema.optional(),
});

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
