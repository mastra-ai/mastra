import type { ObjectStreamPart, TextStreamPart } from 'ai';
import type { MastraMessageV2 } from '../agent/message-list';

export interface Processor {
  readonly name: string;

  /**
   * Process input messages before they are sent to the LLM
   */
  processInput?(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
  }): Promise<MastraMessageV2[]> | MastraMessageV2[];

  /**
   * Process output stream chunks with built-in state management
   * This allows processors to accumulate chunks and make decisions based on larger context
   */
  processOutputStream?(args: {
    chunk: TextStreamPart<any> | ObjectStreamPart<any>;
    allChunks: (TextStreamPart<any> | ObjectStreamPart<any>)[];
    state: Record<string, any>;
    abort: (reason?: string) => never;
  }): Promise<{
    chunk: TextStreamPart<any> | ObjectStreamPart<any>;
    shouldEmit: boolean;
  }>;

  /**
   * Process the complete output result after streaming is finished
   */
  processOutputResult?(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
  }): Promise<MastraMessageV2[]> | MastraMessageV2[];
}

// Your stricter union types can wrap this for Agent typing:
export type InputProcessor = Required<Pick<Processor, 'name' | 'processInput'>> & Processor;
export type OutputProcessor =
  | (Required<Pick<Processor, 'name' | 'processOutputStream'>> & Processor)
  | (Required<Pick<Processor, 'name' | 'processOutputResult'>> & Processor);

export type ProcessorTypes = InputProcessor | OutputProcessor;

/**
 * State management utility for stream processors
 */
export interface StreamProcessorState {
  /**
   * Get the accumulated text from all chunks processed so far
   */
  getAccumulatedText(): string;

  /**
   * Get a custom value from the processor's state
   */
  get<T>(key: string): T | undefined;

  /**
   * Set a custom value in the processor's state
   */
  set<T>(key: string, value: T): void;

  /**
   * Check if the stream has ended
   */
  isStreamEnded(): boolean;

  /**
   * Get the current chunk being processed
   */
  getCurrentChunk(): string;
}

export * from './processors';
