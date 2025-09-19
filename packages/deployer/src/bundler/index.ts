import { existsSync } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MastraBundler } from '@mastra/core/bundler';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import virtual from '@rollup/plugin-virtual';
import * as pkg from 'empathic/package';
import fsExtra, { copy, ensureDir, readJSON, emptyDir } from 'fs-extra/esm';
import type { InputOptions, OutputOptions } from 'rollup';
import { glob } from 'tinyglobby';
import { analyzeBundle } from '../build/analyze';
import { createBundler as createBundlerUtil, getInputOptions } from '../build/bundler';
import { getBundlerOptions } from '../build/bundlerOptions';
import { writeCustomInstrumentation } from '../build/customInstrumentation';
import { writeTelemetryConfig } from '../build/telemetry';
import { getPackageRootPath } from '../build/utils';
import { DepsService } from '../services/deps';
import { FileService } from '../services/fs';
import {
  collectTransitiveWorkspaceDependencies,
  getWorkspaceInformation,
  packWorkspaceDependencies,
} from './workspaceDependencies';

export abstract class Bundler extends MastraBundler {
  protected analyzeOutputDir = '.build';
  protected outputDir = 'output';

  constructor(name: string, component: 'BUNDLER' | 'DEPLOYER' = 'BUNDLER') {
    super({ name, component });
  }

  async prepare(outputDirectory: string): Promise<void> {
    // Clean up the output directory first
    await emptyDir(outputDirectory);

    await ensureDir(join(outputDirectory, this.analyzeOutputDir));
    await ensureDir(join(outputDirectory, this.outputDir));
  }

  async writeInstrumentationFile(outputDirectory: string, customInstrumentationFile?: string) {
    const instrumentationFile = join(outputDirectory, 'instrumentation.mjs');
    const __dirname = dirname(fileURLToPath(import.meta.url));

    if (customInstrumentationFile) {
      await copy(customInstrumentationFile, instrumentationFile);
    } else {
      await copy(join(__dirname, 'templates', 'instrumentation-template.js'), instrumentationFile);
    }
  }

  async writePackageJson(
    outputDirectory: string,
    dependencies: Map<string, string>,
    resolutions?: Record<string, string>,
  ) {
    this.logger.debug(`Writing project's package.json`);

    await ensureDir(outputDirectory);
    const pkgPath = join(outputDirectory, 'package.json');

    const dependenciesMap = new Map();
    for (const [key, value] of dependencies.entries()) {
      if (key.startsWith('@')) {
        // Handle scoped packages (e.g. @org/package)
        const pkgChunks = key.split('/');
        dependenciesMap.set(`${pkgChunks[0]}/${pkgChunks[1]}`, value);
      } else {
        // For non-scoped packages, take only the first part before any slash
        const pkgName = key.split('/')[0] || key;
        dependenciesMap.set(pkgName, value);
      }
    }

    // add telemetry dependencies
    dependenciesMap.set('@opentelemetry/core', '^2.0.1');
    dependenciesMap.set('@opentelemetry/api', '^1.9.0');
    dependenciesMap.set('@opentelemetry/auto-instrumentations-node', '^0.59.0');
    dependenciesMap.set('@opentelemetry/exporter-trace-otlp-grpc', '^0.201.0');
    dependenciesMap.set('@opentelemetry/exporter-trace-otlp-http', '^0.201.0');
    dependenciesMap.set('@opentelemetry/resources', '^2.0.1');
    dependenciesMap.set('@opentelemetry/sdk-node', '^0.201.0');
    dependenciesMap.set('@opentelemetry/sdk-trace-base', '^2.0.1');
    dependenciesMap.set('@opentelemetry/semantic-conventions', '^1.33.0');
    dependenciesMap.set('@opentelemetry/instrumentation', '^0.202.0');

    await writeFile(
      pkgPath,
      JSON.stringify(
        {
          name: 'server',
          version: '1.0.0',
          description: '',
          type: 'module',
          main: 'index.mjs',
          scripts: {
            start: 'node --import=./instrumentation.mjs --import=@opentelemetry/instrumentation/hook.mjs ./index.mjs',
          },
          author: 'Mastra',
          license: 'ISC',
          dependencies: Object.fromEntries(dependenciesMap.entries()),
          ...(Object.keys(resolutions ?? {}).length > 0 && { resolutions }),
          pnpm: {
            neverBuiltDependencies: [],
          },
        },
        null,
        2,
      ),
    );
  }

