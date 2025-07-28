import type { MastraMessageV2 } from '../message-list';

export interface InputProcessor {
  readonly name: string;
  process(args: {
    messages: MastraMessageV2[];
    abort: (reason?: string) => never;
  }): Promise<MastraMessageV2[]> | MastraMessageV2[];
}

export * from './processors';
