import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import type { CallSettings, StepResult, ToolChoice } from '@internal/ai-sdk-v5';
import type { MessageList, MastraDBMessage } from '../agent/message-list';
import type { TripWireOptions } from '../agent/trip-wire';
import type { ModelRouterModelId } from '../llm/model';
import type { MastraLanguageModel, OpenAICompatibleConfig, SharedProviderOptions } from '../llm/model/shared.types';
import type { Mastra } from '../mastra';
import type { ObservabilityContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { InferStandardSchemaOutput, StandardSchemaWithJSON } from '../schema';
import type { ChunkType } from '../stream';
import type { DataChunkType } from '../stream/types';
import type { Workflow } from '../workflows';
import type { StructuredOutputOptions } from './processors';
import type { ProcessorStepOutput } from './step-schema';

/**
 * Writer interface for processors to emit custom data chunks to the stream.
 * This enables real-time streaming of processor-specific data (e.g., observation markers).
 */
export interface ProcessorStreamWriter {
  /**
   * Emit a custom data chunk to the stream.
   * The chunk type must start with 'data-' prefix.
   * @param data - The data chunk to emit
   */
  custom<T extends { type: string }>(data: T extends { type: `data-${string}` } ? DataChunkType : T): Promise<void>;
}

/**
 * Base context shared by all processor methods
 */
export interface ProcessorContext<TTripwireMetadata = unknown> extends Partial<ObservabilityContext> {
  /**
   * Function to abort processing with an optional reason and options.
   * @param reason - The reason for aborting
   * @param options - Options including retry flag and metadata
   */
  abort: (reason?: string, options?: TripWireOptions<TTripwireMetadata>) => never;
  /** Optional runtime context with execution metadata */
  requestContext?: RequestContext;
  /**
   * Number of times processors have triggered retry for this generation.
   * Use this to implement retry limits within your processor.
   */
  retryCount: number;
  /**
   * Optional stream writer for emitting custom data chunks.
   * Available when the agent is streaming and outputWriter is provided.
   * Use writer.custom() to emit data-* chunks that will be streamed to the client.
   */
  writer?: ProcessorStreamWriter;
  /**
   * Optional abort signal from the parent agent execution.
   * Processors should pass this to any long-running operations (e.g., LLM calls)
   * so they can be canceled when the parent agent is aborted.
   */
  abortSignal?: AbortSignal;
}

/**
 * Context for message-based processor methods (processInput, processOutputResult, processInputStep)
 */
export interface ProcessorMessageContext<TTripwireMetadata = unknown> extends ProcessorContext<TTripwireMetadata> {
  /** The current messages being processed */
  messages: MastraDBMessage[];
  /** MessageList instance for managing message sources */
  messageList: MessageList;
}

/**
 * Return type for processInput that includes modified system messages
 */
export interface ProcessInputResultWithSystemMessages {
  messages: MastraDBMessage[];
  systemMessages: CoreMessageV4[];
}

/**
 * Return type for message-based processor methods
 * - MessageList: Return the same messageList instance passed in (indicates you've mutated it)
 * - MastraDBMessage[]: Return transformed messages array (for simple transformations)
 */
export type ProcessorMessageResult = Promise<MessageList | MastraDBMessage[]> | MessageList | MastraDBMessage[];

/**
 * Possible return types from processInput
 */
export type ProcessInputResult = MessageList | MastraDBMessage[] | ProcessInputResultWithSystemMessages;

/**
 * Arguments for processInput method
 */
export interface ProcessInputArgs<TTripwireMetadata = unknown> extends ProcessorMessageContext<TTripwireMetadata> {
  /** All system messages (agent instructions, user-provided, memory) for read/modify access */
  systemMessages: CoreMessageV4[];
  /** Per-processor state that persists across all method calls within this request */
  state: Record<string, unknown>;
}

/**
 * Arguments for processOutputResult method
 */
export interface ProcessOutputResultArgs<
  TTripwireMetadata = unknown,
> extends ProcessorMessageContext<TTripwireMetadata> {
  /** Per-processor state that persists across all method calls within this request */
  state: Record<string, unknown>;
}

/**
 * Arguments for processInputStep method
 *
 * Note: structuredOutput.schema is typed as OutputSchema (not the specific OUTPUT type) because
 * processors run in a chain and any previous processor may have modified structuredOutput.
 * The actual schema type is only known at the generate()/stream() call site.
 */
export interface ProcessInputStepArgs<TTripwireMetadata = unknown> extends ProcessorMessageContext<TTripwireMetadata> {
  /** The current step number (0-indexed) */
  stepNumber: number;
  steps: Array<StepResult<any>>;

  /** All system messages (agent instructions, user-provided, memory) for read/modify access */
  systemMessages: CoreMessageV4[];
  /** Per-processor state that persists across all method calls within this request */
  state: Record<string, unknown>;

  /**
   * Current model for this step.
   * Can be a resolved MastraLanguageModelV2 or an unresolved config (string, OpenAI-compatible config).
   */
  model: MastraLanguageModel;
  /** Current tools available for this step */
  tools?: Record<string, unknown>;
  toolChoice?: ToolChoice<any>;
  activeTools?: string[];

  providerOptions?: SharedProviderOptions;
  modelSettings?: Omit<CallSettings, 'abortSignal'>;
  /**
   * Structured output configuration. The schema type is StandardSchemaWithJSON (not the specific OUTPUT)
   * because processors can modify it, and the actual type is only known at runtime.
   */
  structuredOutput?: StructuredOutputOptions<InferStandardSchemaOutput<StandardSchemaWithJSON>>;
  /**
   * Number of times processors have triggered retry for this generation.
   * Use this to implement retry limits within your processor.
   */
  retryCount: number;
}

export type RunProcessInputStepArgs = Omit<ProcessInputStepArgs, 'messages' | 'systemMessages' | 'abort' | 'state'>;

/**
 * Result from processInputStep method
 *
 * Note: structuredOutput.schema is typed as StandardSchemaWithJSON (not the specific OUTPUT type) because
 * processors can modify it dynamically, and the actual type is only known at runtime.
 */
export type ProcessInputStepResult = {
  model?: LanguageModelV2 | ModelRouterModelId | OpenAICompatibleConfig | MastraLanguageModel;
  /** Replace tools for this step - accepts both AI SDK tools and Mastra createTool results */
  tools?: Record<string, unknown>;
  toolChoice?: ToolChoice<any>;
  activeTools?: string[];

  messages?: MastraDBMessage[];
  messageList?: MessageList;
  /** Replace all system messages with these */
  systemMessages?: CoreMessageV4[];
  providerOptions?: SharedProviderOptions;
  modelSettings?: Omit<CallSettings, 'abortSignal'>;
  /**
   * Structured output configuration. The schema type is StandardSchemaWithJSON (not the specific OUTPUT)
   * because processors can modify it, and the actual type is only known at runtime.
   */
  structuredOutput?: StructuredOutputOptions<InferStandardSchemaOutput<StandardSchemaWithJSON>>;
  /**
   * Number of times processors have triggered retry for this generation.
   * Use this to implement retry limits within your processor.
   */
  retryCount?: number;
};

export type RunProcessInputStepResult = Omit<ProcessInputStepResult, 'model'> & { model?: MastraLanguageModel };

/**
 * Arguments for processOutputStream method
 */
export interface ProcessOutputStreamArgs<TTripwireMetadata = unknown> extends ProcessorContext<TTripwireMetadata> {
  /** The current chunk being processed */
  part: ChunkType;
  /** All chunks seen so far */
  streamParts: ChunkType[];
  /** Mutable state object that persists across chunks */
  state: Record<string, unknown>;
  /** Optional MessageList instance for accessing conversation history */
  messageList?: MessageList;
}

/**
 * Tool call information for processOutputStep
 */
export interface ToolCallInfo {
  toolName: string;
  toolCallId: string;
  args: unknown;
}

/**
 * Arguments for processOutputStep method.
 * Called after each LLM response in the agentic loop, before tool execution.
 */
export interface ProcessOutputStepArgs<TTripwireMetadata = unknown> extends ProcessorMessageContext<TTripwireMetadata> {
  /** The current step number (0-indexed) */
  stepNumber: number;
  /** The finish reason from the LLM (stop, tool-use, length, etc.) */
  finishReason?: string;
  /** Tool calls made in this step (if any) */
  toolCalls?: ToolCallInfo[];
  /** Generated text from this step */
  text?: string;
  /** All system messages */
  systemMessages: CoreMessageV4[];
  /** All completed steps so far (including the current step) */
  steps: Array<StepResult<any>>;
  /** Mutable state object that persists across steps */
  state: Record<string, unknown>;
}

/**
 * Processor interface for transforming messages and stream chunks.
 *
 * @template TId - The processor's unique identifier type
 * @template TTripwireMetadata - The type of metadata passed when calling abort()
 */
export interface Processor<TId extends string = string, TTripwireMetadata = unknown> {
  readonly id: TId;
  readonly name?: string;
  readonly description?: string;
  /** Index of this processor in the workflow (set at runtime when combining processors) */
  processorIndex?: number;

  /**
   * Process input messages before they are sent to the LLM
   *
   * @returns Either:
   *  - MessageList: The same messageList instance passed in (indicates you've mutated it)
   *  - MastraDBMessage[]: Transformed messages array (for simple transformations)
   *  - { messages, systemMessages }: Object with both messages and modified system messages
   */
  processInput?(args: ProcessInputArgs<TTripwireMetadata>): Promise<ProcessInputResult> | ProcessInputResult;

  /**
   * Process output stream chunks with built-in state management
   * This allows processors to accumulate chunks and make decisions based on larger context
   * Return null or undefined to skip emitting the part
   */
  processOutputStream?(args: ProcessOutputStreamArgs<TTripwireMetadata>): Promise<ChunkType | null | undefined>;

  /**
   * Process the complete output result after streaming/generate is finished
   *
   * @returns Either:
   *  - MessageList: The same messageList instance passed in (indicates you've mutated it)
   *  - MastraDBMessage[]: Transformed messages array (for simple transformations)
   */
  processOutputResult?(args: ProcessOutputResultArgs<TTripwireMetadata>): ProcessorMessageResult;

  /**
   * Process input messages at each step of the agentic loop, before they are sent to the LLM.
   * Unlike processInput which runs once at the start, this runs at every step (including tool call continuations).
   *
   * @returns Either:
   *  - ProcessInputStepResult object with model, toolChoice, messages, etc.
   *  - MessageList: The same messageList instance passed in (indicates you've mutated it)
   *  - MastraDBMessage[]: Transformed messages array (for simple transformations)
   *  - undefined/void: No changes
   */
  processInputStep?(
    args: ProcessInputStepArgs<TTripwireMetadata>,
  ):
    | Promise<ProcessInputStepResult | MessageList | MastraDBMessage[] | undefined | void>
    | ProcessInputStepResult
    | MessageList
    | MastraDBMessage[]
    | void
    | undefined;

  /**
   * Process output after each LLM response in the agentic loop, before tool execution.
   * Unlike processOutputResult which runs once at the end, this runs at every step.
   *
   * This is the ideal place to implement guardrails that can trigger retries:
   * - Validate tone, format, or content of LLM responses
   * - Check for policy violations before tools are executed
   * - Implement self-correction by calling abort({ retry: true })
   *
   * @returns Either:
   *  - MessageList: The same messageList instance passed in (indicates you've mutated it)
   *  - MastraDBMessage[]: Transformed messages array (for simple transformations)
   */
  processOutputStep?(args: ProcessOutputStepArgs<TTripwireMetadata>): ProcessorMessageResult;

  /**
   * Internal method called when the processor is registered with a Mastra instance.
   * This allows processors to access Mastra services like knowledge, storage, etc.
   * @internal
   */
  __registerMastra?(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void;
}

/**
 * Base class for processors that need access to Mastra services.
 * Extend this class to automatically get access to the Mastra instance
 * when the processor is registered with an agent.
 *
 * @example
 * ```typescript
 * class MyProcessor extends BaseProcessor<'my-processor'> {
 *   readonly id = 'my-processor';
 *
 *   async processInput(args: ProcessInputArgs) {
 *     // Access Mastra services via this.mastra
 *     const knowledge = this.mastra?.getKnowledge();
 *     // ...
 *   }
 * }
 * ```
 */
export abstract class BaseProcessor<TId extends string = string, TTripwireMetadata = unknown> implements Processor<
  TId,
  TTripwireMetadata
> {
  abstract readonly id: TId;
  readonly name?: string;

  /**
   * The Mastra instance this processor is registered with.
   * Available after the processor is registered via __registerMastra.
   */
  protected mastra?: Mastra<any, any, any, any, any, any, any, any, any, any>;

  /**
   * Called when the processor is registered with a Mastra instance.
   * @internal
   */
  __registerMastra(mastra: Mastra<any, any, any, any, any, any, any, any, any, any>): void {
    this.mastra = mastra;
  }
}

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> };

// InputProcessor requires either processInput OR processInputStep (or both)
export type InputProcessor<TTripwireMetadata = unknown> =
  | (WithRequired<Processor<string, TTripwireMetadata>, 'id' | 'processInput'> & Processor<string, TTripwireMetadata>)
  | (WithRequired<Processor<string, TTripwireMetadata>, 'id' | 'processInputStep'> &
      Processor<string, TTripwireMetadata>);

// OutputProcessor requires either processOutputStream OR processOutputResult OR processOutputStep (or any combination)
export type OutputProcessor<TTripwireMetadata = unknown> =
  | (WithRequired<Processor<string, TTripwireMetadata>, 'id' | 'processOutputStream'> &
      Processor<string, TTripwireMetadata>)
  | (WithRequired<Processor<string, TTripwireMetadata>, 'id' | 'processOutputResult'> &
      Processor<string, TTripwireMetadata>)
  | (WithRequired<Processor<string, TTripwireMetadata>, 'id' | 'processOutputStep'> &
      Processor<string, TTripwireMetadata>);

export type ProcessorTypes<TTripwireMetadata = unknown> =
  | InputProcessor<TTripwireMetadata>
  | OutputProcessor<TTripwireMetadata>;

/**
 * A Workflow that can be used as a processor.
 * The workflow must accept ProcessorStepInput and return ProcessorStepOutput.
 */
export type ProcessorWorkflow = Workflow<any, any, string, any, ProcessorStepOutput, ProcessorStepOutput, any>;

/**
 * Input processor config: can be a Processor or a Workflow.
 */
export type InputProcessorOrWorkflow<TTripwireMetadata = unknown> =
  | InputProcessor<TTripwireMetadata>
  | ProcessorWorkflow;

/**
 * Output processor config: can be a Processor or a Workflow.
 */
export type OutputProcessorOrWorkflow<TTripwireMetadata = unknown> =
  | OutputProcessor<TTripwireMetadata>
  | ProcessorWorkflow;

/**
 * Type guard to check if an object is a Workflow that can be used as a processor.
 * A ProcessorWorkflow must have 'id', 'inputSchema', 'outputSchema', and 'execute' properties.
 */
export function isProcessorWorkflow(obj: unknown): obj is ProcessorWorkflow {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'id' in obj &&
    typeof (obj as any).id === 'string' &&
    'inputSchema' in obj &&
    'outputSchema' in obj &&
    'execute' in obj &&
    typeof (obj as any).execute === 'function' &&
    // Must NOT have processor-specific methods (to distinguish from Processor)
    !('processInput' in obj) &&
    !('processInputStep' in obj) &&
    !('processOutputStream' in obj) &&
    !('processOutputResult' in obj) &&
    !('processOutputStep' in obj)
  );
}

export * from './processors';
export { ProcessorState, ProcessorRunner } from './runner';
export * from './memory';
export type { TripWireOptions } from '../agent/trip-wire';
export {
  ProcessorStepSchema,
  ProcessorStepInputSchema,
  ProcessorStepOutputSchema,
  // Phase-specific schemas for UI/documentation
  ProcessorInputPhaseSchema,
  ProcessorInputStepPhaseSchema,
  ProcessorOutputStreamPhaseSchema,
  ProcessorOutputResultPhaseSchema,
  ProcessorOutputStepPhaseSchema,
  // Message schemas for UI components
  ProcessorMessageSchema,
  ProcessorMessageContentSchema,
  MessageContentSchema,
  // Part schemas for documentation/validation
  MessagePartSchema,
  TextPartSchema,
  ImagePartSchema,
  FilePartSchema,
  ToolInvocationPartSchema,
  ReasoningPartSchema,
  SourcePartSchema,
  StepStartPartSchema,
} from './step-schema';
export type {
  ProcessorStepData,
  ProcessorStepDataFlexible,
  ProcessorStepInput,
  ProcessorStepOutput,
  // Message types for UI components
  ProcessorMessage,
  MessageContent,
  MessagePart,
} from './step-schema';
