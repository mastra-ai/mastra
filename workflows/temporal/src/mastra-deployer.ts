import type { Config } from '@mastra/core/mastra';
import { Bundler } from '@mastra/deployer/bundler';

export class BuildBundler extends Bundler {
  constructor() {
    super('Temporal');
    this.platform = process.versions?.bun ? 'neutral' : 'node';
  }

  protected async getUserBundlerOptions(
    mastraEntryFile: string,
    outputDirectory: string,
  ): Promise<NonNullable<Config['bundler']>> {
    const bundlerOptions = await super.getUserBundlerOptions(mastraEntryFile, outputDirectory);

    return {
      ...bundlerOptions,
      externals: true,
      sourcemap: true,
    };
  }

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  protected installDependencies(): Promise<void> {
    return Promise.resolve();
  }

  protected copyPublic(): Promise<void> {
    return Promise.resolve();
  }

  writePackageJson(): Promise<void> {
    return Promise.resolve();
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    return this._bundle(entryFile, entryFile, { outputDirectory, projectRoot }, toolsPaths);
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);
  }
}
