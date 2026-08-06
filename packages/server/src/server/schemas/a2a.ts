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
//
// The server accepts BOTH A2A v0.3 (kind-tagged) and v1 (content-keyed) parts.
// translate.ts normalizes v0.3 parts to v1 after validation, so these schemas
// only need to be a permissive superset that lets either shape through.

// --- v1 wire parts (discriminated by content key, no `kind`) ---
const v1TextPartSchema = z.object({
  text: z.string().describe('Text content'),
  mediaType: z.string().optional().describe('Optional media type for the text content'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata associated with the part'),
});

const v1FileBytesPartSchema = z.object({
  raw: z.string().describe('base64 encoded content of the file'),
  filename: z.string().optional().describe('Optional file name'),
  mediaType: z.string().optional().describe('Optional media type for the file'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata associated with the part'),
});

const v1FileUriPartSchema = z.object({
  url: z.string().describe('URL for the file content'),
  filename: z.string().optional().describe('Optional file name'),
  mediaType: z.string().optional().describe('Optional media type for the file'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata associated with the part'),
});

const v1DataPartSchema = z.object({
  data: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown())]).describe('Structured data content'),
  mediaType: z.string().optional().describe('Optional media type for the data'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata associated with the part'),
});

// --- v0.3 wire parts (kind-tagged) ---
const legacyTextPartSchema = z.object({
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

const legacyFilePartSchema = z.object({
  kind: z.literal('file').describe('Part type - file for FileParts'),
  file: z.union([fileWithBytesSchema, fileWithUriSchema]).describe('File content either as url or bytes'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata associated with the part'),
});

const legacyDataPartSchema = z.object({
  kind: z.literal('data').describe('Part type - data for DataParts'),
  data: z.record(z.string(), z.unknown()).describe('Structured data content'),
  metadata: z.record(z.string(), z.unknown()).optional().describe('Optional metadata associated with the part'),
});

// Permissive superset accepting both v0.3 (kind-tagged) and v1 (content-keyed) parts.
const partSchema = z.union([
  v1TextPartSchema,
  v1FileBytesPartSchema,
  v1FileUriPartSchema,
  v1DataPartSchema,
  legacyTextPartSchema,
  legacyFilePartSchema,
  legacyDataPartSchema,
]);

// Message schema — accepts both v1 (role ROLE_USER/ROLE_AGENT, no kind) and
// v0.3 (role user/agent, kind:'message') messages. translate.ts normalizes.
const messageSchema = z.object({
  kind: z.literal('message').optional().describe('Event type (v0.3 only)'),
  messageId: z.string().describe('Identifier created by the message creator'),
  role: z.enum(['user', 'agent', 'ROLE_USER', 'ROLE_AGENT']).describe("Message sender's role"),
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
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const taskQueryBodySchema = z.object({
  id: z.string(),
});

const requestBaseSchema = {
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
} as const;

// ListTasks (v1-only) params — permissive filtering/pagination.
const listTasksParamsSchema = z
  .object({
    pageSize: z.number().optional().describe('Maximum number of tasks to return'),
    pageToken: z.string().optional().describe('Opaque pagination token'),
    contextId: z.string().optional().describe('Filter tasks by context id'),
  })
  .optional();

export const agentExecutionBodySchema = z.discriminatedUnion('method', [
  // --- v0.3 slash method names ---
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
  // --- v1 PascalCase method names ---
  z.object({
    ...requestBaseSchema,
    method: z.literal('SendMessage'),
    params: messageSendParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('SendStreamingMessage'),
    params: messageSendParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('GetTask'),
    params: taskQueryParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('CancelTask'),
    params: taskIdParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('SubscribeToTask'),
    params: taskResubscribeParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('ListTasks'),
    params: listTasksParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('CreateTaskPushNotificationConfig'),
    params: setPushNotificationConfigParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('GetTaskPushNotificationConfig'),
    params: getPushNotificationConfigParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('ListTaskPushNotificationConfigs'),
    params: listPushNotificationConfigParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('DeleteTaskPushNotificationConfig'),
    params: deletePushNotificationConfigParamsSchema,
  }),
  z.object({
    ...requestBaseSchema,
    method: z.literal('GetExtendedAgentCard'),
  }),
]);

// Response schemas
// v1 AgentCard: interfaces are described in `supportedInterfaces`, the extended
// card flag lives in `capabilities.extendedAgentCard`. Kept permissive so a
// legacy-translated card (which re-adds `url` / `additionalInterfaces` /
// `supportsAuthenticatedExtendedCard`) still validates.
export const agentCardResponseSchema = z
  .object({
    name: z.string(),
    description: z.string(),
    protocolVersion: z.string().optional(),
    supportedInterfaces: z
      .array(
        z.object({
          url: z.string(),
          protocolBinding: z.string().optional(),
          protocolVersion: z.string().optional(),
          tenant: z.string().optional(),
        }),
      )
      .optional(),
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
      extendedAgentCard: z.boolean().optional(),
    }),
    defaultInputModes: z.array(z.string()),
    defaultOutputModes: z.array(z.string()),
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
    // v0.3 fields present only on a legacy-translated card.
    url: z.string().optional(),
    additionalInterfaces: z.array(z.unknown()).optional(),
    supportsAuthenticatedExtendedCard: z.boolean().optional(),
  })
  .loose();

export const taskResponseSchema = z.unknown(); // Complex task state structure

export const agentExecutionResponseSchema = z.unknown(); // JSON-RPC response
