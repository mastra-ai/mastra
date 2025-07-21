import { MastraBase } from '../base';
import type { Sandbox } from './types';

export abstract class MastraSandbox extends MastraBase {
  abstract createSandbox(): Promise<Sandbox>;
}
