import { writeFile } from 'fs/promises';
import { join } from 'path';
import { Deployer } from '@mastra/deployer';
import type { analyzeBundle } from '@mastra/deployer/analyze';
import virtual from '@rollup/plugin-virtual';

interface CFRoute {
  pattern: string;
  zone_name: string;
  custom_domain?: boolean;
}

interface D1DatabaseBinding {
  binding: string;
  database_name: string;
  database_id: string;
  preview_database_id?: string;
}

interface KVNamespaceBinding {
  binding: string;
  id: string;
}

export class CloudflareDeployer extends Deployer {
  routes?: CFRoute[] = [];
  workerNamespace?: string;
  env?: Record<string, any>;
  projectName?: string;
  d1Databases?: D1DatabaseBinding[];
  kvNamespaces?: KVNamespaceBinding[];

  constructor({
    env,
    projectName = 'mastra',
    routes,
    workerNamespace,
    d1Databases,
    kvNamespaces,
  }: {
    env?: Record<string, any>;
    projectName?: string;
    routes?: CFRoute[];
    workerNamespace?: string;
    d1Databases?: D1DatabaseBinding[];
    kvNamespaces?: KVNamespaceBinding[];
  }) {
    super({ name: 'CLOUDFLARE' });

    this.projectName = projectName;
    this.routes = routes;
    this.workerNamespace = workerNamespace;

    if (env) {
      this.env = env;
    }

    if (d1Databases) this.d1Databases = d1Databases;
    if (kvNamespaces) this.kvNamespaces = kvNamespaces;
  }

  async writeFiles(outputDirectory: string): Promise<void> {
    const env = await this.loadEnvVars();
    const envsAsObject = Object.assign({}, Object.fromEntries(env.entries()), this.env);

    const cfWorkerName = this.projectName;

    const wranglerConfig: Record<string, any> = {
      name: cfWorkerName,
      main: './index.mjs',
      compatibility_date: '2025-04-01',
      compatibility_flags: ['nodejs_compat', 'nodejs_compat_populate_process_env'],
      observability: {
        logs: {
          enabled: true,
        },
      },
      vars: envsAsObject,
    };

    if (!this.workerNamespace && this.routes) {
      wranglerConfig.routes = this.routes;
    }

    if (this.d1Databases?.length) {
      wranglerConfig.d1_databases = this.d1Databases;
    }
    if (this.kvNamespaces?.length) {
      wranglerConfig.kv_namespaces = this.kvNamespaces;
    }
    await writeFile(join(outputDirectory, this.outputDir, 'wrangler.json'), JSON.stringify(wranglerConfig));
  }

  private getEntry(): string {
    return `
    import '#polyfills';
    import { mastra } from '#mastra';
    import { createHonoServer, getToolExports } from '#server';
    import { tools } from '#tools';
    import { evaluate } from '@mastra/core/eval';
    import { AvailableHooks, registerHook } from '@mastra/core/hooks';
    import { TABLE_EVALS } from '@mastra/core/storage';
    import { checkEvalStorageFields } from '@mastra/core/utils';
    import { telemetry } from '#telemetry-config';
    import { instrument } from '@microlabs/otel-cf-workers';

    globalThis.___MASTRA_TELEMETRY___ = true;

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

    const handler = async (request, env, context) => {
      const app = await createHonoServer(mastra, { tools: getToolExports(tools) });
      return app.fetch(request, env, context);
    };

    // Create config function for Cloudflare Workers telemetry
    const config = (env) => {
      const telemetryConfig = {
        service: {
          name: telemetry.serviceName || 'mastra-cloudflare-worker',
        },
      };


      // Configure export
        // Configure export
      if (telemetry.export) {
        telemetryConfig.exporter = {
          url: telemetry.export.endpoint,
          headers: telemetry.export.headers || {},
        };
      }

      return telemetryConfig;
    };

    export default telemetry.enabled !== false ? instrument({
      fetch: handler,
    }, config) : {
      fetch: handler,
    };
`;
  }
  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);
    await this.writeFiles(outputDirectory);
  }

  async getBundlerOptions(
    serverFile: string,
    mastraEntryFile: string,
    analyzedBundleInfo: Awaited<ReturnType<typeof analyzeBundle>>,
    toolsPaths: string[],
  ) {
    const inputOptions = await super.getBundlerOptions(serverFile, mastraEntryFile, analyzedBundleInfo, toolsPaths);

    if (Array.isArray(inputOptions.plugins)) {
      inputOptions.plugins = [
        virtual({
          '#polyfills': `
process.versions = process.versions || {};
process.versions.node = '${process.versions.node}';
      `,
        }),
        ...inputOptions.plugins,
      ];
    }

    return inputOptions;
  }

  async bundle(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, outputDirectory, toolsPaths);
  }

  async deploy(): Promise<void> {
    this.logger?.info('Deploying to Cloudflare failed. Please use the Cloudflare dashboard to deploy.');
  }

  async tagWorker(): Promise<void> {
    throw new Error('tagWorker method is no longer supported. Use the Cloudflare dashboard or API directly.');
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: string[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);

    const hasLibsql = (await this.deps.checkDependencies(['@mastra/libsql'])) === `ok`;

    if (hasLibsql) {
      this.logger.error(
        'Cloudflare Deployer does not support @libsql/client(which may have been installed by @mastra/libsql) as a dependency. Please use Cloudflare D1 instead @mastra/cloudflare-d1',
      );
      process.exit(1);
    }
  }
}
