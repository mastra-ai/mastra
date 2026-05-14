import { z } from 'zod/v4';
import { tracingOptionsSchema, coreMessageSchema, messageResponseSchema } from './common';
import { defaultOptionsSchema } from './default-options';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);
const jsonRecordSchema = z.record(z.string(), jsonValueSchema);

const commonMessageFieldsSchema = {
  id: z.string().optional(),
  name: z.string().optional(),
  metadata: jsonRecordSchema.optional(),
  providerMetadata: jsonRecordSchema.optional(),
  providerOptions: jsonRecordSchema.optional(),
  experimental_providerMetadata: jsonRecordSchema.optional(),
};

const textContentPartSchema = z.object({
  ...commonMessageFieldsSchema,
  type: z.literal('text'),
  text: z.string(),
});

const imageContentPartSchema = z.object({
  ...commonMessageFieldsSchema,
  type: z.literal('image'),
  image: z.union([z.string(), jsonRecordSchema]),
  mediaType: z.string().optional(),
  mimeType: z.string().optional(),
});

const fileContentPartSchema = z.object({
  ...commonMessageFieldsSchema,
  type: z.literal('file'),
  data: z.union([z.string(), jsonRecordSchema]).optional(),
  file: z.union([z.string(), jsonRecordSchema]).optional(),
  url: z.string().optional(),
  mediaType: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
});

const toolCallContentPartSchema = z.object({
  ...commonMessageFieldsSchema,
  type: z.literal('tool-call'),
  toolCallId: z.string(),
  toolName: z.string(),
  args: jsonValueSchema.optional(),
  input: jsonValueSchema.optional(),
});

const toolResultContentPartSchema = z.object({
  ...commonMessageFieldsSchema,
  type: z.literal('tool-result'),
  toolCallId: z.string(),
  toolName: z.string().optional(),
  result: jsonValueSchema.optional(),
  output: jsonValueSchema.optional(),
});

const messageContentPartSchema = z.union([
  textContentPartSchema,
  imageContentPartSchema,
  fileContentPartSchema,
  toolCallContentPartSchema,
  toolResultContentPartSchema,
]);
const messageContentSchema = z.union([z.string(), z.array(messageContentPartSchema)]);

const modelMessageSchema = z.object({
  ...commonMessageFieldsSchema,
  role: z.enum(['system', 'user', 'assistant', 'tool']),
  content: messageContentSchema,
});

const uiMessageSchema = z.object({
  ...commonMessageFieldsSchema,
  role: z.enum(['system', 'user', 'assistant', 'tool', 'data']),
  content: messageContentSchema.optional(),
  parts: z.array(messageContentPartSchema).optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

const mastraDBMessagePartSchema = z.object({ type: z.string() }).passthrough();
const mastraDBMessageContentSchema = z
  .object({
    format: z.literal(2),
    parts: z.array(mastraDBMessagePartSchema),
    content: messageContentSchema.optional(),
    experimental_attachments: z.array(jsonRecordSchema).optional(),
    toolInvocations: z.array(jsonRecordSchema).optional(),
    reasoning: z.string().optional(),
    annotations: z.array(jsonValueSchema).optional(),
    metadata: jsonRecordSchema.optional(),
    providerMetadata: jsonRecordSchema.optional(),
  })
  .passthrough();
const mastraDBMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['system', 'user', 'assistant', 'signal']),
  createdAt: z.union([z.string(), z.date()]),
  threadId: z.string().optional(),
  resourceId: z.string().optional(),
  type: z.string().optional(),
  content: mastraDBMessageContentSchema,
});

const messageInputSchema = z.union([modelMessageSchema, uiMessageSchema, mastraDBMessageSchema]);
const messageListInputSchema = z.union([
  z.string(),
  z.array(z.string()),
  messageInputSchema,
  z.array(messageInputSchema),
]);

const signalAttributesSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.undefined()]),
);

const baseSignalSchema = z.object({
  id: z.string().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  metadata: jsonRecordSchema.optional(),
  attributes: signalAttributesSchema.optional(),
});

