import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileService } from '@mastra/deployer';
import { createWatcher, getWatcherInputOptions, writeTelemetryConfig, getBundlerOptions } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';
import type { RollupWatcherEvent } from 'rollup';

import { devLogger } from '../../utils/dev-logger.js';

export class DevBundler extends Bundler {
  private customEnvFile?: string;

  constructor(customEnvFile?: string) {
    super('Dev');
    this.customEnvFile = customEnvFile;
  }

  getEnvFiles(): Promise<string[]> {
    const possibleFiles = ['.env.development', '.env.local', '.env'];
    if (this.customEnvFile) {
      possibleFiles.unshift(this.customEnvFile);
    }

    try {
      const fileService = new FileService();
      const envFile = fileService.getFirstExistingFile(possibleFiles);

      return Promise.resolve([envFile]);
    } catch {
      // ignore
    }

    return Promise.resolve([]);
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const playgroundServePath = join(outputDirectory, this.outputDir, 'playground');
    await fsExtra.copy(join(dirname(__dirname), 'dist/playground'), playgroundServePath, {
      overwrite: true,
    });
  }

  async watch(
    entryFile: string,
    outputDirectory: string,
    toolsPaths: (string | string[])[],
  ): ReturnType<typeof createWatcher> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const envFiles = await this.getEnvFiles();

    let sourcemapEnabled = false;
    try {
      const bundlerOptions = await getBundlerOptions(entryFile, outputDirectory);
      sourcemapEnabled = !!bundlerOptions?.sourcemap;
    } catch (error) {
      this.logger.debug('Failed to get bundler options, sourcemap will be disabled', { error });
    }

    const inputOptions = await getWatcherInputOptions(
      entryFile,
      'node',
      {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
      { sourcemap: sourcemapEnabled },
    );
    const toolsInputOptions = await this.getToolsInputOptions(toolsPaths);

    const outputDir = join(outputDirectory, this.outputDir);
    await writeTelemetryConfig(entryFile, outputDir, this.logger);

    const mastraFolder = dirname(entryFile);
    const fileService = new FileService();
    const customInstrumentation = fileService.getFirstExistingFileOrUndefined([
      join(mastraFolder, 'instrumentation.js'),
      join(mastraFolder, 'instrumentation.ts'),
      join(mastraFolder, 'instrumentation.mjs'),
    ]);

    await this.writeInstrumentationFile(outputDir, customInstrumentation);

    await this.writePackageJson(outputDir, new Map(), {});

    const copyPublic = this.copyPublic.bind(this);

    const watcher = await createWatcher(
      {
        ...inputOptions,
        logLevel: inputOptions.logLevel === 'silent' ? 'warn' : inputOptions.logLevel,
        onwarn: warning => {
          if (warning.code === 'CIRCULAR_DEPENDENCY') {
            if (warning.ids?.[0]?.includes('node_modules')) {
              return;
            }

            this.logger.warn(`Circular dependency found:
\t${warning.message.replace('Circular dependency: ', '')}`);
          }
        },
        plugins: [
          {
            name: 'prevent-tool-double-bundling',
            enforce: 'pre', // Run this plugin first, before other plugins
            async resolveId(id: string, importer: string | undefined) {
              // Intercept #tools import and replace with a virtual module
              // This prevents tools from being bundled inline in the main bundle
              if (id === '#tools') {
                return '\0virtual:tools';
              }

              // Don't process entry points
              if (!importer) {
                return null;
              }

              // Skip processing imports from the virtual tools module or tools.mjs
              // These reference the separately bundled tool files
              if (
                importer &&
                (importer === '\0virtual:tools' || importer.endsWith('tools.mjs')) &&
                id.startsWith('./tools/')
              ) {
                return null;
              }

              // Handle relative imports to tools from source files
              // These should be externalized to prevent double bundling
              if ((id.startsWith('../tools/') || id.startsWith('./tools/')) && importer) {
                // Extract tool name from relative import
                const toolName = id.replace(/^\.\.?\/tools\//, '').replace(/\.(ts|js|mjs)$/, '');

                // Check if this matches one of our separately bundled tool entries
                for (const [toolKey, toolPath] of Object.entries(toolsInputOptions || {})) {
                  if (typeof toolPath === 'string') {
                    const toolFileName = toolPath
                      .split('/')
                      .pop()
                      ?.replace(/\.(ts|js|mjs)$/, '');

                    if (toolFileName === toolName) {
                      // Externalize to the separately bundled tool file
                      return { id: `./${toolKey}.mjs`, external: true };
                    }
                  }
                }
              }

              return null;
            },
            load(id: string) {
              // Provide content for the virtual tools module
              if (id === '\0virtual:tools') {
                // Use string concatenation to prevent Rollup from analyzing the import
                // This makes it truly dynamic and resolved at runtime
                return `
                  // Dynamically load tools at runtime
                  const toolsPath = './tools' + '.mjs';
                  let tools = [];
                  
                  // This import will be resolved at runtime, not build time
                  import(toolsPath).then(module => {
                    tools = module.tools || [];
                  }).catch(() => {
                    // Tools not loaded yet or not available
                  });
                  
                  export { tools };
                `;
              }
              return null;
            },
          },
          // @ts-ignore - types are good
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          ...inputOptions.plugins,
          {
            name: 'env-watcher',
            buildStart() {
              for (const envFile of envFiles) {
                this.addWatchFile(envFile);
              }
            },
          },
          {
            name: 'public-dir-watcher',
            buildStart() {
              this.addWatchFile(join(dirname(entryFile), 'public'));
            },
            buildEnd() {
              return copyPublic(dirname(entryFile), outputDirectory);
            },
          },
          {
            name: 'tools-watcher',
            async buildEnd() {
              // Tools.mjs is now pre-created, but we can update it here if needed
              // This ensures it's always in sync with the actual tool bundles
              const toolImports: string[] = [];
              const toolsExports: string[] = [];
              Array.from(Object.keys(toolsInputOptions || {}))
                .filter(key => key.startsWith('tools/'))
                .forEach((key, index) => {
                  const toolExport = `tool${index}`;
                  toolImports.push(`import * as ${toolExport} from './${key}.mjs';`);
                  toolsExports.push(toolExport);
                });

              await writeFile(
                join(outputDir, 'tools.mjs'),
                `${toolImports.join('\n')}\n\nexport const tools = [${toolsExports.join(', ')}]`,
              );
            },
          },
        ],
        input: {
          index: join(__dirname, 'templates', 'dev.entry.js'),
          ...toolsInputOptions,
        },
      },
      {
        dir: outputDir,
        sourcemap: sourcemapEnabled,
      },
    );

    devLogger.info('Preparing development environment...');
    return new Promise((resolve, reject) => {
      const cb = (event: RollupWatcherEvent) => {
        if (event.code === 'BUNDLE_END') {
          devLogger.success('Initial bundle complete');
          watcher.off('event', cb);
          resolve(watcher);
        }

        if (event.code === 'ERROR') {
          console.log(event);
          devLogger.error('Bundling failed - check console for details');
          watcher.off('event', cb);
          reject(event);
        }
      };

      watcher.on('event', cb);
    });
  }

  async bundle(): Promise<void> {
    // Do nothing
  }
}
