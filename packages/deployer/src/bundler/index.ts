import { existsSync } from 'node:fs';
import { stat, writeFile } from 'node:fs/promises';
import { dirname, join, posix } from 'node:path';
import { MastraBundler } from '@mastra/core/bundler';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import type { Config } from '@mastra/core/mastra';
import virtual from '@rollup/plugin-virtual';
import * as pkg from 'empathic/package';
import fsExtra, { copy, ensureDir, readJSON, emptyDir } from 'fs-extra/esm';
import type { InputOptions, OutputOptions } from 'rollup';
import { glob } from 'tinyglobby';
import { analyzeBundle } from '../build/analyze';
import { createBundler as createBundlerUtil, getInputOptions } from '../build/bundler';
import { getBundlerOptions } from '../build/bundlerOptions';
import { getPackageRootPath } from '../build/package-info';
import type { BundlerOptions } from '../build/types';
import { getPackageName, slash, type BundlerPlatform } from '../build/utils';
import { DepsService } from '../services/deps';
import { FileService } from '../services/fs';
import { getWorkspaceInformation } from './workspaceDependencies';

export type { BundlerOptions } from '../build/types';
export type { BundlerPlatform } from '../build/utils';

export const IS_DEFAULT = Symbol('IS_DEFAULT');

export abstract class Bundler extends MastraBundler {
  protected analyzeOutputDir = '.build';
  protected outputDir = 'output';
  protected platform: BundlerPlatform = 'node';

  constructor(name: string, component: 'BUNDLER' | 'DEPLOYER' = 'BUNDLER') {
    super({ name, component });
  }

