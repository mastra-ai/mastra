import z from 'zod';
import { paginationInfoSchema, createPagePaginationSchema, successResponseSchema } from './common';

// ============================================================================
// Path Parameter Schemas
// ============================================================================

export const inboxIdPathParams = z.object({
  inboxId: z.string().describe('Unique identifier for the inbox'),
});

export const taskIdPathParams = z.object({
  inboxId: z.string().describe('Unique identifier for the inbox'),
  taskId: z.string().describe('Unique identifier for the task'),
});

// ============================================================================
// Task Status and Priority Enums
// ============================================================================

export const taskStatusSchema = z.enum([
  'pending',
  'claimed',
  'in_progress',
  'waiting_for_input',
  'completed',
  'failed',
  'cancelled',
]);

export const taskPrioritySchema = z.coerce.number().min(0).max(3);

// ============================================================================
// Task Schema
// ============================================================================

export const taskSchema = z.object({
  id: z.string(),
  inboxId: z.string(),
  type: z.string(),
  status: taskStatusSchema,
  priority: taskPrioritySchema,

  // Display
  title: z.string().optional(),
  sourceId: z.string().optional(),
  sourceUrl: z.string().optional(),

  // Data
  payload: z.unknown(),
  result: z.unknown().optional(),
  error: z
    .object({
      message: z.string(),
      stack: z.string().optional(),
      retryable: z.boolean().optional(),
    })
    .optional(),

  // Assignment
  targetAgentId: z.string().optional(),
  claimedBy: z.string().optional(),

  // Run association
  runId: z.string().optional(),

  // Timing
  createdAt: z.coerce.date(),
  claimedAt: z.coerce.date().optional(),
  claimExpiresAt: z.coerce.date().optional(),
  startedAt: z.coerce.date().optional(),
  completedAt: z.coerce.date().optional(),

  // Retries
  attempts: z.number(),
  maxAttempts: z.number(),
  nextRetryAt: z.coerce.date().optional(),

  // Human-in-the-loop
  suspendedAt: z.coerce.date().optional(),
  suspendPayload: z.unknown().optional(),
  resumePayload: z.unknown().optional(),

  // Metadata
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * GET /api/inboxes/:inboxId/tasks
 */
export const listTasksQuerySchema = createPagePaginationSchema(100).extend({
  status: z
    .union([taskStatusSchema, z.array(taskStatusSchema)])
    .optional()
    .describe('Filter by task status'),
  type: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .describe('Filter by task type'),
  targetAgentId: z.string().optional().describe('Filter by target agent'),
  claimedBy: z.string().optional().describe('Filter by claiming agent'),
  priority: taskPrioritySchema.optional().describe('Filter by priority'),
});

// ============================================================================
// Request Body Schemas
// ============================================================================

/**
 * POST /api/inboxes/:inboxId/tasks - Create a task
 */
export const createTaskBodySchema = z.object({
  id: z.string().optional(),
  type: z.string(),
  payload: z.unknown().refine(val => val !== undefined, { message: 'payload is required' }),
  priority: taskPrioritySchema.optional(),
  title: z.string().optional(),
  targetAgentId: z.string().optional(),
  sourceId: z.string().optional(),
  sourceUrl: z.string().optional(),
  maxAttempts: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/inboxes/:inboxId/tasks/batch - Create multiple tasks
 */
export const createTasksBatchBodySchema = z.object({
  tasks: z.array(createTaskBodySchema),
});

/**
 * POST /api/inboxes/:inboxId/tasks/:taskId/resume - Resume a suspended task
 */
export const resumeTaskBodySchema = z.object({
  payload: z.unknown(),
});

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Response for GET /api/inboxes
 */
export const listInboxesResponseSchema = z.object({
  inboxes: z.array(
    z.object({
      id: z.string(),
      name: z.string().optional(),
    }),
  ),
});

/**
 * Response for GET /api/inboxes/:inboxId/tasks
 */
export const listTasksResponseSchema = z.object({
  tasks: z.array(taskSchema),
  pagination: paginationInfoSchema,
});

/**
 * Response for GET /api/inboxes/:inboxId/tasks/:taskId
 */
export const getTaskResponseSchema = taskSchema.nullable();

/**
 * Response for GET /api/inboxes/:inboxId/stats
 */
export const inboxStatsResponseSchema = z.object({
  pending: z.number(),
  claimed: z.number(),
  inProgress: z.number(),
  waitingForInput: z.number(),
  completed: z.number(),
  failed: z.number(),
});

/**
 * Response for POST /api/inboxes/:inboxId/tasks
 */
export const createTaskResponseSchema = taskSchema;

/**
 * Response for POST /api/inboxes/:inboxId/tasks/batch
 */
export const createTasksBatchResponseSchema = z.object({
  tasks: z.array(taskSchema),
});

/**
 * Response for GET /api/inboxes/:inboxId/tasks/waiting
 */
export const listWaitingTasksResponseSchema = z.object({
  tasks: z.array(taskSchema),
});

/**
 * Standard success response for task operations
 */
export const taskOperationResponseSchema = successResponseSchema;
