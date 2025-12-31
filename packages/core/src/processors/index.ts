import type { CoreMessage as CoreMessageV4 } from '@internal/ai-sdk-v4';

import type { MessageList, MastraDBMessage } from '../agent/message-list';
import type { TracingContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { ChunkType } from '../stream';

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
  /** Per-processor state that persists across all method calls within this request */
  state: Record<string, unknown>;
}

/**
 * Arguments for processOutputResult method
 */
export interface ProcessOutputResultArgs extends ProcessorMessageContext {
  /** Per-processor state that persists across all method calls within this request */
  state: Record<string, unknown>;
}

/**
 * Arguments for processInputStep method
 */
export interface ProcessInputStepArgs extends ProcessorMessageContext {
  /** The current step number (0-indexed) */
  stepNumber: number;
  /** All system messages (agent instructions, user-provided, memory) for read/modify access */
  systemMessages: CoreMessageV4[];
  /** Per-processor state that persists across all method calls within this request */
  state: Record<string, unknown>;
}

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
   *  - MessageList: The same messageList instance passed in (indicates you've mutated it)
   *  - MastraDBMessage[]: Transformed messages array (for simple transformations)
   */
  processInputStep?(args: ProcessInputStepArgs): ProcessorMessageResult;
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
