import type { MastraDBMessage } from '../message-list';

export interface InputProcessor {
  readonly name: string;
  process(args: {
    messages: MastraDBMessage[];
    abort: (reason?: string) => never;
  }): Promise<MastraDBMessage[]> | MastraDBMessage[];
}

export * from './processors';