const userMessageSignalSchema = baseSignalSchema.extend({
  type: z.literal('user-message'),
  contents: messageListInputSchema,
});

const contextSignalSchema = baseSignalSchema.extend({
  type: z.string().refine(type => type !== 'user-message', {
    message: 'non-user-message signals must not use type "user-message"',
  }),
  contents: z.string(),
});

const agentSignalSchema = z.union([userMessageSignalSchema, contextSignalSchema]);

// Path parameter schemas
export const agentIdPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the agent'),
});

/**
 * Query params for GET /agents/:agentId — controls which stored config version is used for overrides.
 * Use either `status` or `versionId`, not both.
 * - `status` — 'draft' (latest version, default) or 'published' (active published version).
 * - `versionId` — Resolve with a specific version ID.
 */
export const agentVersionQuerySchema = z.object({
  status: z
    .enum(['draft', 'published'])
    .optional()
    .describe(
      'Which stored config version to resolve: draft (latest, default) or published (active version). Mutually exclusive with versionId.',
    ),
  versionId: z
    .string()
    .optional()
    .describe(
      'Specific version ID to resolve. Mutually exclusive with status — if both are provided, versionId takes precedence.',
    ),
});

export const toolIdPathParams = z.object({
  toolId: z.string().describe('Unique identifier for the tool'),
});

export const agentToolPathParams = agentIdPathParams.extend({
  toolId: z.string().describe('Unique identifier for the tool'),
});

export const agentSkillPathParams = agentIdPathParams.extend({
  skillName: z.string().describe('Name of the skill'),
});

export const modelConfigIdPathParams = agentIdPathParams.extend({
  modelConfigId: z.string().describe('Unique identifier for the model configuration'),
});

/**
 * Schema for serialized processor metadata
 */
export const serializedProcessorSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
});

/**
 * Schema for serialized tool with JSON schemas
 * Uses passthrough() to allow additional tool properties beyond core fields
 */
export const serializedToolSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  inputSchema: z.string().optional(),
  outputSchema: z.string().optional(),
  requireApproval: z.boolean().optional(),
});

/**
 * Schema for serialized workflow with steps
 */
export const serializedWorkflowSchema = z.object({
  name: z.string(),
  steps: z
    .record(
      z.string(),
      z.object({
        id: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * Schema for serialized agent definition (referenced by other agents)
 */
export const serializedAgentDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
});

/**
 * Schema for SystemMessage type
 * Can be string, string[], or various message objects
 */
const systemMessageSchema = z.union([
  z.string(),
  z.array(z.string()),
  z.any(), // CoreSystemMessage or SystemModelMessage
  z.array(z.any()),
]);

/**
 * Schema for model configuration in model list
 */
const modelConfigSchema = z.object({
  model: z.object({
    modelId: z.string(),
    provider: z.string(),
    modelVersion: z.string(),
  }),
  // Additional fields from AgentModelManagerConfig can be added here
});

/**
 * Main schema for serialized agent representation
 */
export const serializedAgentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  instructions: systemMessageSchema.optional(),
  tools: z.record(z.string(), serializedToolSchema),
  agents: z.record(z.string(), serializedAgentDefinitionSchema),
  workflows: z.record(z.string(), serializedWorkflowSchema),
  inputProcessors: z.array(serializedProcessorSchema),
  outputProcessors: z.array(serializedProcessorSchema),
  provider: z.string().optional(),
  modelId: z.string().optional(),
  modelVersion: z.string().optional(),
  modelList: z.array(modelConfigSchema).optional(),
  defaultOptions: defaultOptionsSchema.optional(),
  defaultGenerateOptionsLegacy: z.record(z.string(), z.any()).optional(),
  defaultStreamOptionsLegacy: z.record(z.string(), z.any()).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  activeVersionId: z.string().optional(),
  hasDraft: z.boolean().optional(),
});

/**
 * Schema for agent with ID
 */
export const serializedAgentWithIdSchema = serializedAgentSchema.extend({
  id: z.string(),
});

/**
 * Schema for individual provider information
 */
export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
});

