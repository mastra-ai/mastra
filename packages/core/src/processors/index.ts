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
   * Return null, or undefined to skip emitting the part
   */
  processOutputStream?(args: {
    part: TextStreamPart<any> | ObjectStreamPart<any>;
    streamParts: (TextStreamPart<any> | ObjectStreamPart<any>)[];
    state: Record<string, any>;
    abort: (reason?: string) => never;
  }): Promise<TextStreamPart<any> | ObjectStreamPart<any> | null | undefined>;

  /**
   * Process the complete output result after streaming/generate is finished
   */
  processOutputResult?(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
  }): Promise<MastraMessageV2[]> | MastraMessageV2[];
}

type WithRequired<T, K extends keyof T> = T & { [P in K]-?: NonNullable<T[P]> };

// Your stricter union types can wrap this for Agent typing:
export type InputProcessor = WithRequired<Processor, 'name' | 'processInput'> & Processor;
export type OutputProcessor =
  | (WithRequired<Processor, 'name' | 'processOutputStream'> & Processor)
  | (WithRequired<Processor, 'name' | 'processOutputResult'> & Processor);

export type ProcessorTypes = InputProcessor | OutputProcessor;

export * from './processors';
