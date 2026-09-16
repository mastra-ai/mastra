import type { IDeployer } from '@mastra/core/deployer';

import { Bundler } from '../bundler';
import { DepsService } from '../services/deps.js';
import { FileService } from '../services/fs.js';

export abstract class Deployer extends Bundler implements IDeployer {
  deps: DepsService = new DepsService();

  constructor(args: { name: string }) {
    super(args.name, 'DEPLOYER');

    this.deps.__setLogger(this.logger);
  }

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve(new FileService().getExistingFiles(['.env', '.env.local', '.env.production']));
  }

  abstract deploy(outputDirectory: string): Promise<void>;
}
