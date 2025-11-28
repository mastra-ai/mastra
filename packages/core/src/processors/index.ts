import type { MessageList, MastraDBMessage } from '../agent/message-list';
import type { TracingContext } from '../observability';
import type { RequestContext } from '../request-context';
import type { ChunkType } from '../stream';

export interface Processor<TId extends string = string> {
  readonly id: TId;
  readonly name?: string;

  /**
   * Process input messages before they are sent to the LLM
   *
   * @param args.messages - The current messages being processed
   * @param args.messageList - Optional MessageList instance for managing message sources (used by memory processors)
   * @param args.abort - Function to abort processing with an optional reason
   * @param args.tracingContext - Optional tracing context for observability
   * @param args.runtimeContext - Optional runtime context with execution metadata (used by memory processors)
   *
   * @returns Either:
   *  - MessageList: The same messageList instance passed in (indicates you've mutated it)
   *  - MastraDBMessage[]: Transformed messages array (for simple transformations)
   */
  processInput?(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RequestContext;
  }): Promise<MessageList | MastraDBMessage[]> | MessageList | MastraDBMessage[];

  /**
   * Process output stream chunks with built-in state management
   * This allows processors to accumulate chunks and make decisions based on larger context
   * Return null, or undefined to skip emitting the part
   *
   * @param args.part - The current chunk being processed
   * @param args.streamParts - All chunks seen so far
   * @param args.state - Mutable state object that persists across chunks
   * @param args.abort - Function to abort processing with an optional reason
   * @param args.tracingContext - Optional tracing context for observability
   * @param args.runtimeContext - Optional runtime context with execution metadata
   * @param args.messageList - Optional MessageList instance for accessing conversation history including remembered messages
   */
  processOutputStream?(args: {
    part: ChunkType;
    streamParts: ChunkType[];
    state: Record<string, any>;
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RequestContext;
    messageList?: MessageList;
  }): Promise<ChunkType | null | undefined>;

  /**
   * Process the complete output result after streaming/generate is finished
   *
   * @param args.messages - The current messages being processed
   * @param args.messageList - Optional MessageList instance for managing message sources (used by memory processors)
   * @param args.abort - Function to abort processing with an optional reason
   * @param args.tracingContext - Optional tracing context for observability
   * @param args.runtimeContext - Optional runtime context with execution metadata (used by memory processors)
   *
   * @returns Either:
   *  - MessageList: The same messageList instance passed in (indicates you've mutated it)
   *  - MastraDBMessage[]: Transformed messages array (for simple transformations)
   */
  processOutputResult?(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RequestContext;
  }): Promise<MessageList | MastraDBMessage[]> | MessageList | MastraDBMessage[];
}

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> };

// Your stricter union types can wrap this for Agent typing:
export type InputProcessor = WithRequired<Processor, 'id' | 'processInput'> & Processor;
export type OutputProcessor =
  | (WithRequired<Processor, 'id' | 'processOutputStream'> & Processor)
  | (WithRequired<Processor, 'id' | 'processOutputResult'> & Processor);

export type ProcessorTypes = InputProcessor | OutputProcessor;

export * from './processors';
export { ProcessorState, ProcessorRunner } from './runner';
export * from './memory';
