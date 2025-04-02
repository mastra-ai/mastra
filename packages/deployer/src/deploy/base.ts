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
    const possibleFiles = ['.env.production', '.env.local', '.env'];

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch {}

    return Promise.resolve([]);
  }

  abstract deploy(outputDirectory: string): Promise<void>;
}
