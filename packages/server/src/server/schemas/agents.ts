import type {
  AgentExecutionOptions,
  PublicStructuredOutputOptions,
  ToolsetsInput,
  ToolsInput,
} from '@mastra/core/agent';
import type { CoreMessageV4 } from '@mastra/core/agent/message-list';
import type { ScoringSamplingConfig } from '@mastra/core/evals';
import type { OutputType, SystemMessage } from '@mastra/core/llm';
import type { ReasoningLevel } from '@mastra/core/loop';
import { z } from 'zod/v4';

/**
 * Structural mirror of LoopOptions['modelSettings'] (ai-sdk CallSettings minus
 * abortSignal, plus reasoning). CallSettings is not publicly exported from
 * @mastra/core, so its fields are restated here to keep declaration emit portable.
 */
/**
 * Structural mirror of LoopOptions['stopWhen'] entries. The ai-sdk StopCondition
 * type is not publicly exported from @mastra/core, so an assignable function
 * shape is used to keep declaration emit portable.
 */
type StopConditionArg = (event: unknown) => boolean | PromiseLike<boolean>;

/**
 * Structural mirror of the ai-sdk JSONValue type, which is not publicly
 * exported from @mastra/core. Used to keep providerOptions assignable to
 * ProviderOptions (Record<string, JSONObject>) with portable declaration emit.
 */
type JSONValue = null | string | number | boolean | { [key: string]: JSONValue } | JSONValue[];

type ModelSettings = {
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  stopSequences?: string[];
  seed?: number;
  maxRetries?: number;
  headers?: Record<string, string | undefined>;
  reasoning?: ReasoningLevel;
};
import { tracingOptionsSchema, coreMessageSchema, messageResponseSchema, typedPermissive } from './common';
import { defaultOptionsSchema } from './default-options';

export {
  generateSpeechBodySchema,
  getListenerResponseSchema,
  speakResponseSchema,
  transcribeSpeechBodySchema,
  transcribeSpeechResponseSchema,
  voiceSpeakersResponseSchema,
} from '@internal/voice/routes';

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

const partProviderOptionsSchema = z.record(z.string(), z.record(z.string(), jsonValueSchema)).optional();

const signalTextPartSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
  providerOptions: partProviderOptionsSchema,
});

const signalFilePartSchema = z.object({
  type: z.literal('file'),
  data: z.string(),
  mediaType: z.string(),
  filename: z.string().optional(),
  providerOptions: partProviderOptionsSchema,
});

const userMessageSignalContentsSchema = z.union([
  z.string(),
  z.array(z.union([signalTextPartSchema, signalFilePartSchema])),
]);

const agentMessageInputObjectSchema = z.object({
  contents: userMessageSignalContentsSchema,
  attributes: signalAttributesSchema.optional(),
  metadata: jsonRecordSchema.optional(),
  providerOptions: z.record(z.string(), z.record(z.string(), jsonValueSchema)).optional(),
});

const agentMessageInputSchema = z.union([userMessageSignalContentsSchema, agentMessageInputObjectSchema]);

const agentSignalSchema = baseSignalSchema.extend({
  type: z.enum(['user', 'state', 'reactive', 'notification', 'user-message', 'system-reminder']),
  tagName: z.string().optional(),
  contents: userMessageSignalContentsSchema,
  providerOptions: z.record(z.string(), z.record(z.string(), jsonValueSchema)).optional(),
});

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
const systemMessageSchema = typedPermissive<SystemMessage>(
  z.union([
    z.string(),
    z.array(z.string()),
    z.unknown(), // CoreSystemMessage or SystemModelMessage
    z.array(z.unknown()),
  ]),
);

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

const agentEditorConfigSchema = z.union([
  z.literal(false),
  z.object({
    instructions: z.boolean().optional(),
    tools: z.union([z.boolean(), z.object({ description: z.boolean().optional() })]).optional(),
  }),
]);

/**
 * Main schema for serialized agent representation
 */
export const serializedAgentSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  instructions: systemMessageSchema.optional(),
  tools: z.record(z.string(), serializedToolSchema),
  agents: z.record(z.string(), serializedAgentDefinitionSchema),
  workflows: z.record(z.string(), serializedWorkflowSchema),
  inputProcessors: z.array(serializedProcessorSchema),
  outputProcessors: z.array(serializedProcessorSchema),
  provider: z.string().optional(),
  modelId: z.string().optional(),
  modelVersion: z.string().optional(),
  supportsMemory: z.boolean().optional(),
  modelList: z.array(modelConfigSchema).optional(),
  defaultOptions: defaultOptionsSchema.optional(),
  defaultGenerateOptionsLegacy: z.record(z.string(), z.unknown()).optional(),
  defaultStreamOptionsLegacy: z.record(z.string(), z.unknown()).optional(),
  source: z.enum(['code', 'stored', 'fs']).optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  activeVersionId: z.string().optional(),
  hasDraft: z.boolean().optional(),
  editor: agentEditorConfigSchema.optional(),
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

