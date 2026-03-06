import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { CallSettings, StepResult, ToolChoice, ToolSet } from '@internal/ai-sdk-v5';
import { z } from 'zod/v4';
import type { MastraMessageContentV2, MessageList } from '../agent/message-list';
import type { ModelRouterModelId } from '../llm/model';
import type { MastraLanguageModel, OpenAICompatibleConfig, SharedProviderOptions } from '../llm/model/shared.types';
import type { InferStandardSchemaOutput, StandardSchemaWithJSON } from '../schema';
import type { InferSchemaOutput, OutputSchema } from '../stream/base/schema';
import type { StructuredOutputOptions } from './processors';

// =========================================================================
// Explicit Type Definitions
// (Prevents TypeScript from expanding Zod generics in .d.ts output)
// =========================================================================

export type TextPartType = { type: 'text'; text: string };

export type ImagePartType = { type: 'image'; image: string | URL | Uint8Array; mimeType?: string };

export type FilePartType = { type: 'file'; data: string | URL | Uint8Array; mimeType: string };

export type ToolInvocationPartType = {
  type: 'tool-invocation';
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    args?: unknown;
    state: 'partial-call' | 'call' | 'result';
    result?: unknown;
  };
};

export type ReasoningPartType = {
  type: 'reasoning';
  reasoning: string;
  details: Array<{ type: 'text' | 'redacted'; text?: string; data?: string }>;
};

export type SourcePartType = {
  type: 'source';
  source: { sourceType: string; id: string; url?: string; title?: string };
};

export type StepStartPartType = { type: 'step-start' };

export type DataPartType = { type: string; id?: string; data?: unknown };

export type MessagePartType =
  | TextPartType
  | ImagePartType
  | FilePartType
  | ToolInvocationPartType
  | ReasoningPartType
  | SourcePartType
  | StepStartPartType
  | DataPartType;

export type MessageContentType = {
  format: 2;
  parts: MessagePartType[];
  content?: string;
  metadata?: Record<string, unknown>;
  providerMetadata?: Record<string, unknown>;
};

type SystemMessageTextPartType = { type: 'text'; text: string };

export type SystemMessageType = {
  role: 'system';
  content: string | Array<SystemMessageTextPartType>;
  experimental_providerMetadata?: Record<string, unknown>;
};

type CoreMessageType = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: unknown;
};

export type ProcessorMessageType = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  createdAt: Date;
  threadId?: string;
  resourceId?: string;
  type?: string;
  content: MessageContentType;
};

/**
 * Model type for processor step schema.
 * In workflows, model configs may not yet be resolved, so we accept both resolved and unresolved types.
 */
export type ProcessorStepModelConfig =
  | LanguageModelV2
  | ModelRouterModelId
  | OpenAICompatibleConfig
  | MastraLanguageModel;

/**
 * Tools type for processor step schema.
 * Accepts both AI SDK ToolSet and generic Record for flexibility.
 */
export type ProcessorStepToolsConfig = ToolSet | Record<string, unknown>;

export type ProcessorInputPhaseType = {
  phase: 'input';
  messages: ProcessorMessageType[];
  messageList: MessageList;
  systemMessages?: CoreMessageType[];
  retryCount?: number;
};

export type ProcessorInputStepPhaseType = {
  phase: 'inputStep';
  messages: ProcessorMessageType[];
  messageList: MessageList;
  stepNumber: number;
  systemMessages?: CoreMessageType[];
  retryCount?: number;
  model?: ProcessorStepModelConfig;
  tools?: ProcessorStepToolsConfig;
  toolChoice?: ToolChoice<ToolSet>;
  activeTools?: string[];
  providerOptions?: SharedProviderOptions;
  modelSettings?: Omit<CallSettings, 'abortSignal'>;
  structuredOutput?: StructuredOutputOptions<InferSchemaOutput<OutputSchema>>;
  steps?: Array<StepResult<ToolSet>>;
};

export type ProcessorOutputStreamPhaseType = {
  phase: 'outputStream';
  part?: unknown | null;
  streamParts: unknown[];
  state: Record<string, unknown>;
  messageList?: MessageList;
  retryCount?: number;
};

export type ProcessorOutputResultPhaseType = {
  phase: 'outputResult';
  messages: ProcessorMessageType[];
  messageList: MessageList;
  retryCount?: number;
};

