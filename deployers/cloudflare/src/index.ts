import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { Deployer } from '@mastra/deployer';
import type { analyzeBundle } from '@mastra/deployer/analyze';
import type { BundlerOptions } from '@mastra/deployer/bundler';
import virtual from '@rollup/plugin-virtual';
import type { Unstable_RawConfig } from 'wrangler'; // Unstable_RawConfig is unstable, and no stable alternative exists. However, `wrangler` is a peerDep, allowing users to use latest properties.
import { mastraInstanceWrapper } from './plugins/mastra-instance-wrapper';
import { postgresStoreInstanceChecker } from './plugins/postgres-store-instance-checker';

/** @deprecated */
interface D1DatabaseBinding {
  binding: string;
  database_name: string;
  database_id: string;
  preview_database_id?: string;
}

/** @deprecated */
interface KVNamespaceBinding {
  binding: string;
  id: string;
}

export class CloudflareDeployer extends Deployer {
  readonly userConfig: Omit<Unstable_RawConfig, 'main' | '$schema'>;

  constructor(
    userConfig: Omit<Unstable_RawConfig, 'main' | '$schema'> &
      // TODO: Remove deprecated fields in next major version, and update type to just Omit<Unstable_RawConfig, 'main' | '$schema'>.
      {
        /** @deprecated Use `name` instead. */
        projectName?: string;
        /** @deprecated This parameter is not used internally. */
        workerNamespace?: string;
        /** @deprecated Use `d1_databases` instead. */
        d1Databases?: D1DatabaseBinding[];
        /** @deprecated Use `kv_namespaces` instead. */
        kvNamespaces?: KVNamespaceBinding[];
      },
  ) {
    super({ name: 'CLOUDFLARE' });

    this.userConfig = { ...userConfig };

    if (userConfig.workerNamespace) {
      console.warn('[CloudflareDeployer]: `workerNamespace` is no longer used');
    }
    if (!userConfig.name && userConfig.projectName) {
      this.userConfig.name = userConfig.projectName;
      console.warn('[CloudflareDeployer]: `projectName` is deprecated, use `name` instead');
    }
    if (!userConfig.d1_databases && userConfig.d1Databases) {
      this.userConfig.d1_databases = userConfig.d1Databases;
      console.warn('[CloudflareDeployer]: `d1Databases` is deprecated, use `d1_databases` instead');
    }
    if (!userConfig.kv_namespaces && userConfig.kvNamespaces) {
      this.userConfig.kv_namespaces = userConfig.kvNamespaces;
      console.warn('[CloudflareDeployer]: `kvNamespaces` is deprecated, use `kv_namespaces` instead');
    }
  }

  async writeFiles(outputDirectory: string): Promise<void> {
    const { vars: userVars, alias: userAlias, ...userConfig } = this.userConfig;
    const loadedEnvVars = await this.loadEnvVars();

    // Merge env vars from .env files with user-provided vars
    const envsAsObject = Object.assign({}, Object.fromEntries(loadedEnvVars.entries()), userVars);

    // Write TypeScript stub to prevent bundling the full TypeScript library (~10MB)
    // The agent-builder package dynamically imports TypeScript for code validation,
    // but gracefully falls back to basic validation when TypeScript is unavailable.
    // This stub ensures the import doesn't fail while keeping the bundle small.
    const typescriptStubPath = 'typescript-stub.mjs';
    const typescriptStub = `// Stub for TypeScript - not available at runtime in Cloudflare Workers
// The @mastra/agent-builder package will fall back to basic validation
export default {};
export const createSourceFile = () => null;
export const createProgram = () => null;
export const findConfigFile = () => null;
export const readConfigFile = () => ({ error: new Error('TypeScript not available') });
export const parseJsonConfigFileContent = () => ({ errors: [new Error('TypeScript not available')], fileNames: [], options: {} });
export const flattenDiagnosticMessageText = (message) => typeof message === 'string' ? message : message?.messageText || '';
export const ScriptTarget = { Latest: 99 };
export const ModuleKind = { ESNext: 99 };
export const JsxEmit = { ReactJSX: 4 };
export const DiagnosticCategory = { Warning: 0, Error: 1, Suggestion: 2, Message: 3 };
export const sys = {
  fileExists: () => false,
  readFile: () => undefined,
};
`;

    await writeFile(join(outputDirectory, this.outputDir, typescriptStubPath), typescriptStub);

    const wranglerConfig: Unstable_RawConfig = {
      name: 'mastra',
      compatibility_date: '2025-04-01',
      compatibility_flags: ['nodejs_compat', 'nodejs_compat_populate_process_env'],
      observability: {
        logs: {
          enabled: true,
        },
      },
      ...userConfig,
      main: './index.mjs',
      vars: envsAsObject,
      // Alias TypeScript to stub to prevent wrangler from bundling the full library
      alias: {
        typescript: `./${typescriptStubPath}`,
        ...userAlias,
      },
    };

    // TODO: Remove writing this file in the next major version, it should only be written to the root of the project
    await writeFile(join(outputDirectory, this.outputDir, 'wrangler.json'), JSON.stringify(wranglerConfig, null, 2));

    const projectRoot = join(outputDirectory, '../');
    const jsoncFilePath = join(projectRoot, 'wrangler.jsonc');
    const mainFilePath = join(outputDirectory, this.outputDir, 'index.mjs');
    const tsStubFilePath = join(outputDirectory, this.outputDir, typescriptStubPath);

    const wranglerJsoncConfig: Unstable_RawConfig & { placeholder: string } = {
      placeholder: 'PLACEHOLDER',
      $schema: './node_modules/wrangler/config-schema.json',
      ...wranglerConfig,
      main: `./${relative(projectRoot, mainFilePath)}`,
      alias: {
        ...wranglerConfig.alias,
        typescript: `./${relative(projectRoot, tsStubFilePath)}`,
      },
    };

    const jsonc = JSON.stringify(wranglerJsoncConfig, null, 2).replace(
      /"placeholder": "PLACEHOLDER",/,
      '/* This file was auto-generated through Mastra. Edit the CloudflareDeployer() instance directly. */',
    );
    await writeFile(jsoncFilePath, jsonc);
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

  /**
   * TODO: Remove this method in the next major version
   *
   * @deprecated
   */
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
