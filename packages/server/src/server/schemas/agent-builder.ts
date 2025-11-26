import z from 'zod';
import {
  streamWorkflowBodySchema,
  resumeBodySchema,
  startAsyncWorkflowBodySchema,
  streamLegacyWorkflowBodySchema,
} from './workflows';

// Path parameter schemas

export const actionIdPathParams = z.object({
  actionId: z.string().describe('Unique identifier for the agent-builder action'),
});

export const actionRunPathParams = z.object({
  actionId: z.string().describe('Unique identifier for the agent-builder action'),
  runId: z.string().describe('Unique identifier for the action run'),
});

/**
 * Agent-builder schemas use the same body schemas as workflows
 * Both use requestContext field
 */

/**
 * Schema for stream agent-builder action body
 */
export const streamAgentBuilderBodySchema = streamWorkflowBodySchema;

/**
 * Schema for legacy stream agent-builder action body
 */
export const streamLegacyAgentBuilderBodySchema = streamLegacyWorkflowBodySchema;

/**
 * Schema for resume agent-builder action body
 */
export const resumeAgentBuilderBodySchema = resumeBodySchema;

/**
 * Schema for start async agent-builder action body
 */
export const startAsyncAgentBuilderBodySchema = startAsyncWorkflowBodySchema;

// Agent-builder actions use the same response schemas as workflows since they're wrapped workflow handlers
export {
  createWorkflowRunResponseSchema,
  listWorkflowRunsQuerySchema,
  sendWorkflowRunEventBodySchema,
  workflowExecutionResultSchema,
  workflowControlResponseSchema,
  workflowRunResponseSchema,
  workflowRunsResponseSchema,
  workflowInfoSchema,
  listWorkflowsResponseSchema,
} from './workflows';