/**
 * Schema for providers endpoint response
 */
export const providersResponseSchema = z.object({
  providers: z.array(providerSchema),
});

/**
 * Schema for list agents endpoint response
 * Returns a record of agent ID to serialized agent
 */
export const listAgentsResponseSchema = z.record(z.string(), serializedAgentSchema);

/**
 * Schema for list tools endpoint response
 * Returns a record of tool ID to serialized tool
 */
export const listToolsResponseSchema = z.record(z.string(), serializedToolSchema);

// ============================================================================
// Agent Execution Body Schemas
// ============================================================================

/**
 * Schema for agent memory option
 */
const agentMemoryOptionSchema = z.object({
  thread: z.union([z.string(), z.object({ id: z.string() }).passthrough()]),
  resource: z.string(),
  options: z.record(z.string(), z.any()).optional(),
  readOnly: z.boolean().optional(),
});

/**
 * Schema for tool choice configuration
 */
const toolChoiceSchema = z.union([
  z.enum(['auto', 'none', 'required']),
  z.object({ type: z.literal('tool'), toolName: z.string() }),
]);

/**
 * Comprehensive body schema for agent generate and stream endpoints
 * Validates common fields while using passthrough for complex nested objects
 *
 * EXCLUDED FIELDS (not serializable):
 * - Callbacks: onStepFinish, onFinish, onChunk, onError, onAbort, prepareStep
 * - Class instances: inputProcessors, outputProcessors
 * - Non-serializable: abortSignal, tracingContext
 */
export const agentExecutionBodySchema = z
  .object({
    // REQUIRED
    messages: z.union([
      z.array(coreMessageSchema), // Array of messages
      z.string(), // Single user message shorthand
    ]),

    // Message Configuration
    instructions: systemMessageSchema.optional(),
    system: systemMessageSchema.optional(),
    context: z.array(coreMessageSchema).optional(),

    // Memory & Persistence
    memory: agentMemoryOptionSchema.optional(),
    runId: z.string().optional(),
    savePerStep: z.boolean().optional(),

    // Request Context (handler-specific field - merged with server's requestContext)
    requestContext: z.record(z.string(), z.any()).optional(),

    // Version overrides for sub-agents (and future primitives)
    versions: z
      .object({
        agents: z
          .record(
            z.string(),
            z.union([z.object({ versionId: z.string() }), z.object({ status: z.enum(['draft', 'published']) })]),
          )
          .optional(),
      })
      .optional(),

    // Execution Control
    maxSteps: z.number().optional(),
    stopWhen: z.any().optional(),

    // Model Configuration
    providerOptions: z
      .object({
        anthropic: z.record(z.string(), z.any()).optional(),
        google: z.record(z.string(), z.any()).optional(),
        openai: z.record(z.string(), z.any()).optional(),
        xai: z.record(z.string(), z.any()).optional(),
      })
      .optional(),
    modelSettings: z.any().optional(),

    // Tool Configuration
    activeTools: z.array(z.string()).optional(),
    toolsets: z.record(z.string(), z.any()).optional(),
    clientTools: z.record(z.string(), z.any()).optional(),
    toolChoice: toolChoiceSchema.optional(),
    requireToolApproval: z.boolean().optional(),

    // Evaluation
    scorers: z
      .union([
        z.record(z.string(), z.any()),
        z.record(
          z.string(),
          z.object({
            scorer: z.string(),
            sampling: z.any().optional(),
          }),
        ),
      ])
      .optional(),
    returnScorerData: z.boolean().optional(),

    // Observability
    tracingOptions: tracingOptionsSchema.optional(),

    // Structured Output
    output: z.any().optional(), // Zod schema, JSON schema, or structured output object
    structuredOutput: z
      .object({
        schema: z.object({}).passthrough(),
        model: z.union([z.string(), z.any()]).optional(),
        instructions: z.string().optional(),
        jsonPromptInjection: z.boolean().optional(),
        errorStrategy: z.enum(['strict', 'warn', 'fallback']).optional(),
        fallbackValue: z.any().optional(),
      })
      .optional(),
  })
  .passthrough(); // Allow additional fields for forward compatibility

