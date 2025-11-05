import z from 'zod';

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
  scope: z.record(z.any()).nullable(),
  spanType: aiSpanTypeSchema,
  attributes: z.record(z.any()).nullable(),
  metadata: z.record(z.any()).nullable(),
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
