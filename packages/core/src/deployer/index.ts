import { MastraBundler } from '../bundler';
import type { IBundler } from '../bundler';

export interface IDeployer extends IBundler {
  deploy(outputDirectory: string): Promise<void>;
}

export abstract class MastraDeployer extends MastraBundler implements IDeployer {
  constructor({ name }: { name: string }) {
    super({ component: 'DEPLOYER', name });
  }

  abstract deploy(outputDirectory: string): Promise<void>;
}
