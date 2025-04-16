import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

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

  async bundle(entryFile: string, outputDirectory: string, bundleOptions?: Record<string, any>): Promise<void> {
    const { swaggerUI } = bundleOptions ?? {};
    return this._bundle(
      this.getEntry({
        swaggerUI,
      }),
      entryFile,
      outputDirectory,
    );
  }

  protected getEntry({ playground, swaggerUI }: { playground?: boolean; swaggerUI?: boolean }): string {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const template = readFileSync(join(__dirname, 'templates', 'build.entry.js'), 'utf8');
    const options = JSON.stringify({
      swaggerUI: swaggerUI ?? false,
    });
    return template.replace('__SERVER_OPTIONS__', options);
  }
}