export type ProcessorOutputStepPhaseType = {
  phase: 'outputStep';
  messages: ProcessorMessageType[];
  messageList: MessageList;
  stepNumber: number;
  finishReason?: string;
  toolCalls?: Array<{ toolName: string; toolCallId: string; args?: unknown }>;
  text?: string;
  systemMessages?: CoreMessageType[];
  retryCount?: number;
};

export type ProcessorStepInputType =
  | ProcessorInputPhaseType
  | ProcessorInputStepPhaseType
  | ProcessorOutputStreamPhaseType
  | ProcessorOutputResultPhaseType
  | ProcessorOutputStepPhaseType;

export type ProcessorStepOutputType = {
  phase: 'input' | 'inputStep' | 'outputStream' | 'outputResult' | 'outputStep';
  messages?: ProcessorMessageType[];
  messageList?: MessageList;
  systemMessages?: CoreMessageType[];
  stepNumber?: number;
  part?: unknown | null;
  streamParts?: unknown[];
  state?: Record<string, unknown>;
  finishReason?: string;
  toolCalls?: Array<{ toolName: string; toolCallId: string; args?: unknown }>;
  text?: string;
  retryCount?: number;
  model?: MastraLanguageModel;
  tools?: ProcessorStepToolsConfig;
  toolChoice?: ToolChoice<ToolSet>;
  activeTools?: string[];
  providerOptions?: SharedProviderOptions;
  modelSettings?: Omit<CallSettings, 'abortSignal'>;
  structuredOutput?: StructuredOutputOptions<InferSchemaOutput<OutputSchema>>;
  steps?: Array<StepResult<ToolSet>>;
};

// =========================================================================
// Message Part Schemas (for documentation and UI)
// =========================================================================

/**
 * Text part in a message
 */
export const TextPartSchema: z.ZodType<TextPartType> = z
  .object({
    type: z.literal('text'),
    text: z.string(),
  })
  .passthrough();

/**
 * Image part in a message
 */
export const ImagePartSchema: z.ZodType<ImagePartType> = z
  .object({
    type: z.literal('image'),
    image: z.union([z.string(), z.instanceof(URL), z.instanceof(Uint8Array)]),
    mimeType: z.string().optional(),
  })
  .passthrough();

/**
 * File part in a message
 */
export const FilePartSchema: z.ZodType<FilePartType> = z
  .object({
    type: z.literal('file'),
    data: z.union([z.string(), z.instanceof(URL), z.instanceof(Uint8Array)]),
    mimeType: z.string(),
  })
  .passthrough();

/**
 * Tool invocation part in a message (covers tool-call states)
 */
export const ToolInvocationPartSchema: z.ZodType<ToolInvocationPartType> = z
  .object({
    type: z.literal('tool-invocation'),
    toolInvocation: z.object({
      toolCallId: z.string(),
      toolName: z.string(),
      args: z.unknown(),
      state: z.enum(['partial-call', 'call', 'result']),
      result: z.unknown().optional(),
    }),
  })
  .passthrough();

/**
 * Reasoning part in a message (for models that support reasoning)
 */
export const ReasoningPartSchema: z.ZodType<ReasoningPartType> = z
  .object({
    type: z.literal('reasoning'),
    reasoning: z.string(),
    details: z.array(
      z.object({
        type: z.enum(['text', 'redacted']),
        text: z.string().optional(),
        data: z.string().optional(),
      }),
    ),
  })
  .passthrough();

/**
 * Source part in a message (for citations/references)
 */
export const SourcePartSchema: z.ZodType<SourcePartType> = z
  .object({
    type: z.literal('source'),
    source: z.object({
      sourceType: z.string(),
      id: z.string(),
      url: z.string().optional(),
      title: z.string().optional(),
    }),
  })
  .passthrough();

/**
 * Step start part (marks the beginning of a step in multi-step responses)
 */
export const StepStartPartSchema: z.ZodType<StepStartPartType> = z
  .object({
    type: z.literal('step-start'),
  })
  .passthrough();

/**
 * Custom data part (for data-* custom parts from AI SDK writer.custom())
 * This uses a regex to match any type starting with "data-"
 */
export const DataPartSchema: z.ZodType<DataPartType> = z
  .object({
    type: z.string().refine(t => t.startsWith('data-'), { message: 'Type must start with "data-"' }),
    id: z.string().optional(),
    data: z.unknown(),
  })
  .passthrough();

