import { MastraBase } from '../base';
import type { Sandbox } from './types';

export abstract class MastraSandbox extends MastraBase {
  abstract createSandbox({ language }: { language: 'typescript' | 'python' }): Promise<Sandbox>;

  abstract executeCode({
    sandboxId,
    code,
    options,
  }: {
    sandboxId: string;
    code: string;
    options?: {
      argv?: string[];
      env?: Record<string, string>;
      timeout?: number;
    };
  }): Promise<any>;
}
