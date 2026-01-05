import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileService } from '@mastra/deployer/build';
import { Bundler, IS_DEFAULT } from '@mastra/deployer/bundler';
import type { Config } from '@mastra/core/mastra';
import { copy } from 'fs-extra';

import { shouldSkipDotenvLoading } from '../utils.js';

export class BuildBundler extends Bundler {
  private studio: boolean;

  constructor({ studio }: { studio?: boolean } = {}) {
    super('Build');
    this.studio = studio ?? false;
  }

  protected async getUserBundlerOptions(
    mastraEntryFile: string,
    outputDirectory: string,
  ): Promise<NonNullable<Config['bundler']>> {
    const bundlerOptions = await super.getUserBundlerOptions(mastraEntryFile, outputDirectory);

    if (!bundlerOptions?.[IS_DEFAULT]) {
      return bundlerOptions;
    }

    return {
      ...bundlerOptions,
      externals: true,
    };
  }

  getEnvFiles(): Promise<string[]> {
    // Skip loading .env files if MASTRA_SKIP_DOTENV is set
    if (shouldSkipDotenvLoading()) {
      return Promise.resolve([]);
    }

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

    if (this.studio) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      const playgroundServePath = join(outputDirectory, this.outputDir, 'playground');
      await copy(join(dirname(__dirname), 'dist/playground'), playgroundServePath, {
        overwrite: true,
      });
    }
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  protected getEntry(): string {
    return `
    // @ts-ignore
    import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
    import { mastra } from '#mastra';
    import { createServer, getToolExports } from '#server';
    import { tools } from '#tools';
    // @ts-ignore
    // createServer auto-detects the runtime (Bun vs Node.js) and uses the appropriate server
    await createServer(mastra, { tools: getToolExports(tools), playground: ${this.studio} });

    if (mastra.getStorage()) {
      // start storage init in the background
      mastra.getStorage().init();
      mastra.__registerInternalWorkflow(scoreTracesWorkflow);
    }
    `;
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);
  }
}
