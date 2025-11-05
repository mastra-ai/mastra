import z from 'zod';

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
  steps: z.record(serializedStepSchema),
  allSteps: z.record(serializedStepSchema),
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
export const listWorkflowsResponseSchema = z.record(workflowInfoSchema);

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
export const listWorkflowRunsQuerySchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  perPage: z.string().optional(),
  page: z.string().optional(),
  resourceId: z.string().optional(),
});

/**
 * Schema for stream workflow body
 * Used by both /stream and /streamVNext endpoints
 */
export const streamWorkflowBodySchema = z.object({
  runId: z.string().optional(),
  inputData: z.unknown().optional(),
  tracingOptions: z.object({}).passthrough().optional(),
});

/**
 * Schema for resume stream workflow body
 */
export const resumeStreamBodySchema = z.object({
  step: z.union([z.string(), z.array(z.string())]),
  resumeData: z.unknown().optional(),
});