/**
 * Union of all message part types.
 * Uses passthrough to allow additional fields from the AI SDK.
 * Note: We can't use discriminatedUnion here because DataPartSchema uses a regex pattern.
 */
export const MessagePartSchema: z.ZodType<MessagePartType> = z.union([
  TextPartSchema,
  ImagePartSchema,
  FilePartSchema,
  ToolInvocationPartSchema,
  ReasoningPartSchema,
  SourcePartSchema,
  StepStartPartSchema,
  DataPartSchema,
]);

// =========================================================================
// Message Content Schema (for documentation and UI)
// =========================================================================

/**
 * Message content structure (MastraMessageContentV2 format)
 * This is a documentation-friendly schema with properly typed parts.
 */
export const MessageContentSchema: z.ZodType<MessageContentType> = z.object({
  /** Format version - 2 corresponds to AI SDK v4 UIMessage format */
  format: z.literal(2),
  /** Array of message parts (text, images, tool calls, etc.) */
  parts: z.array(MessagePartSchema),
  /** Legacy content field for backwards compatibility */
  content: z.string().optional(),
  /** Additional metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Provider-specific metadata */
  providerMetadata: z.record(z.string(), z.unknown()).optional(),
});

// =========================================================================
// Message Schema (for documentation and UI)
// =========================================================================

/**
 * Schema for message content in processor workflows.
 * Uses the MessagePartSchema discriminated union for proper UI rendering.
 */
