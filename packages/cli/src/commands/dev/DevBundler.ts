import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FileService } from '@mastra/deployer';
import { createWatcher, getWatcherInputOptions } from '@mastra/deployer/build';
import { Bundler } from '@mastra/deployer/bundler';
import * as fsExtra from 'fs-extra';
import type { InputPluginOption, RollupWatcherEvent } from 'rollup';
import { glob } from 'tinyglobby';

import { devLogger } from '../../utils/dev-logger.js';
import type { MastraPackageInfo } from '../../utils/mastra-packages.js';
import { shouldSkipDotenvLoading } from '../utils.js';

function isSourceModeEnabled() {
  return process.env.MASTRA_SOURCE_MODE === '1';
}

const SOURCE_MODE_WATCH_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.mjs']);

function shouldWatchSourceFile(fileName: string) {
  if (fileName.includes('.test.') || fileName.includes('.spec.') || fileName.includes('.mock.')) return false;
  return [...SOURCE_MODE_WATCH_EXTENSIONS].some(extension => fileName.endsWith(extension));
}

async function collectSourceFiles(directory: string): Promise<string[]> {
  if (!(await fsExtra.pathExists(directory))) return [];

  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && shouldWatchSourceFile(entry.name)) {
      files.push(entryPath);
    }
  }

  return files;
}

