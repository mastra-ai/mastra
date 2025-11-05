import { FileService } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';

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
    import { createNodeServer, getToolExports } from '#server';
    import { tools } from '#tools';
    // @ts-ignore
    await createNodeServer(mastra, { tools: getToolExports(tools) });

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
