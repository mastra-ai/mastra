import { FileService } from '@mastra/deployer/build';
import { Bundler, IS_DEFAULT } from '@mastra/deployer/bundler';
import type { Config } from '@mastra/core/mastra';

import { shouldSkipDotenvLoading } from '../utils.js';

export class BuildBundler extends Bundler {
  constructor() {
    super('Build');
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
    import { evaluate } from '@mastra/core/eval';
    import { AvailableHooks, registerHook } from '@mastra/core/hooks';
    import { TABLE_EVALS } from '@mastra/core/storage';
    import { scoreTracesWorkflow } from '@mastra/core/scores/scoreTraces';
    import { checkEvalStorageFields } from '@mastra/core/utils';
    import { mastra } from '#mastra';
    import { createNodeServer, getToolExports } from '#server';
    import { tools } from '#tools';
    // @ts-ignore
    await createNodeServer(mastra, { tools: getToolExports(tools) });

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

    if (mastra.getStorage()) {
      // start storage init in the background
      mastra.getStorage().init();
      mastra.__registerInternalWorkflow(scoreTracesWorkflow);
    }

    registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
      const storage = mastra.getStorage();
      if (storage) {
        // Check for required fields
        const logger = mastra?.getLogger();
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
    `;
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);
  }
}