/**
 * Legacy body schema for deprecated endpoints that still use threadId/resourceId
 * Used by /agents/:agentId/generate-legacy and /agents/:agentId/stream-legacy
 */
export const agentExecutionLegacyBodySchema = agentExecutionBodySchema.extend({
  resourceId: z.string().optional(),
  resourceid: z.string().optional(), // lowercase variant
  threadId: z.string().optional(),
});

export const streamUntilIdleBodySchema = agentExecutionBodySchema.extend({
  maxIdleMs: z.number().int().positive().optional(),
});

export const resumeStreamUntilIdleBodySchema = agentExecutionBodySchema.omit({ messages: true }).extend({
  runId: z.string(),
  resumeData: z.unknown().refine(x => x !== undefined, { message: 'resumeData is required' }),
  toolCallId: z.string().optional(),
  maxIdleMs: z.number().int().positive().optional(),
});
/**
 * Body schema for tool execute endpoint
 * Simple schema - tool validates its own input data
 * Note: Using z.unknown().refine() instead of z.any() to ensure data is required
 * (z.any() is treated as optional by Zod)
 */
const executeToolDataBodySchema = z.object({
  data: z.unknown().refine(x => x !== undefined, { message: 'data is required' }),
});

export const executeToolBodySchema = executeToolDataBodySchema.extend({
  requestContext: z.record(z.string(), z.any()).optional(),
});

export const executeToolContextBodySchema = executeToolDataBodySchema.extend({
  requestContext: z.record(z.string(), z.any()).optional(),
});

/**
 * Response schema for voice speakers endpoint
 * Flexible to accommodate provider-specific metadata
 */
export const voiceSpeakersResponseSchema = z.array(
  z
    .object({
      voiceId: z.string(),
    })
    .passthrough(), // Allow provider-specific fields like name, language, etc.
);

// ============================================================================
// Tool Approval Schemas
// ============================================================================

/**
 * Base schema for tool approval/decline operations
 * Both approve and decline use the same parameters
 */
const toolCallActionBodySchema = z.object({
  runId: z.string(),
  requestContext: z.record(z.string(), z.any()).optional(),
  toolCallId: z.string(),
  format: z.string().optional(),
});
const networkToolCallActionBodySchema = z.object({
  runId: z.string(),
  requestContext: z.record(z.string(), z.any()).optional(),
  format: z.string().optional(),
});

/**
 * Body schema for approving tool call
 */
export const approveToolCallBodySchema = toolCallActionBodySchema;

/**
 * Body schema for declining tool call
 */
export const declineToolCallBodySchema = toolCallActionBodySchema;

/**
 * Body schema for approving network tool call
 */
export const approveNetworkToolCallBodySchema = networkToolCallActionBodySchema;

/**
 * Body schema for declining network tool call
 */
export const declineNetworkToolCallBodySchema = networkToolCallActionBodySchema;

/**
 * Response schema for tool approval/decline
 */
export const toolCallResponseSchema = z.object({
  fullStream: z.any(), // ReadableStream
});

// ============================================================================
// Resume Stream Schema
// ============================================================================

/**
 * Body schema for resuming a suspended agent stream with custom data.
 * Extends the agent execution body without messages, since resume
 * continues from a prior suspension point rather than starting fresh.
 */
export const resumeStreamBodySchema = agentExecutionBodySchema.omit({ messages: true }).extend({
  runId: z.string(),
  resumeData: z.unknown().refine(x => x !== undefined, { message: 'resumeData is required' }),
  toolCallId: z.string().optional(),
});

// ============================================================================
// Model Management Schemas
// ============================================================================

/**
 * Body schema for updating agent model
 */
