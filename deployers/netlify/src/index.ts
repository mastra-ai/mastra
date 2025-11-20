import { join } from 'path';
import process from 'process';
import { Deployer } from '@mastra/deployer';
import { DepsService } from '@mastra/deployer/services';
import { move, writeJson } from 'fs-extra/esm';

export class NetlifyDeployer extends Deployer {
  constructor() {
    super({ name: 'NETLIFY' });
    this.outputDir = join('.netlify', 'v1', 'functions', 'api');
  }

  protected async installDependencies(outputDirectory: string, rootDir = process.cwd()) {
    const deps = new DepsService(rootDir);
    deps.__setLogger(this.logger);

    await deps.install({
      dir: join(outputDirectory, this.outputDir),
      architecture: {
        os: ['linux'],
        cpu: ['x64'],
        libc: ['gnu'],
      },
    });
  }

  async deploy(): Promise<void> {
    this.logger?.info('Deploying to Netlify failed. Please use the Netlify dashboard to deploy.');
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    const result = await this._bundle(
      this.getEntry(),
      entryFile,
      { outputDirectory, projectRoot, enableEsmShim: false },
      toolsPaths,
      join(outputDirectory, this.outputDir),
    );

    await writeJson(join(outputDirectory, '.netlify', 'v1', 'config.json'), {
      redirects: [
        {
          force: true,
          from: '/*',
          to: '/.netlify/functions/api/:splat',
          status: 200,
        },
      ],
    });

    await move(join(outputDirectory, '.netlify', 'v1'), join(process.cwd(), '.netlify', 'v1'), {
      overwrite: true,
    });

    return result;
  }

  private getEntry(): string {
    return `
    import { handle } from 'hono/netlify'
    import { mastra } from '#mastra';
    import { createHonoServer, getToolExports } from '#server';
    import { tools } from '#tools';
    import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';

    if (mastra.getStorage()) {
      mastra.__registerInternalWorkflow(scoreTracesWorkflow);
    }

    const app = await createHonoServer(mastra, { tools: getToolExports(tools) });

    export default handle(app)
`;
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);

    // Lint for netlify support
  }
}
