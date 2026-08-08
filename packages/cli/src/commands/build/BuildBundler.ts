import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from '@mastra/core/mastra';
import { FileService } from '@mastra/deployer/build';
import { Bundler, IS_DEFAULT } from '@mastra/deployer/bundler';
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

    if (!bundlerOptions?.[IS_DEFAULT]) {
      // The `externals: true` build default only applies when no bundler config exists at
      // all, so supplying any unrelated option silently opts you out of it and flips the
      // build to bundling every dependency. Nothing else surfaces that, and the result
      // only fails later at runtime — typically on a native module that cannot be bundled.
      if (bundlerOptions?.externals === undefined) {
        this.logger.warn(
          'bundler.externals is not set, so dependencies will be bundled rather than installed. ' +
            'The externals default only applies to projects with no bundler config at all. ' +
            'Set bundler.externals explicitly to choose, e.g. `externals: true` to keep packages ' +
            'that cannot be bundled, such as native modules, out of the bundle.',
        );
      }

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
    } catch {
      // ignore
    }

    return Promise.resolve([]);
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
