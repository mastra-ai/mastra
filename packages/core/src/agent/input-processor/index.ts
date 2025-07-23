import type { MessageList } from '../message-list';

export interface InputProcessor {
  readonly name: string;
  process(args: { messages: MessageList; abort: (reason?: string) => never }, next: () => Promise<void>): Promise<void>;
}

export function createInputProcessor(name: string, handler: InputProcessor['process']): InputProcessor {
  return {
    name,
    process: handler,
  };
}
