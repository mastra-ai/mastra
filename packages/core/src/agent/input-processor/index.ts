import type { ProcessorMessages } from './processor-messages';

export interface InputProcessor {
  readonly name: string;
  process(args: { messages: ProcessorMessages; abort: (reason?: string) => never }): Promise<void>;
}

export function createInputProcessor(name: string, handler: InputProcessor['process']): InputProcessor {
  return {
    name,
    process: handler,
  };
}

export { ProcessorMessages } from './processor-messages';
