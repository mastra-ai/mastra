import type { MastraDBMessage } from '../agent/message-list';
import type { TracingContext } from '../observability';
import type { ChunkType } from '../stream';

export interface Processor {
  readonly id: string;
  readonly name?: string;

  /**
   * Process input messages before they are sent to the LLM
   */
  processInput?(args: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
  }): Promise<MastraDBMessage[]> | MastraDBMessage[];

  /**
   * Process output stream chunks with built-in state management
   * This allows processors to accumulate chunks and make decisions based on larger context
   * Return null, or undefined to skip emitting the part
   */
  processOutputStream?(args: {
    part: ChunkType;
    streamParts: ChunkType[];
    state: Record<string, any>;
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
  }): Promise<ChunkType | null | undefined>;

  /**
   * Process the complete output result after streaming/generate is finished
   */
  processOutputResult?(args: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
  }): Promise<MastraDBMessage[]> | MastraDBMessage[];
}

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> };

// Your stricter union types can wrap this for Agent typing:
export type InputProcessor = WithRequired<Processor, 'id' | 'processInput'> & Processor;
export type OutputProcessor =
  | (WithRequired<Processor, 'id' | 'processOutputStream'> & Processor)
  | (WithRequired<Processor, 'id' | 'processOutputResult'> & Processor);

export type ProcessorTypes = InputProcessor | OutputProcessor;

export * from './processors';
export { ProcessorState } from './runner';
