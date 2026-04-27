import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SimplePlugin } from '@temporalio/plugin';
import type { BundleOptions, WorkerOptions } from '@temporalio/worker';
import type { Compiler, Configuration } from 'webpack';
import { buildTemporalActivitiesModule, collectTemporalActivityBindings } from './transforms/activities';
import { collectTemporalWorkflowExports, resolveWorkflowEntriesSync } from './transforms/workflows';
import { WorkflowExportRegistry } from './webpack-plugin';

function getDebugOutputDir(): string {
  return path.resolve(process.cwd(), '.mastra/temporal');
}

function getGeneratedActivitiesModulePath(workflowPath: string): string {
  const extension = path.extname(workflowPath);
  const baseName = path.basename(workflowPath, extension);
  return path.join(path.dirname(workflowPath), `.${baseName}.temporal.activities.mjs`);
}

class WriteWebpackBundleDebugPlugin {
  constructor(private readonly outputDir: string) {}

  apply(compiler: Compiler): void {
    compiler.hooks.assetEmitted.tapPromise(
      'MastraTemporalWriteWebpackBundleDebugPlugin',
      async (filename, { content }) => {
        const bundleDir = path.join(this.outputDir, 'bundle');
        const targetPath = path.join(bundleDir, filename);

        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, content);
      },
    );
  }
}

export interface MastraPluginOptions {
  /** Path to the Mastra entry file that imports workflow modules. */
  src: string;
  /** Persist transformed modules and emitted workflow bundles for debugging. */
  debug?: boolean;
}

export class MastraPlugin extends SimplePlugin {
  private readonly src: string;
  private readonly debugOutputDir: string | null;
  private readonly compiledActivities = new Map<string, Promise<Record<string, unknown>>>();

  constructor({ src, debug = false }: MastraPluginOptions) {
    super({
      name: 'Mastra',
    });

    this.src = src.startsWith('file://') ? fileURLToPath(src) : src;
    this.debugOutputDir = debug ? getDebugOutputDir() : null;
  }

  private loadWorkflowActivitiesModule(workflowPath: string): Promise<Record<string, unknown>> {
    const cachedModule = this.compiledActivities.get(workflowPath);
    if (cachedModule) {
      return cachedModule;
    }

    const modulePromise = (async () => {
      const sourceText = await readFile(workflowPath, 'utf8');
      const generatedModulePath = getGeneratedActivitiesModulePath(workflowPath);
      const transformedModule = await buildTemporalActivitiesModule(sourceText, workflowPath, {
        entryFilePath: this.src,
      });

      await writeFile(generatedModulePath, transformedModule);

      const importedModule = (await import(pathToFileURL(generatedModulePath).href)) as Record<string, unknown>;
      return importedModule;
    })();

    this.compiledActivities.set(workflowPath, modulePromise);
    return modulePromise;
  }

  configureWorker(options: WorkerOptions): WorkerOptions {
    const entrySource = readFileSync(this.src, 'utf8');
    const workflowPaths = resolveWorkflowEntriesSync(entrySource, this.src);
    const generatedActivities = Object.assign({}, options.activities) as Record<string, unknown>;

    for (const workflowPath of workflowPaths) {
      const workflowSource = readFileSync(workflowPath, 'utf8');
      const activityBindings = collectTemporalActivityBindings(workflowSource, workflowPath);

      for (const binding of activityBindings) {
        if (generatedActivities[binding.stepId]) {
          continue;
        }

        generatedActivities[binding.stepId] = async (...args: unknown[]) => {
          const activityModule = await this.loadWorkflowActivitiesModule(workflowPath);
          const activity = activityModule[binding.exportName];

          if (typeof activity !== 'function') {
            throw new Error(`Unable to load activity '${binding.exportName}' from ${workflowPath}`);
          }

          return activity(...args);
        };
      }
    }

    return {
      ...options,
      workflowsPath: this.src,
      activities: generatedActivities,
    };
  }

  configureBundler(options: BundleOptions): BundleOptions {
    const require = createRequire(import.meta.url);
    const loader = require.resolve('@mastra/temporal/webpack-loader');
    const existingWebpackConfigHook = options.webpackConfigHook;
    const registry = new WorkflowExportRegistry();
    const entrySource = readFileSync(this.src, 'utf8');

    for (const workflowPath of resolveWorkflowEntriesSync(entrySource, this.src)) {
      const workflowSource = readFileSync(workflowPath, 'utf8');
      const workflowExports = collectTemporalWorkflowExports(workflowSource, workflowPath);
      registry.register(
        workflowPath,
        workflowExports.map(workflow => workflow.exportName),
      );
    }

    const webpackConfigHook = (config: Configuration): Configuration => {
      const nextConfig = existingWebpackConfigHook ? existingWebpackConfigHook(config) : config;
      const rules = nextConfig.module?.rules ?? [];
      const plugins = [...(nextConfig.plugins ?? [])];

      if (this.debugOutputDir) {
        plugins.push(new WriteWebpackBundleDebugPlugin(this.debugOutputDir));
      }

      return {
        ...nextConfig,
        module: {
          ...nextConfig.module,
          rules: [
            ...rules,
            {
              test: /\.(ts|tsx|js|jsx)$/,
              exclude: /node_modules/,
              use: {
                loader,
                options: {
                  entryFile: this.src,
                  debugOutputDir: this.debugOutputDir,
                  registry,
                },
              },
            },
          ],
        },
        plugins,
      };
    };

    return {
      ...options,
      webpackConfigHook,
    };
  }
}
