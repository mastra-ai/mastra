import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { Deployer } from '@mastra/deployer';
import { DepsService } from '@mastra/deployer/services';

export class NetlifyDeployer extends Deployer {
  protected scope: string;
  protected projectName: string;
  protected token: string;

  constructor({ scope, projectName, token }: { scope: string; projectName: string; token: string }) {
    super({ name: 'NETLIFY' });

    this.scope = scope;
    this.projectName = projectName;
    this.token = token;
  }

  writeFiles({ dir }: { dir: string }): void {
    if (!existsSync(join(dir, 'netlify/functions/api'))) {
      mkdirSync(join(dir, 'netlify/functions/api'), { recursive: true });
    }

    // TODO ENV KEYS
    writeFileSync(
      join(dir, 'netlify.toml'),
      `[functions]
node_bundler = "esbuild"            
directory = "netlify/functions"

[[redirects]]
force = true
from = "/*"
status = 200
to = "/.netlify/functions/api/:splat"
`,
    );
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

    this.writeFiles({ dir: join(outputDirectory, this.outputDir) });
  }

  async bundle(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    return this._bundle(
      this.getEntry(),
      entryFile,
      outputDirectory,
      toolsPaths,
      join(outputDirectory, this.outputDir, 'netlify', 'functions', 'api'),
    );
  }

  private getEntry(): string {
    return `
    import { handle } from 'hono/netlify'
    import { mastra } from '#mastra';
    import { createHonoServer } from '#server';
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

    const app = await createHonoServer(mastra);

    export default handle(app)
`;
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);

    // Lint for netlify support
  }
}