  async prepare(outputDirectory: string): Promise<void> {
    // Clean up the output directory first
    await emptyDir(outputDirectory);

    await ensureDir(join(outputDirectory, this.analyzeOutputDir));
    await ensureDir(join(outputDirectory, this.outputDir));
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
            start: 'node ./index.mjs',
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

  protected async getUserBundlerOptions(
    mastraEntryFile: string,
    outputDirectory: string,
  ): Promise<NonNullable<Config['bundler']>> {
    const defaultBundlerOptions: Config['bundler'] = {
      externals: [],
      sourcemap: false,
      transpilePackages: [],
      [IS_DEFAULT]: true,
    } as const;

    try {
      const bundlerOptions = await getBundlerOptions(mastraEntryFile, outputDirectory);

      return bundlerOptions ?? defaultBundlerOptions;
    } catch (error) {
      this.logger.debug('Failed to get bundler options, sourcemap will be disabled', { error });
    }

    return defaultBundlerOptions;
  }

  protected async analyze(entry: string | string[], mastraFile: string, outputDirectory: string) {
    return await analyzeBundle(
      ([] as string[]).concat(entry),
      mastraFile,
      {
        outputDir: join(outputDirectory, this.analyzeOutputDir),
        projectRoot: outputDirectory,
        platform: this.platform,
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
    { enableSourcemap, enableEsmShim, externals }: BundlerOptions,
  ) {
    const { workspaceRoot } = await getWorkspaceInformation({ mastraEntryFile });
    const closestPkgJson = pkg.up({ cwd: dirname(mastraEntryFile) });
    const projectRoot = closestPkgJson ? dirname(closestPkgJson) : process.cwd();

    const inputOptions: InputOptions = await getInputOptions(
      mastraEntryFile,
      analyzedBundleInfo,
      this.platform,
      {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      { sourcemap: enableSourcemap, workspaceRoot, projectRoot, enableEsmShim, externalsPreset: externals === true },
    );
    const isVirtual = serverFile.includes('\n') || existsSync(serverFile);

    const toolsInputOptions = await this.listToolsInputOptions(toolsPaths);

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

  getAllToolPaths(mastraDir: string, toolsPaths: (string | string[])[] = []): (string | string[])[] {
    // Normalize Windows paths to forward slashes for consistent handling
    const normalizedMastraDir = slash(mastraDir);

    // Prepare default tools paths with glob patterns
    const defaultToolsPath = posix.join(normalizedMastraDir, 'tools/**/*.{js,ts}');
    const defaultToolsIgnorePaths = [
      `!${posix.join(normalizedMastraDir, 'tools/**/*.{test,spec}.{js,ts}')}`,
      `!${posix.join(normalizedMastraDir, 'tools/**/__tests__/**')}`,
    ];

    // Combine default path with ignore patterns
    const defaultPaths = [defaultToolsPath, ...defaultToolsIgnorePaths];

    // If no tools paths provided, use only the default paths
    if (toolsPaths.length === 0) {
      return [defaultPaths];
    }

    // If tools paths are provided, add the default paths to ensure standard tools are always included
    return [...toolsPaths, defaultPaths];
  }

  async listToolsInputOptions(toolsPaths: (string | string[])[]) {
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
          // Normalize Windows paths to forward slashes for consistent handling
          const normalizedEntryFile = entryFile.replaceAll('\\', '/');
          inputs[`tools/${uniqueToolID}`] = normalizedEntryFile;
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
    }: {
      projectRoot: string;
      outputDirectory: string;
      enableEsmShim?: boolean;
    },
    toolsPaths: (string | string[])[] = [],
    bundleLocation: string = join(outputDirectory, this.outputDir),
  ): Promise<void> {
    const analyzeDir = join(outputDirectory, this.analyzeOutputDir);

    const bundlerOptions = await this.getUserBundlerOptions(mastraEntryFile, outputDirectory);
    const internalBundlerOptions: BundlerOptions = {
      enableSourcemap: !!bundlerOptions.sourcemap,
      externals: bundlerOptions.externals ?? [],
      enableEsmShim,
    };

    let analyzedBundleInfo;
    try {
      const resolvedToolsPaths = await this.listToolsInputOptions(toolsPaths);
      analyzedBundleInfo = await analyzeBundle(
        [serverFile, ...Object.values(resolvedToolsPaths)],
        mastraEntryFile,
        {
          outputDir: analyzeDir,
          projectRoot,
          platform: this.platform,
          bundlerOptions: internalBundlerOptions,
        },
        this.logger,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      if (error instanceof MastraError) {
        throw error;
      }

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

    const dependenciesToInstall = new Map<string, string>();
    for (const dep of analyzedBundleInfo.externalDependencies) {
      try {
        if (analyzedBundleInfo.workspaceMap.has(dep)) {
          continue;
        }

        const rootPath = await getPackageRootPath(dep);
        const pkg = await readJSON(`${rootPath}/package.json`);
        const actualPackageName = pkg.name;
        const version = pkg.version || 'latest';

        // Check if this is an npm alias (import name differs from actual package name)
        // e.g., importing "ai-v5" which resolves to package "ai"
        // or importing "@ai-sdk/openai-v5" which resolves to "@ai-sdk/openai"
        // In this case, write npm alias syntax: "ai-v5": "npm:ai@5.0.93"
        // For scoped packages, compare the full package name (e.g., @scope/pkg)
        const importName = getPackageName(dep);
        const isAlias = actualPackageName && importName !== actualPackageName;

        if (isAlias) {
          dependenciesToInstall.set(dep, `npm:${actualPackageName}@${version}`);
        } else {
          dependenciesToInstall.set(dep, version);
        }
      } catch {
        dependenciesToInstall.set(dep, 'latest');
      }
    }

    try {
      await this.writePackageJson(join(outputDirectory, this.outputDir), dependenciesToInstall);

      this.logger.info('Bundling Mastra application');

      const inputOptions: InputOptions = await this.getBundlerOptions(
        serverFile,
        mastraEntryFile,
        analyzedBundleInfo,
        toolsPaths,
        internalBundlerOptions,
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
          sourcemap: internalBundlerOptions.enableSourcemap,
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
      await this.copyDOTNPMRC({ outputDirectory, rootDir: projectRoot });

      this.logger.info('Done copying .npmrc file');

      this.logger.info('Installing dependencies');
      await this.installDependencies(outputDirectory, projectRoot);

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
    const toolsInputOptions = await this.listToolsInputOptions(toolsPaths);
    const toolsLength = Object.keys(toolsInputOptions).length;
    if (toolsLength > 0) {
      this.logger.info(`Found ${toolsLength} ${toolsLength === 1 ? 'tool' : 'tools'}`);
    }
  }
}
