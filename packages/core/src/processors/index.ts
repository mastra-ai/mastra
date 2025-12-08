import type { LanguageModelV2, SharedV2ProviderOptions } from '@ai-sdk/provider-v5';
import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';
import type { CallSettings, StepResult, ToolChoice, ToolSet } from 'ai-v5';
import type { MessageList, MastraDBMessage } from '../agent/message-list';
import type { ModelRouterModelId } from '../llm/model';
import type { MastraLanguageModelV2, OpenAICompatibleConfig } from '../llm/model/shared.types';
import type { TracingContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { ChunkType, OutputSchema } from '../stream';
import type { StructuredOutputOptions } from './processors';

/**
 * Base context shared by all processor methods
 */
export interface ProcessorContext {
  /** Function to abort processing with an optional reason */
  abort: (reason?: string) => never;
  /** Optional tracing context for observability */
  tracingContext?: TracingContext;
  /** Optional runtime context with execution metadata */
  requestContext?: RequestContext;
}

/**
 * Context for message-based processor methods (processInput, processOutputResult, processInputStep)
 */
export interface ProcessorMessageContext extends ProcessorContext {
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
export interface ProcessInputArgs extends ProcessorMessageContext {
  /** All system messages (agent instructions, user-provided, memory) for read/modify access */
  systemMessages: CoreMessageV4[];
}

/**
 * Arguments for processOutputResult method
 */
export interface ProcessOutputResultArgs extends ProcessorMessageContext {}

/**
 * Arguments for processInputStep method
 *
 * Note: structuredOutput.schema is typed as OutputSchema (not the specific OUTPUT type) because
 * processors run in a chain and any previous processor may have modified structuredOutput.
 * The actual schema type is only known at the generate()/stream() call site.
 */
export interface ProcessInputStepArgs<TOOLS extends ToolSet = ToolSet> extends ProcessorMessageContext {
  /** The current step number (0-indexed) */
  stepNumber: number;
  steps: Array<StepResult<TOOLS>>;

  /** All system messages (agent instructions, user-provided, memory) for read/modify access */
  systemMessages: CoreMessageV4[];

  model: MastraLanguageModelV2;
  /** Current tools available for this step */
  tools?: TOOLS;
  toolChoice?: ToolChoice<TOOLS> | ToolChoice<any>;
  activeTools?: Array<keyof TOOLS>;

  providerOptions?: SharedV2ProviderOptions;
  modelSettings?: Omit<CallSettings, 'abortSignal'>;
  /**
   * Structured output configuration. The schema type is OutputSchema (not the specific OUTPUT)
   * because processors can modify it, and the actual type is only known at runtime.
   */
  structuredOutput?: StructuredOutputOptions<OutputSchema>;
}

export type RunProcessInputStepArgs<TOOLS extends ToolSet = ToolSet> = Omit<
  ProcessInputStepArgs<TOOLS>,
  'messages' | 'systemMessages' | 'abort'
>;

/**
 * Result from processInputStep method
 *
 * Note: structuredOutput.schema is typed as OutputSchema (not the specific OUTPUT type) because
 * processors can modify it dynamically, and the actual type is only known at runtime.
 */
export type ProcessInputStepResult<TOOLS extends ToolSet = ToolSet> = {
  model?: LanguageModelV2 | ModelRouterModelId | OpenAICompatibleConfig | MastraLanguageModelV2;
  toolChoice?: ToolChoice<TOOLS | any>;
  activeTools?: Array<keyof TOOLS>;

  messages?: MastraDBMessage[];
  messageList?: MessageList;
  /** Replace all system messages with these */
  systemMessages?: CoreMessageV4[];
  providerOptions?: SharedV2ProviderOptions;
  modelSettings?: Omit<CallSettings, 'abortSignal'>;
  /**
   * Structured output configuration. The schema type is OutputSchema (not the specific OUTPUT)
   * because processors can modify it, and the actual type is only known at runtime.
   */
  structuredOutput?: StructuredOutputOptions<OutputSchema>;
};

export type RunProcessInputStepResult<TOOLS extends ToolSet = ToolSet> = Omit<
  ProcessInputStepResult<TOOLS>,
  'model'
> & { model?: MastraLanguageModelV2 };

/**
 * Arguments for processOutputStream method
 */
export interface ProcessOutputStreamArgs extends ProcessorContext {
  /** The current chunk being processed */
  part: ChunkType;
  /** All chunks seen so far */
  streamParts: ChunkType[];
  /** Mutable state object that persists across chunks */
  state: Record<string, unknown>;
  /** Optional MessageList instance for accessing conversation history */
  messageList?: MessageList;
}

export interface Processor<TId extends string = string> {
  readonly id: TId;
  readonly name?: string;

  /**
   * Process input messages before they are sent to the LLM
   *
   * @returns Either:
   *  - MessageList: The same messageList instance passed in (indicates you've mutated it)
   *  - MastraDBMessage[]: Transformed messages array (for simple transformations)
   *  - { messages, systemMessages }: Object with both messages and modified system messages
   */
  processInput?(args: ProcessInputArgs): Promise<ProcessInputResult> | ProcessInputResult;

  /**
   * Process output stream chunks with built-in state management
   * This allows processors to accumulate chunks and make decisions based on larger context
   * Return null or undefined to skip emitting the part
   */
  processOutputStream?(args: ProcessOutputStreamArgs): Promise<ChunkType | null | undefined>;

  /**
   * Process the complete output result after streaming/generate is finished
   *
   * @returns Either:
   *  - MessageList: The same messageList instance passed in (indicates you've mutated it)
   *  - MastraDBMessage[]: Transformed messages array (for simple transformations)
   */
  processOutputResult?(args: ProcessOutputResultArgs): ProcessorMessageResult;

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
  processInputStep?<TOOLS extends ToolSet = ToolSet>(
    args: ProcessInputStepArgs<TOOLS>,
  ):
    | Promise<ProcessInputStepResult<TOOLS> | MessageList | MastraDBMessage[] | undefined | void>
    | ProcessInputStepResult<TOOLS>
    | MessageList
    | MastraDBMessage[]
    | void
    | undefined;
}

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> };

// InputProcessor requires either processInput OR processInputStep (or both)
export type InputProcessor =
  | (WithRequired<Processor, 'id' | 'processInput'> & Processor)
  | (WithRequired<Processor, 'id' | 'processInputStep'> & Processor);

// OutputProcessor requires either processOutputStream OR processOutputResult (or both)
export type OutputProcessor =
  | (WithRequired<Processor, 'id' | 'processOutputStream'> & Processor)
  | (WithRequired<Processor, 'id' | 'processOutputResult'> & Processor);

export type ProcessorTypes = InputProcessor | OutputProcessor;

export * from './processors';
export { ProcessorState, ProcessorRunner } from './runner';
export * from './memory';
