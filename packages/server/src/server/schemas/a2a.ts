import z from 'zod';

// Path parameter schemas
export const a2aAgentIdPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the agent'),
});

export const a2aTaskPathParams = a2aAgentIdPathParams.extend({
  taskId: z.string().describe('Unique identifier for the task'),
});

// Body schemas for A2A protocol
export const messageSendBodySchema = z.object({
  message: z.object({
    role: z.enum(['user', 'agent']),
    parts: z.array(
      z.object({
        kind: z.enum(['text']),
        text: z.string(),
      }),
    ),
    kind: z.literal('message'),
    messageId: z.string(),
    contextId: z.string().optional(),
    taskId: z.string().optional(),
    referenceTaskIds: z.array(z.string()).optional(),
    extensions: z.array(z.string()).optional(),
    metadata: z.record(z.any()).optional(),
  }),
  metadata: z.record(z.any()).optional(),
});

export const taskQueryBodySchema = z.object({
  id: z.string(),
});

export const agentExecutionBodySchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  method: z.enum(['message/send', 'message/stream', 'tasks/get', 'tasks/cancel']),
  params: z.unknown(), // MessageSendParams | TaskQueryParams | TaskIdParams
});

// Response schemas
export const agentCardResponseSchema = z.object({
  name: z.string(),
  description: z.string(),
  url: z.string(),
  provider: z.object({
    organization: z.string(),
    url: z.string(),
  }),
  version: z.string(),
  capabilities: z.object({
    streaming: z.boolean(),
    pushNotifications: z.boolean(),
    stateTransitionHistory: z.boolean(),
  }),
  defaultInputModes: z.array(z.string()),
  defaultOutputModes: z.array(z.string()),
  skills: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      tags: z.array(z.string()).optional(),
    }),
  ),
});

export const taskResponseSchema = z.unknown(); // Complex task state structure

export const agentExecutionResponseSchema = z.unknown(); // JSON-RPC response