  protected createBundler(inputOptions: InputOptions, outputOptions: Partial<OutputOptions> & { dir: string }) {
    return createBundlerUtil(inputOptions, outputOptions);
  }

  protected async analyze(
    entry: string | string[],
    mastraFile: string,
    outputDirectory: string,
    { enableEsmShim = true }: { enableEsmShim?: boolean } = {},
  ) {
    return await analyzeBundle(
      ([] as string[]).concat(entry),
      mastraFile,
      {
        outputDir: join(outputDirectory, this.analyzeOutputDir),
        projectRoot: outputDirectory,
        platform: 'node',
        bundlerOptions: {
          enableEsmShim,
        },
      },
      this.logger,
    );
  }

  protected async installDependencies(outputDirectory: string, rootDir = process.cwd()) {
    const deps = new DepsService(rootDir);
    deps.__setLogger(this.logger);

    await deps.install({ dir: join(outputDirectory, this.outputDir) });
  }

  protected async copyPublic(mastraDir: string, outputDirectory: string) {
    const publicDir = join(mastraDir, 'public');

    try {
      await stat(publicDir);
    } catch {
      return;
    }

    await copy(publicDir, join(outputDirectory, this.outputDir));
  }

  protected async copyDOTNPMRC({
    rootDir = process.cwd(),
    outputDirectory,
  }: {
    rootDir?: string;
    outputDirectory: string;
  }) {
    const sourceDotNpmRcPath = join(rootDir, '.npmrc');
    const targetDotNpmRcPath = join(outputDirectory, this.outputDir, '.npmrc');

    try {
      await stat(sourceDotNpmRcPath);
      await copy(sourceDotNpmRcPath, targetDotNpmRcPath);
    } catch {
      return;
    }
  }

