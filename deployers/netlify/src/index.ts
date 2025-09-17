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
      { outputDirectory, projectRoot },
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
    import { evaluate } from '@mastra/core/eval';
    import { AvailableHooks, registerHook } from '@mastra/core/hooks';
    import { TABLE_EVALS } from '@mastra/core/storage';
    import { checkEvalStorageFields } from '@mastra/core/utils';

    registerHook(AvailableHooks.ON_GENERATION, ({ input, output, metric, runId, agentName, instructions }) => {
      evaluate({
        agentName,
        input,
        metric,
        output,
        runId,
        globalRunId: runId,
        instructions,
      });
    });

    registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
      const storage = mastra.getStorage();
      if (storage) {
        // Check for required fields
        const logger = mastra.getLogger();
        const areFieldsValid = checkEvalStorageFields(traceObject, logger);
        if (!areFieldsValid) return;

        await storage.insert({
          tableName: TABLE_EVALS,
          record: {
            input: traceObject.input,
            output: traceObject.output,
            result: JSON.stringify(traceObject.result || {}),
            agent_name: traceObject.agentName,
            metric_name: traceObject.metricName,
            instructions: traceObject.instructions,
            test_info: null,
            global_run_id: traceObject.globalRunId,
            run_id: traceObject.runId,
            created_at: new Date().toISOString(),
          },
        });
      }
    });

    const app = await createHonoServer(mastra, { tools: getToolExports(tools) });

    export default handle(app)
`;
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);

    // Lint for netlify support
  }
}
