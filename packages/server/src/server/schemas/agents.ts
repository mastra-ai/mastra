import z from 'zod';
import { tracingOptionsSchema, coreMessageSchema, messageResponseSchema } from './common';

// Path parameter schemas
export const agentIdPathParams = z.object({
  agentId: z.string().describe('Unique identifier for the agent'),
});

export const toolIdPathParams = z.object({
  toolId: z.string().describe('Unique identifier for the tool'),
});

export const agentToolPathParams = agentIdPathParams.extend({
  toolId: z.string().describe('Unique identifier for the tool'),
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
  defaultOptions: z.record(z.string(), z.any()).optional(),
  defaultGenerateOptionsLegacy: z.record(z.string(), z.any()).optional(),
  defaultStreamOptionsLegacy: z.record(z.string(), z.any()).optional(),
  source: z.enum(['code', 'stored']).optional(),
  activeVersionId: z.string().optional(),
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
    resourceId: z.string().optional(), // @deprecated
    resourceid: z.string().optional(),
    threadId: z.string().optional(), // @deprecated
    runId: z.string().optional(),
    savePerStep: z.boolean().optional(),

    // Request Context (handler-specific field - merged with server's requestContext)
    requestContext: z.record(z.string(), z.any()).optional(),

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
 * Body schema for tool execute endpoint
 * Simple schema - tool validates its own input data
 * Note: Using z.custom() instead of z.any()/z.any() because those are treated as optional by Zod
 */

const executeToolDataBodySchema = z.object({
  data: z.custom<unknown>(x => x !== undefined, { message: 'data is required' }),
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
  model: z
    .object({
      provider: z.string().describe('The provider ID (e.g., "openai", "anthropic")'),
      modelId: z.string().describe('The model ID (e.g., "gpt-4o", "claude-3-5-sonnet")'),
    })
    .optional()
    .describe('Optional model to use for enhancement. If not provided, uses the agent default model.'),
});

/**
 * Response schema for enhanced instructions
 */
export const enhanceInstructionsResponseSchema = z.object({
  explanation: z.string().describe('Explanation of the changes made'),
  new_prompt: z.string().describe('The enhanced instructions'),
});

/**
 * Body schema for generic enhance instructions (without requiring an agent)
 */
export const enhanceInstructionsGenericBodySchema = z.object({
  instructions: z.string().describe('The current instructions to enhance'),
  comment: z.string().describe('User comment describing how to enhance the instructions'),
  model: z
    .object({
      provider: z.string().describe('The provider ID (e.g., "openai", "anthropic")'),
      modelId: z.string().describe('The model ID (e.g., "gpt-4o", "claude-3-5-sonnet")'),
    })
    .describe('The model to use for enhancement'),
});
