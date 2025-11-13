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
 * Agent-builder schemas extend workflow schemas but replace workflowRequestContext with actionRequestContext
 */

/**
 * Schema for stream agent-builder action body
 */
export const streamAgentBuilderBodySchema = streamWorkflowBodySchema.omit({ workflowRequestContext: true }).extend({
  actionRequestContext: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for legacy stream agent-builder action body
 */
export const streamLegacyAgentBuilderBodySchema = streamLegacyWorkflowBodySchema
  .omit({ workflowRequestContext: true })
  .extend({
    actionRequestContext: z.record(z.string(), z.unknown()).optional(),
  });

/**
 * Schema for resume agent-builder action body
 */
export const resumeAgentBuilderBodySchema = resumeBodySchema.omit({ workflowRequestContext: true }).extend({
  actionRequestContext: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Schema for start async agent-builder action body
 */
export const startAsyncAgentBuilderBodySchema = startAsyncWorkflowBodySchema
  .omit({ workflowRequestContext: true })
  .extend({
    actionRequestContext: z.record(z.string(), z.unknown()).optional(),
  });

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
