import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BundlerOptions } from '@mastra/core/bundler';

export class BuildBundler extends Bundler {
  constructor() {
    super('Build');
  }

  getEnvFiles(): Promise<string[]> {
    const possibleFiles = ['.env.production', '.env.local', '.env'];

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch (err) {
      // ignore
    }

    return Promise.resolve([]);
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);
  }

  bundle(entryFile: string, outputDirectory: string, options: BundlerOptions): Promise<void> {
    return this._bundle(this.getEntry(options), entryFile, outputDirectory);
  }

  protected getEntry(options: BundlerOptions): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const devEntryFile = readFileSync(join(__dirname, 'templates', 'dev.entry.js'), 'utf8');
    return `
    const options = {
      playground: ${options.playground},
      swaggerUI: ${options.swaggerUI},
      openAPI: ${options.openAPI},
    }
    ${devEntryFile}
    `;
  }
}
