import z from 'zod';
import { paginationQuerySchema } from './memory';

/**
 * Schema for AI span types
 * Defines all possible span types in the observability system
 */
export const aiSpanTypeSchema = z.enum([
  'agent_run',
  'generic',
  'model_generation',
  'model_step',
  'model_chunk',
  'mcp_tool_call',
  'processor_run',
  'tool_call',
  'workflow_run',
  'workflow_step',
  'workflow_conditional',
  'workflow_conditional_eval',
  'workflow_parallel',
  'workflow_loop',
  'workflow_sleep',
  'workflow_wait_event',
]);

/**
 * Schema for pagination information
 * Used across various paginated endpoints
 */
export const paginationInfoSchema = z.object({
  total: z.number(),
  page: z.number(),
  perPage: z.union([z.number(), z.literal(false)]),
  hasMore: z.boolean(),
});

/**
 * Schema for AI span record
 * Represents a single trace span with all its metadata
 */
export const aiSpanRecordSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().nullable(),
  name: z.string(),
  scope: z.record(z.string(), z.any()).nullable(),
  spanType: aiSpanTypeSchema,
  attributes: z.record(z.string(), z.any()).nullable(),
  metadata: z.record(z.string(), z.any()).nullable(),
  links: z.any(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
  input: z.any(),
  output: z.any(),
  error: z.any(),
  isEvent: z.boolean(),
});

/**
 * Schema for paginated AI traces response
 * Returns pagination info and array of trace spans
 */
export const getAITracesPaginatedResponseSchema = z.object({
  pagination: paginationInfoSchema,
  spans: z.array(aiSpanRecordSchema),
});

// Path parameter schemas
export const traceIdPathParams = z.object({
  traceId: z.string().describe('Unique identifier for the trace'),
});

export const traceSpanPathParams = z.object({
  traceId: z.string().describe('Unique identifier for the trace'),
  spanId: z.string().describe('Unique identifier for the span'),
});

// Body schema for scoring traces
export const scoreTracesBodySchema = z.object({
  scorerName: z.string(),
  targets: z.array(
    z.object({
      traceId: z.string(),
      spanId: z.string().optional(),
    }),
  ),
});

// Response schemas
export const getAITraceResponseSchema = z.object({
  spans: z.array(aiSpanRecordSchema),
});

export const scoreTracesResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
  traceCount: z.number(),
});

export const listScoresBySpanResponseSchema = z.object({
  pagination: paginationInfoSchema,
  scores: z.array(z.unknown()),
});

// Query schema for list scores by span
export const listScoresBySpanQuerySchema = paginationQuerySchema;
