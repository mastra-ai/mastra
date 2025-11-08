import z from 'zod';

// Path parameter schemas
export const actionIdPathParams = z.object({
  actionId: z.string().describe('Unique identifier for the agent-builder action'),
});

export const actionRunPathParams = z.object({
  actionId: z.string().describe('Unique identifier for the agent-builder action'),
  runId: z.string().describe('Unique identifier for the action run'),
});

// Agent-builder actions use the same schemas as workflows since they're wrapped workflow handlers
// Import them from workflows
export {
  createWorkflowRunResponseSchema,
  listWorkflowRunsQuerySchema,
  optionalRunIdQuerySchema,
  resumeBodySchema,
  runIdQuerySchema,
  streamWorkflowBodySchema,
  startAsyncWorkflowBodySchema,
  sendWorkflowRunEventBodySchema,
  workflowExecutionResultSchema,
  workflowControlResponseSchema,
  workflowRunResponseSchema,
  workflowRunsResponseSchema,
  workflowInfoSchema,
  listWorkflowsResponseSchema,
} from './workflows';