  protected async getBundlerOptions(
    serverFile: string,
    mastraEntryFile: string,
    analyzedBundleInfo: Awaited<ReturnType<typeof analyzeBundle>>,
    toolsPaths: (string | string[])[],
    { enableSourcemap = false, enableEsmShim = true }: { enableSourcemap?: boolean; enableEsmShim?: boolean } = {},
  ) {
    const { workspaceRoot } = await getWorkspaceInformation({ mastraEntryFile });
    const closestPkgJson = pkg.up({ cwd: dirname(mastraEntryFile) });
    const projectRoot = closestPkgJson ? dirname(closestPkgJson) : process.cwd();

    const inputOptions: InputOptions = await getInputOptions(
      mastraEntryFile,
      analyzedBundleInfo,
      'node',
      {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      { sourcemap: enableSourcemap, workspaceRoot, projectRoot, enableEsmShim },
    );
    const isVirtual = serverFile.includes('\n') || existsSync(serverFile);

    const toolsInputOptions = await this.getToolsInputOptions(toolsPaths);

    if (isVirtual) {
      inputOptions.input = { index: '#entry', ...toolsInputOptions };

      if (Array.isArray(inputOptions.plugins)) {
        inputOptions.plugins.unshift(virtual({ '#entry': serverFile }));
      } else {
        inputOptions.plugins = [virtual({ '#entry': serverFile })];
      }
    } else {
      inputOptions.input = { index: serverFile, ...toolsInputOptions };
    }

    return inputOptions;
  }

  async getToolsInputOptions(toolsPaths: (string | string[])[]) {
    const inputs: Record<string, string> = {};

    for (const toolPath of toolsPaths) {
      const expandedPaths = await glob(toolPath, {
        absolute: true,
        expandDirectories: false,
      });

      for (const path of expandedPaths) {
        if (await fsExtra.pathExists(path)) {
          const fileService = new FileService();
          const entryFile = fileService.getFirstExistingFile([
            join(path, 'index.ts'),
            join(path, 'index.js'),
            path, // if path itself is a file
          ]);

          // if it doesn't exist or is a dir skip it. using a dir as a tool will crash the process
          if (!entryFile || (await stat(entryFile)).isDirectory()) {
            this.logger.warn(`No entry file found in ${path}, skipping...`);
            continue;
          }

          const uniqueToolID = crypto.randomUUID();
          inputs[`tools/${uniqueToolID}`] = entryFile;
        } else {
          this.logger.warn(`Tool path ${path} does not exist, skipping...`);
        }
      }
    }

    return inputs;
  }

  protected async _bundle(
    serverFile: string,
    mastraEntryFile: string,
    {
      projectRoot,
      outputDirectory,
      enableEsmShim = true,
    }: { projectRoot: string; outputDirectory: string; enableEsmShim?: boolean },
    toolsPaths: (string | string[])[] = [],
    bundleLocation: string = join(outputDirectory, this.outputDir),
  ): Promise<void> {
    const analyzeDir = join(outputDirectory, this.analyzeOutputDir);
    let sourcemap = false;

    try {
      const bundlerOptions = await getBundlerOptions(mastraEntryFile, analyzeDir);
      sourcemap = !!bundlerOptions?.sourcemap;
    } catch (error) {
      this.logger.debug('Failed to get bundler options, sourcemap will be disabled', { error });
    }

    let analyzedBundleInfo;
    try {
      const resolvedToolsPaths = await this.getToolsInputOptions(toolsPaths);
      analyzedBundleInfo = await analyzeBundle(
        [serverFile, ...Object.values(resolvedToolsPaths)],
        mastraEntryFile,
        {
          outputDir: analyzeDir,
          projectRoot,
          platform: 'node',
          bundlerOptions: {
            enableEsmShim,
          },
        },
        this.logger,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MastraError(
        {
          id: 'DEPLOYER_BUNDLER_ANALYZE_FAILED',
          text: `Failed to analyze Mastra application: ${message}`,
          domain: ErrorDomain.DEPLOYER,
          category: ErrorCategory.SYSTEM,
        },
        error,
      );
    }

    let externalDependencies: string[];
    try {
      const result = await writeTelemetryConfig(mastraEntryFile, join(outputDirectory, this.outputDir));

      externalDependencies = result?.externalDependencies ?? [];
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MastraError(
        {
          id: 'DEPLOYER_BUNDLER_TELEMETRY_FAILED',
          text: `Failed to write telemetry config: ${message}`,
          domain: ErrorDomain.DEPLOYER,
          category: ErrorCategory.SYSTEM,
        },
        error,
      );
    }

    const mastraFolder = dirname(mastraEntryFile);

    const fileService = new FileService();
    const customInstrumentation = fileService.getFirstExistingFileOrUndefined([
      join(mastraFolder, 'instrumentation.js'),
      join(mastraFolder, 'instrumentation.ts'),
      join(mastraFolder, 'instrumentation.mjs'),
    ]);

    try {
      if (customInstrumentation) {
        const result = await writeCustomInstrumentation(customInstrumentation, join(outputDirectory, this.outputDir), {
          sourcemap,
        });
        externalDependencies = [...externalDependencies, ...result.externalDependencies];
        await this.writeInstrumentationFile(join(outputDirectory, this.outputDir), customInstrumentation);
      } else {
        await this.writeInstrumentationFile(join(outputDirectory, this.outputDir));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MastraError(
        {
          id: 'DEPLOYER_BUNDLER_INSTRUMENTATION_FILE_FAILED',
          text: `Failed to write instrumentation file: ${message}, ${customInstrumentation ? ` Found custom instrumentation file: ${customInstrumentation}` : ''}`,
          domain: ErrorDomain.DEPLOYER,
          category: ErrorCategory.SYSTEM,
        },
        error,
      );
    }

    const dependenciesToInstall = new Map<string, string>();

    // Add extenal dependencies from telemetry file
    for (const external of externalDependencies) {
      dependenciesToInstall.set(external, 'latest');
    }

    const workspaceDependencies = new Set<string>();
    for (const dep of analyzedBundleInfo.externalDependencies) {
      try {
        if (analyzedBundleInfo.workspaceMap.has(dep)) {
          workspaceDependencies.add(dep);
          continue;
        }

        const rootPath = await getPackageRootPath(dep);
        const pkg = await readJSON(`${rootPath}/package.json`);

        dependenciesToInstall.set(dep, pkg.version);
      } catch {
        dependenciesToInstall.set(dep, 'latest');
      }
    }

    let resolutions: Record<string, string> = {};
    if (workspaceDependencies.size > 0) {
      try {
        const result = collectTransitiveWorkspaceDependencies({
          workspaceMap: analyzedBundleInfo.workspaceMap,
          initialDependencies: workspaceDependencies,
          logger: this.logger,
        });
        resolutions = result.resolutions;

        // Update dependenciesToInstall with the resolved TGZ paths
        Object.entries(resolutions).forEach(([pkgName, tgzPath]) => {
          dependenciesToInstall.set(pkgName, tgzPath);
        });

        await packWorkspaceDependencies({
          workspaceMap: analyzedBundleInfo.workspaceMap,
          usedWorkspacePackages: result.usedWorkspacePackages,
          bundleOutputDir: join(outputDirectory, this.outputDir),
          logger: this.logger,
        });
      } catch (error) {
        throw new MastraError(
          {
            id: 'DEPLOYER_BUNDLER_WORKSPACE_DEPS_FAILED',
            text: `Failed to collect and pack workspace dependencies.`,
            domain: ErrorDomain.DEPLOYER,
            category: ErrorCategory.USER,
          },
          error,
        );
      }
    }

    try {
      await this.writePackageJson(join(outputDirectory, this.outputDir), dependenciesToInstall, resolutions);

      this.logger.info('Bundling Mastra application');
      const inputOptions: InputOptions = await this.getBundlerOptions(
        serverFile,
        mastraEntryFile,
        analyzedBundleInfo,
        toolsPaths,
        { enableSourcemap: sourcemap, enableEsmShim: false },
      );

      const bundler = await this.createBundler(
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
        },
        {
          dir: bundleLocation,
          manualChunks: {
            mastra: ['#mastra'],
          },
          sourcemap,
        },
      );

      await bundler.write();
      const toolImports: string[] = [];
      const toolsExports: string[] = [];
      Array.from(Object.keys(inputOptions.input || {}))
        .filter(key => key.startsWith('tools/'))
        .forEach((key, index) => {
          const toolExport = `tool${index}`;
          toolImports.push(`import * as ${toolExport} from './${key}.mjs';`);
          toolsExports.push(toolExport);
        });

      await writeFile(
        join(bundleLocation, 'tools.mjs'),
        `${toolImports.join('\n')}

export const tools = [${toolsExports.join(', ')}]`,
      );
      this.logger.info('Bundling Mastra done');

      this.logger.info('Copying public files');
      await this.copyPublic(dirname(mastraEntryFile), outputDirectory);
      this.logger.info('Done copying public files');

      this.logger.info('Copying .npmrc file');
      await this.copyDOTNPMRC({ outputDirectory });

      this.logger.info('Done copying .npmrc file');

      this.logger.info('Installing dependencies');
      await this.installDependencies(outputDirectory);

      this.logger.info('Done installing dependencies');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new MastraError(
        {
          id: 'DEPLOYER_BUNDLER_BUNDLE_STAGE_FAILED',
          text: `Failed during bundler bundle stage: ${message}`,
          domain: ErrorDomain.DEPLOYER,
          category: ErrorCategory.SYSTEM,
        },
        error,
      );
    }
  }

  async lint(_entryFile: string, _outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    const toolsInputOptions = await this.getToolsInputOptions(toolsPaths);
    const toolsLength = Object.keys(toolsInputOptions).length;
    if (toolsLength > 0) {
      this.logger.info(`Found ${toolsLength} ${toolsLength === 1 ? 'tool' : 'tools'}`);
    }
  }
}
