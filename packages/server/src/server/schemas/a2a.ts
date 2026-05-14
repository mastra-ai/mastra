import { z } from 'zod/v4';

// Path parameter schemas
export const a2aAgentIdPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the agent'),
});

export const a2aTaskPathParams = a2aAgentIdPathParams.extend({
  taskId: z.string().describe('Unique identifier for the task'),
});

// Body schemas for A2A protocol

// Push notification schemas
const pushNotificationAuthenticationInfoSchema = z.object({
  schemes: z.array(z.string()).describe('Supported authentication schemes - e.g. Basic, Bearer'),
  credentials: z.string().optional().describe('Optional credentials'),
});

const pushNotificationConfigSchema = z.object({
  url: z.string().describe('URL for sending the push notifications'),
  id: z.string().optional().describe('Push Notification ID - created by server to support multiple callbacks'),
  token: z.string().optional().describe('Token unique to this task/session'),
  authentication: pushNotificationAuthenticationInfoSchema.optional(),
});

const messageSendConfigurationSchema = z.object({
  acceptedOutputModes: z.array(z.string()).optional().describe('Accepted output modalities by the client'),
  blocking: z.boolean().optional().describe('If the server should treat the client as a blocking request'),
  historyLength: z.number().optional().describe('Number of recent messages to be retrieved'),
  pushNotificationConfig: pushNotificationConfigSchema.optional(),
});

// Part schemas
const textPartSchema = z.object({
  kind: z.literal('text').describe('Part type - text for TextParts'),
  text: z.string().describe('Text content'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata associated with the part'),
});

const fileWithBytesSchema = z.object({
  bytes: z.string().describe('base64 encoded content of the file'),
  mimeType: z.string().optional().describe('Optional mimeType for the file'),
  name: z.string().optional().describe('Optional name for the file'),
});

const fileWithUriSchema = z.object({
  uri: z.string().describe('URL for the File content'),
  mimeType: z.string().optional().describe('Optional mimeType for the file'),
  name: z.string().optional().describe('Optional name for the file'),
});

const filePartSchema = z.object({
  kind: z.literal('file').describe('Part type - file for FileParts'),
  file: z.union([fileWithBytesSchema, fileWithUriSchema]).describe('File content either as url or bytes'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata associated with the part'),
});

const dataPartSchema = z.object({
  kind: z.literal('data').describe('Part type - data for DataParts'),
  data: z.record(z.string(), z.unknown()).describe('Structured data content'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata associated with the part'),
});

const partSchema = z.union([textPartSchema, filePartSchema, dataPartSchema]);

// Message schema
const messageSchema = z.object({
  kind: z.literal('message').describe('Event type'),
  messageId: z.string().describe('Identifier created by the message creator'),
  role: z.enum(['user', 'agent']).describe("Message sender's role"),
  parts: z.array(partSchema).describe('Message content'),
  contextId: z.string().optional().describe('The context the message is associated with'),
  taskId: z.string().optional().describe('Identifier of task the message is related to'),
  referenceTaskIds: z.array(z.string()).optional().describe('List of tasks referenced as context by this message'),
  extensions: z
    .array(z.string())
    .optional()
    .describe('The URIs of extensions that are present or contributed to this Message'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Extension metadata'),
});

// MessageSendParams schema
const messageSendParamsSchema = z.object({
  message: messageSchema,
  configuration: messageSendConfigurationSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Extension metadata'),
});

// TaskQueryParams schema
const taskQueryParamsSchema = z.object({
  id: z.string().describe('Task id'),
  historyLength: z.number().optional().describe('Number of recent messages to be retrieved'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

// TaskIdParams schema
const taskIdParamsSchema = z.object({
  id: z.string().describe('Task id'),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const taskResubscribeParamsSchema = taskIdParamsSchema;

export const setPushNotificationConfigParamsSchema = z.object({
  taskId: z.string().describe('Task id'),
  pushNotificationConfig: pushNotificationConfigSchema,
});

const getPushNotificationConfigParamsSchema = taskIdParamsSchema.extend({
  pushNotificationConfigId: z.string().optional().describe('Push notification config id'),
});

export const listPushNotificationConfigParamsSchema = taskIdParamsSchema;

export const deletePushNotificationConfigParamsSchema = taskIdParamsSchema.extend({
  pushNotificationConfigId: z.string().describe('Push notification config id'),
});

// Legacy schema for backwards compatibility
export const messageSendBodySchema = z.object({
  message: messageSchema,
  metadata: z.record(z.string(), z.any()).optional(),
});

export const taskQueryBodySchema = z.object({
  id: z.string(),
});

const requestBaseSchema = {
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
} as const;

export const agentExecutionBodySchema = z.discriminatedUnion('method', [
  z.object({
    ...requestBaseSchema,
    method: z.literal('message/send'),
    params: messageSendParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('message/stream'),
    params: messageSendParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('tasks/get'),
    params: taskQueryParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('tasks/cancel'),
    params: taskIdParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('tasks/resubscribe'),
    params: taskResubscribeParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('tasks/pushNotificationConfig/set'),
    params: setPushNotificationConfigParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('tasks/pushNotificationConfig/get'),
    params: getPushNotificationConfigParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('tasks/pushNotificationConfig/list'),
    params: listPushNotificationConfigParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('tasks/pushNotificationConfig/delete'),
    params: deletePushNotificationConfigParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('agent/getAuthenticatedExtendedCard'),
  }),
]);

// Response schemas
export const agentCardResponseSchema = z.object({
  additionalInterfaces: z.array(z.unknown()).optional(),
  name: z.string(),
  description: z.string(),
  url: z.string(),
  protocolVersion: z.string(),
  provider: z
    .object({
      organization: z.string(),
      url: z.string(),
    })
    .optional(),
  security: z.array(z.record(z.string(), z.array(z.string()))).optional(),
  securitySchemes: z.record(z.string(), z.unknown()).optional(),
  version: z.string(),
  capabilities: z.object({
    extensions: z.array(z.unknown()).optional(),
    streaming: z.boolean().optional(),
    pushNotifications: z.boolean().optional(),
    stateTransitionHistory: z.boolean().optional(),
  }),
  defaultInputModes: z.array(z.string()),
  defaultOutputModes: z.array(z.string()),
  supportsAuthenticatedExtendedCard: z.boolean().optional(),
  signatures: z
    .array(
      z.object({
        protected: z.string(),
        signature: z.string(),
        header: z.record(z.string(), z.unknown()).optional(),
      }),
    )
    .optional(),
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
