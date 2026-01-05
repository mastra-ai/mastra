import z from 'zod';
import { createCombinedPaginationSchema, tracingOptionsSchema, messageResponseSchema } from './common';

export const workflowRunStatusSchema = z.enum([
  'running',
  'waiting',
  'suspended',
  'success',
  'failed',
  'canceled',
  'pending',
  'bailed',
  'tripwire',
  'paused',
]);

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
const serializedStepSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  stateSchema: z.string().optional(),
  inputSchema: z.string().optional(),
  outputSchema: z.string().optional(),
  resumeSchema: z.string().optional(),
  suspendSchema: z.string().optional(),
  component: z.string().optional(),
  isWorkflow: z.boolean().optional(),
});

/**
 * Schema for serialized step flow entry
 * Represents different step flow types in the workflow graph
 */
const serializedStepFlowEntrySchema = z.object({
  type: z.enum(['step', 'sleep', 'sleepUntil', 'waitForEvent', 'parallel', 'conditional', 'loop', 'foreach']),
});

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
  stateSchema: z.string().optional(),
  options: z.object({}).optional(),
  isProcessorWorkflow: z.boolean().optional(),
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
  snapshot: z.union([z.object({}), z.string()]),
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
 * Schema for query parameters when listing workflow runs
 * Supports both page/perPage and limit/offset for backwards compatibility
 * If page/perPage provided, use directly; otherwise convert from limit/offset
 */
export const listWorkflowRunsQuerySchema = createCombinedPaginationSchema().extend({
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  resourceId: z.string().optional(),
  status: workflowRunStatusSchema.optional(),
});

/**
 * Base schema for workflow execution with input data and tracing
 */
const workflowExecutionBodySchema = z.object({
  resourceId: z.string().optional(),
  inputData: z.unknown().optional(),
  initialState: z.unknown().optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
  tracingOptions: tracingOptionsSchema.optional(),
  perStep: z.boolean().optional(),
});

/**
 * Schema for legacy stream workflow body (no closeOnSuspend support)
 * Used by /stream-legacy endpoints
 */
export const streamLegacyWorkflowBodySchema = workflowExecutionBodySchema;

/**
 * Schema for stream workflow body
 * Used by both /stream and /streamVNext endpoints
 */
export const streamWorkflowBodySchema = workflowExecutionBodySchema.extend({
  closeOnSuspend: z.boolean().optional(),
});

/**
 * Schema for resume workflow body
 * Used by resume-stream, resume-async and resume endpoints
 */
export const resumeBodySchema = z.object({
  step: z.union([z.string(), z.array(z.string())]).optional(), // Optional - workflow can auto-resume all suspended steps
  resumeData: z.unknown().optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
  tracingOptions: tracingOptionsSchema.optional(),
  perStep: z.boolean().optional(),
});

/**
 * Schema for restart workflow body
 * Used by restart-async and restart endpoints
 */
export const restartBodySchema = z.object({
  requestContext: z.record(z.string(), z.unknown()).optional(),
  tracingOptions: tracingOptionsSchema.optional(),
});

/**
 * Schema for time travel workflow body
 * Used by time-travel-stream, time-travel-async and time-travel endpoints
 */
export const timeTravelBodySchema = z.object({
  inputData: z.unknown().optional(),
  resumeData: z.unknown().optional(),
  initialState: z.unknown().optional(),
  step: z.union([z.string(), z.array(z.string())]),
  context: z.record(z.string(), z.any()).optional(),
  nestedStepsContext: z.record(z.string(), z.record(z.string(), z.any())).optional(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
  tracingOptions: tracingOptionsSchema.optional(),
  perStep: z.boolean().optional(),
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
 * Schema for workflow execution result query parameters
 * Allows filtering which fields to return to reduce payload size
 */
export const workflowExecutionResultQuerySchema = z.object({
  fields: z
    .string()
    .optional()
    .refine(
      value => {
        if (!value) return true;
        const validFields = new Set(['result', 'error', 'payload', 'steps', 'activeStepsPath', 'serializedStepGraph']);
        const requestedFields = value.split(',').map(f => f.trim());
        return requestedFields.every(field => validFields.has(field));
      },
      {
        message:
          'Invalid field name. Available fields: result, error, payload, steps, activeStepsPath, serializedStepGraph',
      },
    )
    .describe(
      'Comma-separated list of fields to return. Available fields: result, error, payload, steps, activeStepsPath, serializedStepGraph. Metadata fields (runId, workflowName, resourceId, createdAt, updatedAt) and status are always included.',
    ),
  withNestedWorkflows: z
    .enum(['true', 'false'])
    .optional()
    .describe(
      'Whether to include nested workflow data in steps. Defaults to true. Set to false for better performance.',
    ),
});

/**
 * Schema for workflow execution result
 * All fields are optional since field filtering allows requesting specific fields only
 */
export const workflowExecutionResultSchema = z.object({
  status: workflowRunStatusSchema.optional(),
  result: z.unknown().optional(),
  error: z.unknown().optional(),
  payload: z.unknown().optional(),
  initialState: z.unknown().optional(),
  steps: z.record(z.string(), z.any()).optional(),
  activeStepsPath: z.record(z.string(), z.array(z.number())).optional(),
  serializedStepGraph: z.array(serializedStepFlowEntrySchema).optional(),
});

/**
 * Schema for query parameters when getting a unified workflow run result
 */
export const workflowRunResultQuerySchema = z.object({
  fields: z
    .string()
    .optional()
    .refine(
      value => {
        if (!value) return true;
        const validFields = new Set(['result', 'error', 'payload', 'steps', 'activeStepsPath', 'serializedStepGraph']);
        const requestedFields = value.split(',').map(f => f.trim());
        return requestedFields.every(field => validFields.has(field));
      },
      {
        message:
          'Invalid field name. Available fields: result, error, payload, steps, activeStepsPath, serializedStepGraph',
      },
    )
    .describe(
      'Comma-separated list of fields to return. Available fields: result, error, payload, steps, activeStepsPath, serializedStepGraph. Metadata fields (runId, workflowName, resourceId, createdAt, updatedAt) and status are always included.',
    ),
  withNestedWorkflows: z
    .enum(['true', 'false'])
    .optional()
    .describe(
      'Whether to include nested workflow data in steps. Defaults to true. Set to false for better performance.',
    ),
});

/**
 * Schema for unified workflow run result response
 * Combines metadata and processed execution state
 */
export const workflowRunResultSchema = z.object({
  // Metadata - always present
  runId: z.string(),
  workflowName: z.string(),
  resourceId: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),

  // Execution state
  status: workflowRunStatusSchema,
  result: z.unknown().optional(),
  error: z.unknown().optional(),
  payload: z.unknown().optional(),
  steps: z.record(z.string(), z.any()),

  // Optional detailed fields
  activeStepsPath: z.record(z.string(), z.array(z.number())).optional(),
  serializedStepGraph: z.array(serializedStepFlowEntrySchema).optional(),
});

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

/**
 * Schema for create workflow run body
 * Used by /create-run endpoint
 */
export const createWorkflowRunBodySchema = z.object({
  resourceId: z.string().optional(),
  disableScorers: z.boolean().optional(),
});