export const updateAgentModelBodySchema = z.object({
  modelId: z.string(),
  provider: z.string(),
});

/**
 * Body schema for reordering agent model list
 */
export const reorderAgentModelListBodySchema = z.object({
  reorderedModelIds: z.array(z.string()),
});

/**
 * Body schema for updating model in model list
 */
export const updateAgentModelInModelListBodySchema = z.object({
  model: z
    .object({
      modelId: z.string(),
      provider: z.string(),
    })
    .optional(),
  maxRetries: z.number().optional(),
  enabled: z.boolean().optional(),
});

/**
 * Response schema for model management operations
 */
export const modelManagementResponseSchema = messageResponseSchema;

// ============================================================================
// Voice Schemas
// ============================================================================

/**
 * Body schema for generating speech
 */
export const generateSpeechBodySchema = z.object({
  text: z.string(),
  speakerId: z.string().optional(),
});

/**
 * Body schema for transcribing speech
 */
export const transcribeSpeechBodySchema = z.object({
  audio: z.any(), // Buffer
  options: z.record(z.string(), z.any()).optional(),
});

/**
 * Response schema for transcribe speech
 */
export const transcribeSpeechResponseSchema = z.object({
  text: z.string(),
});

/**
 * Response schema for get listener
 */
export const getListenerResponseSchema = z.any(); // Listener info structure varies

/**
 * Response schema for agent generation endpoints
 * These return AI SDK types which have complex structures
 */
export const generateResponseSchema = z.any(); // AI SDK GenerateResult type
export const streamResponseSchema = z.any(); // AI SDK StreamResult type
export const speakResponseSchema = z.any(); // Voice synthesis result
export const executeToolResponseSchema = z.any(); // Tool execution result varies by tool

// ============================================================================
// Instruction Enhancement Schemas
// ============================================================================

/**
 * Body schema for enhancing agent instructions
 */
export const enhanceInstructionsBodySchema = z.object({
  instructions: z.string().describe('The current agent instructions to enhance'),
  comment: z.string().describe('User comment describing how to enhance the instructions'),
});

/**
 * Response schema for enhanced instructions
 */
export const enhanceInstructionsResponseSchema = z.object({
  explanation: z.string().describe('Explanation of the changes made'),
  new_prompt: z.string().describe('The enhanced instructions'),
});

// ============================================================================
// Observe (Resumable Streams) Schemas
// ============================================================================

/**
 * Body schema for observing an agent stream
 * Used to reconnect to an existing stream and receive missed events
 */
export const observeAgentBodySchema = z.object({
  runId: z.string().describe('The run ID to observe/reconnect to'),
  offset: z.number().optional().describe('Resume from this event index (0-based). If omitted, replays all events.'),
});

const signalActiveBehaviorSchema = z.enum(['deliver', 'persist', 'discard']);
const signalIdleBehaviorSchema = z.enum(['wake', 'persist', 'discard']);

const sendAgentSignalBaseBodySchema = z.object({
  signal: agentSignalSchema,
  ifActive: z
    .object({
      behavior: signalActiveBehaviorSchema.optional(),
    })
    .optional(),
});

export const sendAgentSignalBodySchema = z.union([
  sendAgentSignalBaseBodySchema.extend({
    runId: z.string(),
    resourceId: z.string().optional(),
    threadId: z.string().optional(),
    ifIdle: z.undefined().optional(),
  }),
  sendAgentSignalBaseBodySchema.extend({
    runId: z.string().optional(),
    resourceId: z.string(),
    threadId: z.string(),
    ifIdle: z
      .object({
        behavior: signalIdleBehaviorSchema.optional(),
        streamOptions: agentExecutionBodySchema.omit({ messages: true }).optional(),
      })
      .optional(),
  }),
]);

export const subscribeAgentThreadBodySchema = z.object({
  resourceId: z.string().optional(),
  threadId: z.string(),
});

/**
 * Response schema for observe endpoint (streaming response)
 */
export const observeAgentResponseSchema = z.any(); // Streaming response