export type ProviderListItem = z.infer<typeof providerSchema>;

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
  /**
   * Optional so authenticated setups can rely on the server-derived resource ID
   * (`mapUserToResourceId` sets MASTRA_RESOURCE_ID_KEY in the request context, which
   * takes precedence over this value). Handlers return a 400 when neither the body
   * nor the request context provides a resource ID.
   */
  resource: z.string().optional(),
  options: z.record(z.string(), z.unknown()).optional(),
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
    // ModelMessage[] at runtime; handlers cast since the AI SDK ModelMessage
    // type is not portable for declaration emit.
    context: z.array(coreMessageSchema).optional(),

    // Memory & Persistence
    memory: agentMemoryOptionSchema.optional(),
    runId: z.string().optional(),
    savePerStep: z.boolean().optional(),

    // Request Context (handler-specific field - merged with server's requestContext)
    requestContext: z.record(z.string(), z.unknown()).optional(),

    // Version overrides for sub-agents (and future primitives)
    versions: z
      .object({
        agents: z
          .record(
            z.string(),
            z.union([z.object({ versionId: z.string() }), z.object({ status: z.enum(['draft', 'published']) })]),
          )
          .optional(),
        defaultStatus: z.enum(['draft', 'published']).optional(),
      })
      .optional(),

    // Execution Control
    maxSteps: z.number().optional(),
    // Stop conditions are functions and cannot be validated by zod.
    stopWhen: typedPermissive<StopConditionArg | StopConditionArg[]>(z.unknown()).optional(),

    // Model Configuration
    providerOptions: typedPermissive<Record<string, Record<string, JSONValue>>>(
      z.object({
        anthropic: z.record(z.string(), z.unknown()).optional(),
        google: z.record(z.string(), z.unknown()).optional(),
        openai: z.record(z.string(), z.unknown()).optional(),
        xai: z.record(z.string(), z.unknown()).optional(),
      }),
    ).optional(),
    modelSettings: typedPermissive<ModelSettings>(z.unknown()).optional(),

    // Tool Configuration
    activeTools: z.array(z.string()).optional(),
    // Tool entries contain execute functions and cannot be validated by zod.
    toolsets: typedPermissive<ToolsetsInput>(z.record(z.string(), z.unknown())).optional(),
    clientTools: typedPermissive<ToolsInput>(z.record(z.string(), z.unknown())).optional(),
    toolChoice: toolChoiceSchema.optional(),
    requireToolApproval: z.boolean().optional(),

    // Evaluation
    scorers: typedPermissive<Record<string, { scorer: string; sampling?: ScoringSamplingConfig }>>(
      z.union([
        z.record(z.string(), z.unknown()),
        z.record(
          z.string(),
          z.object({
            scorer: z.string(),
            sampling: z.unknown().optional(),
          }),
        ),
      ]),
    ).optional(),
    returnScorerData: z.boolean().optional(),

    // Observability
    tracingOptions: tracingOptionsSchema.optional(),

    // Structured Output
    // Zod schema, JSON schema, or structured output object — cannot be validated by zod.
    output: typedPermissive<OutputType>(z.unknown()).optional(),
    // The concrete options type cannot be expressed field-by-field because of
    // the fallback discriminated union.
    structuredOutput: typedPermissive<PublicStructuredOutputOptions<Record<string, unknown>>>(
      z.object({
        schema: z.object({}).passthrough(),
        model: z.union([z.string(), z.unknown()]).optional(),
        instructions: z.string().optional(),
        jsonPromptInjection: z.boolean().optional(),
        errorStrategy: z.enum(['strict', 'warn', 'fallback']).optional(),
        fallbackValue: z.unknown().optional(),
      }),
    ).optional(),

    // Idle-loop streaming (collapses streamUntilIdle into stream)
    untilIdle: z.union([z.boolean(), z.object({ maxIdleMs: z.number().int().positive().optional() })]).optional(),
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
  // Legacy generate/stream expect AI SDK v4 CoreMessage context and a string system message.
  context: typedPermissive<CoreMessageV4[]>(z.array(coreMessageSchema)).optional(),
  system: typedPermissive<string>(systemMessageSchema).optional(),
});

