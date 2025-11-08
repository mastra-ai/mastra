import z from 'zod';
import { createOffsetPaginationSchema, tracingOptionsSchema, messageResponseSchema } from './common';

// Path parameter schemas
export const workflowIdPathParams = z.object({
  workflowId: z.string().describe('Unique identifier for the workflow'),
});

export const workflowRunPathParams = workflowIdPathParams.extend({
  runId: z.string().describe('Unique identifier for the workflow run'),
});

/**
 * Schema for serialized step
 * Uses passthrough() to allow step-specific fields
 */
const serializedStepSchema = z
  .object({
    id: z.string(),
    description: z.string().optional(),
  })
  .passthrough();

/**
 * Schema for serialized step flow entry
 * Represents different step flow types in the workflow graph
 */
const serializedStepFlowEntrySchema = z
  .object({
    type: z.enum(['step', 'sleep', 'sleepUntil', 'waitForEvent', 'parallel', 'conditional']),
  })
  .passthrough();

/**
 * Schema for workflow information
 * Returned by getWorkflowByIdHandler and listWorkflowsHandler
 */
export const workflowInfoSchema = z.object({
  steps: z.record(z.string(), serializedStepSchema),
  allSteps: z.record(z.string(), serializedStepSchema),
  name: z.string().optional(),
  description: z.string().optional(),
  stepGraph: z.array(serializedStepFlowEntrySchema),
  inputSchema: z.string().optional(),
  outputSchema: z.string().optional(),
  options: z.object({}).passthrough().optional(),
});

/**
 * Schema for list workflows endpoint response
 * Returns a record of workflow ID to workflow info
 */
export const listWorkflowsResponseSchema = z.record(z.string(), workflowInfoSchema);

/**
 * Schema for workflow run object
 */
const workflowRunSchema = z.object({
  workflowName: z.string(),
  runId: z.string(),
  snapshot: z.union([z.object({}).passthrough(), z.string()]),
  createdAt: z.date(),
  updatedAt: z.date(),
  resourceId: z.string().optional(),
});

/**
 * Schema for workflow runs response (paginated)
 * Includes runs array and total count
 */
export const workflowRunsResponseSchema = z.object({
  runs: z.array(workflowRunSchema),
  total: z.number(),
});

/**
 * Schema for single workflow run response
 */
export const workflowRunResponseSchema = workflowRunSchema;

/**
 * Schema for query parameters when listing workflow runs
 * All query params come as strings from URL
 */
export const listWorkflowRunsQuerySchema = createOffsetPaginationSchema().extend({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  resourceId: z.string().optional(),
});

/**
 * Query parameter schema for runId (required)
 * Used by stream, resume-stream, start-async routes where runId comes from query
 */
export const runIdQuerySchema = z.object({
  runId: z.string(),
});

/**
 * Query parameter schema for runId (optional)
 * Used by create-run route where runId is optional
 */
export const optionalRunIdQuerySchema = z.object({
  runId: z.string().optional(),
});

/**
 * Base schema for workflow execution with input data and tracing
 */
const workflowExecutionBodySchema = z.object({
  inputData: z.unknown().optional(),
  tracingOptions: tracingOptionsSchema.optional(),
});

/**
 * Schema for stream workflow body
 * Used by both /stream and /streamVNext endpoints
 */
export const streamWorkflowBodySchema = workflowExecutionBodySchema;

/**
 * Schema for resume workflow body
 * Used by resume-stream, resume-async and resume endpoints
 */
export const resumeBodySchema = z.object({
  step: z.union([z.string(), z.array(z.string())]),
  resumeData: z.unknown().optional(),
});

/**
 * Schema for start async workflow body
 */
export const startAsyncWorkflowBodySchema = workflowExecutionBodySchema;

/**
 * Schema for send workflow run event body
 */
export const sendWorkflowRunEventBodySchema = z.object({
  event: z.string(),
  data: z.unknown(),
});

/**
 * Schema for workflow execution result
 */
export const workflowExecutionResultSchema = z
  .object({
    status: z.string(),
    result: z.unknown().optional(),
    error: z.unknown().optional(),
  })
  .passthrough();

/**
 * Response schema for workflow control operations
 */
export const workflowControlResponseSchema = messageResponseSchema;

/**
 * Response schema for create workflow run operation
 * Returns only the runId after creating a run
 */
export const createWorkflowRunResponseSchema = z.object({
  runId: z.string(),
});
