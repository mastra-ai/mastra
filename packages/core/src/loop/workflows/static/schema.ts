import z from 'zod';

// 1. Define state schema
export const executionWorkflowStateSchema = z.object({
  capabilities: z.any(),
  options: z.any(),
  runId: z.string(),
  methodType: z.enum(['generate', 'stream', 'generateLegacy', 'streamLegacy']),
  threadFromArgs: z.any().optional(),
  resourceId: z.string().optional(),
  memory: z.any().optional(),
  memoryConfig: z.any().optional(),
  instructions: z.any(),
  requestContext: z.any(),
  agentSpan: z.any(),
  saveQueueManager: z.any(),
  returnScorerData: z.boolean().optional(),
  requireToolApproval: z.boolean().optional(),
  resumeContext: z.any().optional(),
  agentId: z.string(),
  toolCallId: z.string().optional(),
});
