import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Deployer } from '@mastra/deployer';
import type { analyzeBundle } from '@mastra/deployer/analyze';
import type { BundlerOptions } from '@mastra/deployer/bundler';
import virtual from '@rollup/plugin-virtual';
import type { Unstable_RawConfig } from 'wrangler';
import { mastraInstanceWrapper } from './plugins/mastra-instance-wrapper';
import { postgresStoreInstanceChecker } from './plugins/postgres-store-instance-checker';

/** @deprecated TODO remove deprecated fields in next major version */
interface CFRoute {
  pattern: string;
  zone_name: string;
  custom_domain?: boolean;
}

/** @deprecated TODO remove deprecated fields in next major version */
interface D1DatabaseBinding {
  binding: string;
  database_name: string;
  database_id: string;
  preview_database_id?: string;
}

/** @deprecated TODO remove deprecated fields in next major version */
interface KVNamespaceBinding {
  binding: string;
  id: string;
}

export class CloudflareDeployer extends Deployer {
  constructor(
    readonly userConfig: Omit<Unstable_RawConfig, 'main'> &
      // TODO remove deprecated fields in next major version
      {
        /** @deprecated `name` instead. */
        projectName?: string;
        /** @deprecated this parameter is not used internally. */
        workerNamespace?: string;
        /** @deprecated use `d1_databases` instead. */
        d1Databases?: D1DatabaseBinding[];
        /** @deprecated use `kv_namespaces` instead. */
        kvNamespaces?: KVNamespaceBinding[];
      },
  ) {
    super({ name: 'CLOUDFLARE' });

    if (!userConfig.name && userConfig.projectName) {
      this.userConfig.name = userConfig.projectName;
    }
    if (!userConfig.d1_databases && userConfig.d1Databases) {
      this.userConfig.d1_databases = userConfig.d1Databases;
    }
    if (!userConfig.kv_namespaces && userConfig.kvNamespaces) {
      this.userConfig.kv_namespaces = userConfig.kvNamespaces;
    }
  }

  async writeFiles(outputDirectory: string): Promise<void> {
    const env = await this.loadEnvVars();
    const envsAsObject = Object.assign({}, Object.fromEntries(env.entries()), this.userConfig.env);

    const wranglerConfig: Unstable_RawConfig = {
      name: 'mastra',
      main: './index.mjs',
      compatibility_date: '2025-04-01',
      compatibility_flags: ['nodejs_compat', 'nodejs_compat_populate_process_env'],
      observability: {
        logs: {
          enabled: true,
        },
      },
      vars: envsAsObject,
      ...this.userConfig,
    };

    await writeFile(join(outputDirectory, this.outputDir, 'wrangler.json'), JSON.stringify(wranglerConfig));
  }

  private getEntry(): string {
    return `
    import '#polyfills';
    import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';

    export default {
      fetch: async (request, env, context) => {
        const { mastra } = await import('#mastra');
        const { tools } = await import('#tools');
        const {createHonoServer, getToolExports} = await import('#server');
        const _mastra = mastra();

        if (_mastra.getStorage()) {
          _mastra.__registerInternalWorkflow(scoreTracesWorkflow);
        }

        const app = await createHonoServer(_mastra, { tools: getToolExports(tools) });
        return app.fetch(request, env, context);
      }
    }
`;
  }
  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);
    await this.writeFiles(outputDirectory);
  }

  protected async getBundlerOptions(
    serverFile: string,
    mastraEntryFile: string,
    analyzedBundleInfo: Awaited<ReturnType<typeof analyzeBundle>>,
    toolsPaths: (string | string[])[],
    bundlerOptions: BundlerOptions,
  ) {
    const inputOptions = await super.getBundlerOptions(serverFile, mastraEntryFile, analyzedBundleInfo, toolsPaths, {
      ...bundlerOptions,
      enableEsmShim: false,
    });

    const hasPostgresStore = (await this.deps.checkDependencies(['@mastra/pg'])) === `ok`;

    if (Array.isArray(inputOptions.plugins)) {
      inputOptions.plugins = [
        virtual({
          '#polyfills': `
process.versions = process.versions || {};
process.versions.node = '${process.versions.node}';
      `,
        }),
        ...inputOptions.plugins,
        mastraInstanceWrapper(mastraEntryFile),
      ];

      if (hasPostgresStore) {
        inputOptions.plugins.push(postgresStoreInstanceChecker());
      }
    }

    return inputOptions;
  }

  async bundle(
    entryFile: string,
    outputDirectory: string,
    { toolsPaths, projectRoot }: { toolsPaths: (string | string[])[]; projectRoot: string },
  ): Promise<void> {
    return this._bundle(this.getEntry(), entryFile, { outputDirectory, projectRoot, enableEsmShim: false }, toolsPaths);
  }

  async deploy(): Promise<void> {
    this.logger?.info('Deploying to Cloudflare failed. Please use the Cloudflare dashboard to deploy.');
  }

  async tagWorker(): Promise<void> {
    throw new Error('tagWorker method is no longer supported. Use the Cloudflare dashboard or API directly.');
  }

  async lint(entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    await super.lint(entryFile, outputDirectory, toolsPaths);

    const hasLibsql = (await this.deps.checkDependencies(['@mastra/libsql'])) === `ok`;

    if (hasLibsql) {
      this.logger.error(
        'Cloudflare Deployer does not support @libsql/client (which may have been installed by @mastra/libsql) as a dependency. Please use Cloudflare D1 instead: @mastra/cloudflare-d1.',
      );
      process.exit(1);
    }
  }
}