function packageJsonPatternsFromWorkspace(workspaceYaml: string) {
  const patterns: string[] = [];
  let inPackages = false;

  for (const line of workspaceYaml.split('\n')) {
    if (line === 'packages:') {
      inPackages = true;
      continue;
    }

    if (inPackages && line.length > 0 && !line.startsWith(' ')) {
      break;
    }

    const match = line.match(/^\s+-\s+(.+)$/);
    if (!inPackages || !match?.[1]) continue;

    const pattern = match[1].replace(/^['"]|['"]$/g, '');
    patterns.push(pattern.endsWith('/package.json') ? pattern : `${pattern}/package.json`);
  }

  return patterns;
}

async function sourceModeWorkspacePackages() {
  const workspaceRoot = process.env.MASTRA_SOURCE_MODE_WORKSPACE_ROOT;
  if (!isSourceModeEnabled() || !workspaceRoot) return new Map<string, { root: string; dependencies: string[] }>();

  const workspaceYamlPath = join(workspaceRoot, 'pnpm-workspace.yaml');
  if (!(await fsExtra.pathExists(workspaceYamlPath)))
    return new Map<string, { root: string; dependencies: string[] }>();

  const packageJsonPaths = await glob(packageJsonPatternsFromWorkspace(await readFile(workspaceYamlPath, 'utf-8')), {
    cwd: workspaceRoot,
    absolute: true,
    onlyFiles: true,
  });

  const packages = new Map<string, { root: string; dependencies: string[] }>();
  for (const packageJsonPath of packageJsonPaths) {
    const packageRoot = dirname(packageJsonPath);
    const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf-8')) as {
      name?: string;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    if (!packageJson.name) continue;

    const dependencies = Object.keys({
      ...(packageJson.dependencies ?? {}),
      ...(packageJson.devDependencies ?? {}),
    }).filter(name => name === 'mastra' || name.startsWith('@mastra/') || name.startsWith('@internal/'));

    packages.set(packageJson.name, { root: packageRoot, dependencies });
  }

  return packages;
}

async function sourceModeWatchFiles(mastraPackages: MastraPackageInfo[] = []) {
  const workspacePackages = await sourceModeWorkspacePackages();
  if (workspacePackages.size === 0 || mastraPackages.length === 0) return [];

  const selected = new Set<string>();
  const queue = mastraPackages.map(({ name }) => name);
  while (queue.length > 0) {
    const packageName = queue.shift()!;
    if (selected.has(packageName)) continue;
    const packageInfo = workspacePackages.get(packageName);
    if (!packageInfo) continue;

    selected.add(packageName);
    queue.push(...packageInfo.dependencies);
  }

  const files = await Promise.all(
    [...selected].map(packageName => collectSourceFiles(join(workspacePackages.get(packageName)!.root, 'src'))),
  );

  return [...new Set(files.flat())];
}

export class DevBundler extends Bundler {
  private customEnvFile?: string;

  constructor(customEnvFile?: string) {
    super('Dev');
    this.customEnvFile = customEnvFile;
    // Use 'neutral' platform for Bun to preserve Bun-specific globals, 'node' otherwise
    this.platform = process.versions?.bun ? 'neutral' : 'node';
  }

  getEnvFiles(): Promise<string[]> {
    // Skip loading .env files if MASTRA_SKIP_DOTENV is set
    if (shouldSkipDotenvLoading()) {
      return Promise.resolve([]);
    }

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

  private async getSourceModeStudioPath(packagedStudioPath: string): Promise<string | null> {
    try {
      const playgroundPackageJsonPath = fileURLToPath(import.meta.resolve('@internal/playground/package.json'));
      const playgroundRoot = dirname(playgroundPackageJsonPath);
      const playgroundDist = join(playgroundRoot, 'dist');

      if (await fsExtra.pathExists(join(playgroundDist, 'index.html'))) {
        return playgroundDist;
      }
    } catch {
      // ignore and fall back to packaged assets below
    }

    if (await fsExtra.pathExists(join(packagedStudioPath, 'index.html'))) {
      return packagedStudioPath;
    }

    return null;
  }

  async prepare(outputDirectory: string): Promise<void> {
    await super.prepare(outputDirectory);

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);

    const studioServePath = join(outputDirectory, this.outputDir, 'studio');
    const packagedStudioPath = join(dirname(__dirname), 'dist', 'studio');
    const studioSourcePath = isSourceModeEnabled()
      ? await this.getSourceModeStudioPath(packagedStudioPath)
      : packagedStudioPath;

    if (studioSourcePath) {
      await fsExtra.copy(studioSourcePath, studioServePath, {
        overwrite: true,
      });
      return;
    }

    await mkdir(studioServePath, { recursive: true });
    await writeFile(
      join(studioServePath, 'index.html'),
      '<!doctype html><html><head><title>Mastra</title></head><body><main>Mastra dev server running in source mode. Studio assets are unavailable because packages/playground/dist has not been built.</main></body></html>',
    );
  }

  async watch(
    entryFile: string,
    outputDirectory: string,
    toolsPaths: (string | string[])[],
    mastraPackages: MastraPackageInfo[] = [],
  ): ReturnType<typeof createWatcher> {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const packageRoot = __dirname.endsWith(`${sep}dist`) ? dirname(__dirname) : dirname(dirname(dirname(__dirname)));

    const envFiles = await this.getEnvFiles();
    const bundlerOptions = await this.getUserBundlerOptions(entryFile, outputDirectory);
    const sourcemapEnabled = !!bundlerOptions?.sourcemap;
    const sourceModeTemplatePath = join(packageRoot, 'src', 'public', 'templates', 'dev.entry.js');
    const templatePath =
      isSourceModeEnabled() && (await fsExtra.pathExists(sourceModeTemplatePath))
        ? sourceModeTemplatePath
        : join(__dirname, 'templates', 'dev.entry.js');

    const inputOptions = await getWatcherInputOptions(
      entryFile,
      this.platform,
      {
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
      },
      { sourcemap: sourcemapEnabled },
    );
    const toolsInputOptions = await this.listToolsInputOptions(toolsPaths);
    const sourceWatchFiles = isSourceModeEnabled() ? await sourceModeWatchFiles(mastraPackages) : [];

    const outputDir = join(outputDirectory, this.outputDir);

    await this.writePackageJson(outputDir, new Map(), {});

    const watcher = await createWatcher(
      {
        ...inputOptions,
        logLevel: inputOptions.logLevel === 'silent' ? 'warn' : inputOptions.logLevel,
        onwarn: warning => {
          if (warning.code === 'CIRCULAR_DEPENDENCY') {
            if (warning.ids?.[0]?.includes('node_modules')) {
              return;
            }

            this.logger.warn('Circular dependency found', {
              dependency: warning.message.replace('Circular dependency: ', ''),
            });
          }
        },
        plugins: [
          ...(inputOptions.plugins as InputPluginOption[]),
          {
            name: 'env-watcher',
            buildStart() {
              for (const envFile of envFiles) {
                this.addWatchFile(envFile);
              }
            },
          },
          ...(sourceWatchFiles.length > 0
            ? [
                {
                  name: 'mastra-source-mode-package-watcher',
                  buildStart() {
                    for (const file of sourceWatchFiles) {
                      this.addWatchFile(file);
                    }
                  },
                } satisfies InputPluginOption,
              ]
            : []),
          {
            name: 'tools-watcher',
            async buildEnd() {
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
                `${toolImports.join('\n')}

                export const tools = [${toolsExports.join(', ')}]`,
              );
            },
          },
        ],
        input: {
          index: templatePath,
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
          console.info(event);
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
