import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '@mastra/core/mastra';
import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import { copy } from 'fs-extra';
import { shouldSkipDotenvLoading } from '../utils.js';

export class BuildBundler extends Bundler {
  private studio: boolean;

  constructor({ studio }: { studio?: boolean } = {}) {
    super('Build');
    this.studio = studio ?? false;
    // Use 'neutral' platform for Bun to preserve Bun-specific globals, 'node' otherwise
    this.platform = process.versions?.bun ? 'neutral' : 'node';
  }

  protected async getUserBundlerOptions(
    mastraEntryFile: string,
    outputDirectory: string,
  ): Promise<NonNullable<Config['bundler']>> {
    const bundlerOptions = await super.getUserBundlerOptions(mastraEntryFile, outputDirectory);
    const configuredExternals = Array.isArray(bundlerOptions.externals) ? bundlerOptions.externals : [];

    if (bundlerOptions.externals === true || bundlerOptions.externals === false) {
      return bundlerOptions;
    }

    const dynamicPackages = [...new Set([...(bundlerOptions.dynamicPackages ?? []), ...configuredExternals])];

    return {
      ...bundlerOptions,
      externals: true,
      ...(dynamicPackages.length > 0 ? { dynamicPackages } : {}),
    };
  }

  getEnvFiles(): Promise<string[]> {
    // Skip loading .env files if MASTRA_SKIP_DOTENV is set
    if (shouldSkipDotenvLoading()) {
      return Promise.resolve([]);
    }

    return Promise.resolve(new FileService().getExistingFiles(['.env', '.env.local', '.env.production']));
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    if (this.studio) {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);

      const studioServePath = join(outputDirectory, this.outputDir, 'studio');
      await copy(join(dirname(__dirname), join('dist', 'studio')), studioServePath, {
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
    // @ts-expect-error
    import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
    import { mastra } from '#mastra';
    import { createNodeServer, getToolExports } from '#server';
    import { tools } from '#tools';

    // @ts-expect-error
    await createNodeServer(mastra, { tools: getToolExports(tools), studio: ${this.studio} });

    const storage = mastra.getStorage();
    if (storage) {
      if (!storage.disableInit) {
        storage.init();
      }
      mastra.__registerInternalWorkflow(scoreTracesWorkflow);
    }
    `;
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);
  }
}