export const streamUntilIdleBodySchema = agentExecutionBodySchema.extend({
  maxIdleMs: z.number().int().positive().optional(),
  untilIdle: z.union([z.boolean(), z.object({ maxIdleMs: z.number().int().positive().optional() })]).optional(),
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
 * Note: The .refine() ensures data is required
 * (bare z.unknown() is treated as optional by Zod)
 */
const executeToolDataBodySchema = z.object({
  data: z.unknown().refine(x => x !== undefined, { message: 'data is required' }),
});

export const executeToolBodySchema = executeToolDataBodySchema.extend({
  requestContext: z.record(z.string(), z.unknown()).optional(),
});

export const executeToolContextBodySchema = executeToolDataBodySchema.extend({
  requestContext: z.record(z.string(), z.unknown()).optional(),
});

// ============================================================================
// Tool Approval Schemas
// ============================================================================

/**
 * Base schema for tool approval/decline operations
 * Both approve and decline use the same parameters
 */
const toolCallActionBodySchema = z.object({
  runId: z.string(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
  toolCallId: z.string(),
  format: z.string().optional(),
});
const networkToolCallActionBodySchema = z.object({
  runId: z.string(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
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
  fullStream: z.unknown(), // ReadableStream
});

export const sendToolApprovalResponseSchema = z.object({
  accepted: z.literal(true),
  runId: z.string(),
  toolCallId: z.string().optional(),
});

/**
 * Query schema for listing suspended agent runs
 */
export const listSuspendedRunsQuerySchema = z
  .object({
    threadId: z.string().optional(),
    resourceId: z.string().optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
    perPage: z.coerce.number().int().positive().optional(),
    // page is zero-indexed, so 0 is valid
    page: z.coerce.number().int().nonnegative().optional(),
  })
  .refine(data => !data.fromDate || !data.toDate || data.fromDate <= data.toDate, {
    message: 'fromDate must be less than or equal to toDate',
    path: ['fromDate'],
  });

/**
 * Response schema for listing suspended agent runs
 */
export const listSuspendedRunsResponseSchema = z.object({
  runs: z.array(
    z.object({
      runId: z.string(),
      status: z.literal('suspended'),
      threadId: z.string().optional(),
      resourceId: z.string().optional(),
      suspendedAt: z.date(),
      toolCalls: z.array(
        z.object({
          toolCallId: z.string().optional(),
          toolName: z.string().optional(),
          args: z.unknown().optional(),
          requiresApproval: z.boolean(),
          suspendPayload: z.unknown().optional(),
        }),
      ),
    }),
  ),
  total: z.number().int().nonnegative(),
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
// Recover Schema
// ============================================================================

/**
 * Body schema for recovering an orphaned RUNNING durable-agent run.
 * Thread and resource are read from the persisted snapshot, so we only accept
 * the runId plus request-context / version overrides needed for auth and
 * routing.
 */
export const recoverBodySchema = z.object({
  runId: z.string(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
  versions: z
    .object({
      agents: z
        .record(
          z.string(),
          z.union([z.object({ versionId: z.string() }), z.object({ status: z.enum(['draft', 'published']) })]),
        )
        .optional(),
      defaultStatus: z.enum(['draft', 'published']).optional(),
    })
    .optional(),
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
// Response schemas for agent generation endpoints
// These return AI SDK types which have complex structures
// ============================================================================

export const generateResponseSchema = z.unknown(); // AI SDK GenerateResult type
export const streamResponseSchema = z.unknown(); // AI SDK StreamResult type
export const executeToolResponseSchema = z.unknown(); // Tool execution result varies by tool

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

const signalTargetBaseBodySchema = z.object({
  ifActive: z
    .object({
      behavior: signalActiveBehaviorSchema.optional(),
      attributes: signalAttributesSchema.optional(),
    })
    .optional(),
});

const signalTargetBodySchema = z.union([
  signalTargetBaseBodySchema.extend({
    runId: z.string(),
    resourceId: z.string().optional(),
    threadId: z.string().optional(),
    ifIdle: z.undefined().optional(),
  }),
  signalTargetBaseBodySchema.extend({
    runId: z.undefined().optional(),
    resourceId: z.string(),
    threadId: z.string(),
    ifIdle: z
      .object({
        behavior: signalIdleBehaviorSchema.optional(),
        streamOptions: agentExecutionBodySchema.omit({ messages: true }).optional(),
        attributes: signalAttributesSchema.optional(),
      })
      .optional(),
  }),
]);

export const sendAgentSignalBodySchema = z.union([
  signalTargetBodySchema.options[0].extend({ signal: agentSignalSchema }),
  signalTargetBodySchema.options[1].extend({ signal: agentSignalSchema }),
]);

export const sendAgentMessageBodySchema = z.union([
  signalTargetBodySchema.options[0].extend({ message: agentMessageInputSchema }),
  signalTargetBodySchema.options[1].extend({ message: agentMessageInputSchema }),
]);

export const queueAgentMessageBodySchema = sendAgentMessageBodySchema;

export const subscribeAgentThreadBodySchema = z.object({
  resourceId: z.string().optional(),
  threadId: z.string(),
});

export const abortAgentThreadBodySchema = subscribeAgentThreadBodySchema;

export const sendToolApprovalBodySchema = z.object({
  resourceId: z.string(),
  threadId: z.string(),
  requestContext: z.record(z.string(), z.unknown()).optional(),
  toolCallId: z.string(),
  approved: z.boolean(),
  resumeData: z.unknown().optional(),
  format: z.string().optional(),
  messages: z.array(coreMessageSchema).optional(),
  streamOptions: typedPermissive<AgentExecutionOptions<undefined>>(z.unknown()).optional(),
});

export const abortAgentThreadResponseSchema = z.object({
  aborted: z.boolean(),
});

/**
 * Response schema for observe endpoint (streaming response)
 */
export const observeAgentResponseSchema = z.unknown(); // Streaming response