export const ProcessorMessageContentSchema: z.ZodType<MessageContentType> = z
  .object({
    /** Format version - 2 corresponds to AI SDK v4 UIMessage format */
    format: z.literal(2),
    /** Array of message parts (text, images, tool calls, etc.) */
    parts: z.array(MessagePartSchema),
    /** Legacy content field for backwards compatibility */
    content: z.string().optional(),
    /** Additional metadata */
    metadata: z.record(z.string(), z.unknown()).optional(),
    /** Provider-specific metadata */
    providerMetadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

/**
 * Schema for a message in the processor workflow.
 * This represents MastraDBMessage with properly typed fields for UI usage.
 *
 * Key fields:
 * - id: string - Unique message identifier
 * - role: 'user' | 'assistant' | 'system' - Message role
 * - createdAt: Date - When the message was created
 * - threadId?: string - Thread identifier for conversation grouping
 * - resourceId?: string - Resource identifier
 * - type?: string - Message type
 * - content: Message content with parts array
 */
export const ProcessorMessageSchema: z.ZodType<ProcessorMessageType> = z
  .object({
    /** Unique message identifier */
    id: z.string(),
    /** Message role */
    role: z.enum(['user', 'assistant', 'system', 'tool']),
    /** When the message was created */
    createdAt: z.coerce.date(),
    /** Thread identifier for conversation grouping */
    threadId: z.string().optional(),
    /** Resource identifier */
    resourceId: z.string().optional(),
    /** Message type */
    type: z.string().optional(),
    /** Message content with parts */
    content: ProcessorMessageContentSchema,
  })
  .passthrough();

/**
 * Type for a processor message - inferred from schema for consistency.
 * Use this type when working with processor messages in TypeScript.
 */
export type ProcessorMessage = ProcessorMessageType;

/**
 * Type for message content
 */
export type MessageContent = MastraMessageContentV2;

/**
 * Type for message parts - union of all possible part types.
 * Common part types:
 * - { type: 'text', text: string }
 * - { type: 'tool-invocation', toolInvocation: { toolCallId, toolName, args, state, result? } }
 * - { type: 'reasoning', reasoning: string, details: [...] }
 * - { type: 'source', source: { sourceType, id, url?, title? } }
 * - { type: 'file', data, mimeType }
 * - { type: 'step-start' }
 */
export type MessagePart = MessagePartType;

// =========================================================================
// Shared schemas for common fields
// =========================================================================

/**
 * MessageList instance for managing message sources.
 * Required for processors that need to mutate the message list.
 */
const messageListSchema = z.custom<MessageList>().describe('MessageList instance for managing message sources');

/**
 * The messages to be processed.
 * Format is MastraDBMessage[] - use ProcessorMessage type for TypeScript.
 */
const messagesSchema = z.array(ProcessorMessageSchema);

/**
 * Schema for system message content parts (CoreSystemMessage format)
 * System messages can have text parts or experimental provider extensions
 */
const SystemMessageTextPartSchema: z.ZodType<SystemMessageTextPartType> = z
  .object({
    type: z.literal('text'),
    text: z.string(),
  })
  .passthrough();

/**
 * Schema for a system message (CoreSystemMessage from AI SDK)
 * System messages provide context/instructions to the model.
 *
 * Note: This is exported for documentation purposes in the UI.
 * The actual systemMessages array in processor args may contain
 * other CoreMessage types depending on the context.
 */
export const SystemMessageSchema: z.ZodType<SystemMessageType> = z
  .object({
    role: z.literal('system'),
    content: z.union([z.string(), z.array(SystemMessageTextPartSchema)]),
    /** Optional experimental provider-specific extensions */
    experimental_providerMetadata: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

/**
 * Schema for CoreMessage (any message type from AI SDK)
 * This is a more permissive schema for runtime flexibility.
 */
const CoreMessageSchema: z.ZodType<CoreMessageType> = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.unknown(),
  })
  .passthrough();

/**
 * System messages for context.
 * These are CoreMessage types from the AI SDK, typically system messages
 * but may include other message types in some contexts.
 */
const systemMessagesSchema = z.array(CoreMessageSchema);

/**
 * Tool call schema for processOutputStep
 */
const toolCallSchema = z.object({
  toolName: z.string(),
  toolCallId: z.string(),
  args: z.unknown(),
});

/**
 * Number of times processors have triggered retry for this generation.
 */
const retryCountSchema = z.number().optional();

// =========================================================================
// Phase-specific schemas (discriminated union)
// =========================================================================

/**
 * Schema for 'input' phase - processInput
 * Processes input messages before they are sent to the LLM (once at the start)
 */
export const ProcessorInputPhaseSchema = z.object({
  phase: z.literal('input'),
  messages: messagesSchema,
  messageList: messageListSchema,
  systemMessages: systemMessagesSchema.optional(),
  retryCount: retryCountSchema,
});

/**
 * Schema for 'inputStep' phase - processInputStep
 * Processes input messages at each step of the agentic loop.
 * Includes model/tools configuration that can be modified per-step.
 */
export const ProcessorInputStepPhaseSchema = z.object({
  phase: z.literal('inputStep'),
  messages: messagesSchema,
  messageList: messageListSchema,
  stepNumber: z.number().describe('The current step number (0-indexed)'),
  systemMessages: systemMessagesSchema.optional(),
  retryCount: retryCountSchema,
  // Model and tools configuration (can be modified by processors)
  model: z.custom<ProcessorStepModelConfig>().optional().describe('Current model for this step'),
  tools: z.custom<ProcessorStepToolsConfig>().optional().describe('Current tools available for this step'),
  toolChoice: z.custom<ToolChoice<ToolSet>>().optional().describe('Current tool choice setting'),
  activeTools: z.array(z.string()).optional().describe('Currently active tools'),
  providerOptions: z.custom<SharedProviderOptions>().optional().describe('Provider-specific options'),
  modelSettings: z
    .custom<Omit<CallSettings, 'abortSignal'>>()
    .optional()
    .describe('Model settings (temperature, etc.)'),
  structuredOutput: z
    .custom<StructuredOutputOptions<InferStandardSchemaOutput<StandardSchemaWithJSON>>>()
    .optional()
    .describe('Structured output configuration'),
  steps: z.custom<Array<StepResult<ToolSet>>>().optional().describe('Results from previous steps'),
});

/**
 * Schema for 'outputStream' phase - processOutputStream
 * Processes output stream chunks with built-in state management
 */
export const ProcessorOutputStreamPhaseSchema = z.object({
  phase: z.literal('outputStream'),
  part: z.unknown().nullable().describe('The current chunk being processed. Can be null to skip.'),
  streamParts: z.array(z.unknown()).describe('All chunks seen so far'),
  state: z.record(z.string(), z.unknown()).describe('Mutable state object that persists across chunks'),
  messageList: messageListSchema.optional(),
  retryCount: retryCountSchema,
});

/**
 * Schema for 'outputResult' phase - processOutputResult
 * Processes the complete output result after streaming/generate is finished
 */
export const ProcessorOutputResultPhaseSchema = z.object({
  phase: z.literal('outputResult'),
  messages: messagesSchema,
  messageList: messageListSchema,
  retryCount: retryCountSchema,
});

/**
 * Schema for 'outputStep' phase - processOutputStep
 * Processes output after each LLM response in the agentic loop, before tool execution
 */
export const ProcessorOutputStepPhaseSchema = z.object({
  phase: z.literal('outputStep'),
  messages: messagesSchema,
  messageList: messageListSchema,
  stepNumber: z.number().describe('The current step number (0-indexed)'),
  finishReason: z.string().optional().describe('The finish reason from the LLM (stop, tool-use, length, etc.)'),
  toolCalls: z.array(toolCallSchema).optional().describe('Tool calls made in this step (if any)'),
  text: z.string().optional().describe('Generated text from this step'),
  systemMessages: systemMessagesSchema.optional(),
  retryCount: retryCountSchema,
});

/**
 * Discriminated union schema for processor step input in workflows.
 *
 * This schema uses a discriminated union based on the `phase` field,
 * which determines what other fields are required/available.
 * This makes it much clearer what data is needed for each phase
 * and provides better UX in the playground UI.
 *
 * Phases:
 * - 'input': Process input messages before LLM (once at start)
 * - 'inputStep': Process input messages at each agentic loop step
 * - 'outputStream': Process streaming chunks
 * - 'outputResult': Process complete output after streaming
 * - 'outputStep': Process output after each LLM response (before tools)
 */
export const ProcessorStepInputSchema: z.ZodType<ProcessorStepInputType> = z.discriminatedUnion('phase', [
  ProcessorInputPhaseSchema,
  ProcessorInputStepPhaseSchema,
  ProcessorOutputStreamPhaseSchema,
  ProcessorOutputResultPhaseSchema,
  ProcessorOutputStepPhaseSchema,
]);

/**
 * Output schema for processor step data in workflows.
 *
 * This is a more flexible schema that allows all fields to be optional
 * since the output from one phase may need to be passed to another.
 * The workflow engine handles the type narrowing internally.
 */
export const ProcessorStepOutputSchema: z.ZodType<ProcessorStepOutputType> = z.object({
  // Phase field
  phase: z.enum(['input', 'inputStep', 'outputStream', 'outputResult', 'outputStep']),

  // Message-based fields (used by most phases)
  messages: messagesSchema.optional(),
  messageList: messageListSchema.optional(),
  systemMessages: systemMessagesSchema.optional(),

  // Step-based fields
  stepNumber: z.number().optional(),

  // Stream-based fields
  part: z.unknown().nullable().optional(),
  streamParts: z.array(z.unknown()).optional(),
  state: z.record(z.string(), z.unknown()).optional(),

  // Output step fields
  finishReason: z.string().optional(),
  toolCalls: z.array(toolCallSchema).optional(),
  text: z.string().optional(),

  // Retry count
  retryCount: z.number().optional(),

  // Model and tools configuration (for inputStep phase)
  model: z.custom<MastraLanguageModel>().optional().describe('Language model instance'),
  tools: z.custom<ProcessorStepToolsConfig>().optional().describe('Tools configuration'),
  toolChoice: z.custom<ToolChoice<ToolSet>>().optional().describe('Tool choice setting'),
  activeTools: z.array(z.string()).optional().describe('Active tool names'),
  providerOptions: z.custom<SharedProviderOptions>().optional().describe('Provider-specific options'),
  modelSettings: z
    .custom<Omit<CallSettings, 'abortSignal'>>()
    .optional()
    .describe('Model settings (temperature, etc.)'),
  structuredOutput: z
    .custom<StructuredOutputOptions<InferStandardSchemaOutput<StandardSchemaWithJSON>>>()
    .optional()
    .describe('Structured output configuration'),
  steps: z.custom<Array<StepResult<ToolSet>>>().optional().describe('Results from previous steps'),
});

/**
 * Combined schema that works for both input and output.
 * Uses the discriminated union for better type inference.
 */
export const ProcessorStepSchema: z.ZodType<ProcessorStepInputType> = ProcessorStepInputSchema;

/**
 * Type for processor step data - discriminated union based on phase.
 * Use this for external APIs where type safety is important.
 */
export type ProcessorStepData = ProcessorStepInputType;

/**
 * Flexible type for internal processor code that needs to access all fields.
 * This is useful when you need to pass data through without knowing the exact phase.
 */
export type ProcessorStepDataFlexible = ProcessorStepOutputType;

/**
 * Input type alias for processor steps.
 */
export type ProcessorStepInput = ProcessorStepData;

/**
 * Output type alias for processor steps.
 * Uses the flexible schema since outputs may be passed between phases.
 */
export type ProcessorStepOutput = ProcessorStepDataFlexible;
