import type { IDeployer } from '@mastra/core/deployer';

import { Deps } from '../build/deps.js';
import { FileService } from '../build/fs';
import { Bundler } from '../bundler';

export abstract class Deployer extends Bundler implements IDeployer {
  deps: Deps = new Deps();

  constructor(args: { name: string }) {
    super(args.name, 'DEPLOYER');

    this.deps.__setLogger(this.logger);
  }

  getEnvFiles(): Promise<string[]> {
    const possibleFiles = ['.env.production', '.env'];

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch {}

    return Promise.resolve([]);
  }

  abstract deploy(outputDirectory: string): Promise<void>;
}
