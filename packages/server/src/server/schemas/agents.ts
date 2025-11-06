import z from 'zod';

// Path parameter schemas
export const agentIdPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the agent'),
});

export const toolIdPathParams = z.object({
  toolId: z.string().describe('Unique identifier for the tool'),
});

export const agentToolPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the agent'),
  toolId: z.string().describe('Unique identifier for the tool'),
});

export const modelConfigIdPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the agent'),
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
export const serializedToolSchema = z
  .object({
    id: z.string(),
    description: z.string().optional(),
    inputSchema: z.string().optional(),
    outputSchema: z.string().optional(),
    requireApproval: z.boolean().optional(),
  })
  .passthrough();

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
  z.object({}).passthrough(), // CoreSystemMessage or SystemModelMessage
  z.array(z.object({}).passthrough()),
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
  defaultOptions: z.record(z.string(), z.unknown()).optional(),
  defaultGenerateOptionsLegacy: z.record(z.string(), z.unknown()).optional(),
  defaultStreamOptionsLegacy: z.record(z.string(), z.unknown()).optional(),
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
  envVar: z.union([z.string(), z.array(z.string())]),
  connected: z.boolean(),
  docUrl: z.string().optional(),
  models: z.array(z.string()),
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
  options: z.record(z.string(), z.unknown()).optional(),
  readOnly: z.boolean().optional(),
});

/**
 * Schema for tracing options
 */
const tracingOptionsSchema = z.object({
  metadata: z.record(z.string(), z.unknown()).optional(),
  requestContextKeys: z.array(z.string()).optional(),
  traceId: z.string().optional(),
  parentSpanId: z.string().optional(),
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
      z.array(z.unknown()), // Array of messages
      z.string(), // Single user message shorthand
    ]),

    // Message Configuration
    instructions: systemMessageSchema.optional(),
    system: systemMessageSchema.optional(),
    context: z.array(z.unknown()).optional(),

    // Memory & Persistence
    memory: agentMemoryOptionSchema.optional(),
    resourceId: z.string().optional(), // @deprecated
    threadId: z.string().optional(), // @deprecated
    runId: z.string().optional(),
    savePerStep: z.boolean().optional(),

    // Request Context (handler-specific field)
    requestContext: z.record(z.string(), z.unknown()).optional(),

    // Execution Control
    maxSteps: z.number().optional(),
    stopWhen: z.object({}).passthrough().optional(),

    // Model Configuration
    providerOptions: z
      .object({
        anthropic: z.record(z.string(), z.unknown()).optional(),
        google: z.record(z.string(), z.unknown()).optional(),
        openai: z.record(z.string(), z.unknown()).optional(),
        xai: z.record(z.string(), z.unknown()).optional(),
      })
      .passthrough()
      .optional(),
    modelSettings: z.object({}).passthrough().optional(),

    // Tool Configuration
    activeTools: z.array(z.string()).optional(),
    toolsets: z.record(z.string(), z.unknown()).optional(),
    clientTools: z.record(z.string(), z.unknown()).optional(),
    toolChoice: toolChoiceSchema.optional(),
    requireToolApproval: z.boolean().optional(),

    // Evaluation
    scorers: z
      .union([
        z.array(z.unknown()),
        z.record(
          z.string(),
          z.object({
            scorer: z.string(),
            sampling: z.object({}).passthrough().optional(),
          }),
        ),
      ])
      .optional(),
    returnScorerData: z.boolean().optional(),

    // Observability
    tracingOptions: tracingOptionsSchema.optional(),

    // Structured Output
    structuredOutput: z
      .object({
        schema: z.unknown(),
        model: z.union([z.string(), z.object({}).passthrough()]).optional(),
        instructions: z.string().optional(),
        jsonPromptInjection: z.boolean().optional(),
        errorStrategy: z.enum(['strict', 'warn', 'fallback']).optional(),
        fallbackValue: z.unknown().optional(),
      })
      .optional(),
  })
  .passthrough(); // Allow additional fields for forward compatibility

/**
 * Body schema for tool execute endpoint
 * Simple schema - tool validates its own input data
 */
export const executeToolBodySchema = z.object({
  data: z.unknown(),
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
 * Body schema for approving tool call
 */
export const approveToolCallBodySchema = z.object({
  runId: z.string(),
  requestContext: z.string().optional(),
  toolCallId: z.string().optional(),
});

/**
 * Body schema for declining tool call
 */
export const declineToolCallBodySchema = z.object({
  runId: z.string(),
  requestContext: z.string().optional(),
  toolCallId: z.string().optional(),
});

/**
 * Response schema for tool approval/decline
 */
export const toolCallResponseSchema = z.object({
  fullStream: z.any(), // ReadableStream
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
export const modelManagementResponseSchema = z.object({
  message: z.string(),
});

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
  audioData: z.unknown(), // Buffer
  options: z.record(z.string(), z.unknown()).optional(),
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
export const getListenerResponseSchema = z.unknown(); // Listener info structure varies
