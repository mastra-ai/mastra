import { existsSync } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, posix, relative } from 'node:path';
import { MastraBundler } from '@mastra/core/bundler';
import { MastraError, ErrorDomain, ErrorCategory } from '@mastra/core/error';
import type { Config } from '@mastra/core/mastra';
import virtual from '@rollup/plugin-virtual';
import * as pkg from 'empathic/package';
import fsExtra, { copy, ensureDir, emptyDir, readJSON } from 'fs-extra/esm';
import type { InputOptions, OutputOptions } from 'rollup';
import { glob } from 'tinyglobby';
import { analyzeBundle } from '../build/analyze';
import { createBundler as createBundlerUtil, getInputOptions, getUnresolvedWorkspaceImport } from '../build/bundler';
import { getBundlerOptions } from '../build/bundlerOptions';
import type { BundlerOptions, ExternalDependencyInfo } from '../build/types';
import type { BundlerPlatform } from '../build/utils';
import { getPackageName, isBareModuleSpecifier, shouldSkipInstall, slash } from '../build/utils';
import { DepsService } from '../services/deps';
import { FileService } from '../services/fs';
import {
  collectTransitiveWorkspaceDependencies,
  getWorkspaceInformation,
  packWorkspaceDependencies,
} from './workspaceDependencies';

export type { BundlerOptions, ExternalDependencyInfo } from '../build/types';
export type { BundlerPlatform } from '../build/utils';

export const IS_DEFAULT = Symbol('IS_DEFAULT');

const NPM_ALIAS_PREFIX = 'npm:';
/** Characters a registry range or dist tag can contain. Protocols need `:`, git shorthand needs `/` or `#`. */
const REGISTRY_SPEC_PATTERN = /^[A-Za-z0-9.+_^~><=*|!\s-]+$/;
const PACKAGE_NAME_PATTERN = /^(?:@[A-Za-z0-9._-]+\/)?[A-Za-z0-9._-]+$/;
const TARBALL_SUFFIX_PATTERN = /\.(?:tgz|tar\.gz|tar)$/i;
/** npm reads a value starting like this as a path, whatever follows. A bare `~` is a semver range. */
const FILE_SPEC_PREFIX_PATTERN = /^(?:\.|~[/\\]|[/\\]|[A-Za-z]:[/\\])/;
/** A range admitting any published version: `*`, `x`, or `>=0`. */
const UNBOUNDED_RANGE_PATTERN = /^(?:[*xX]|>=?\s*0(?:\.0)*)$/;

/**
 * Constraints declared by the source app, plus the packages some resolution field pins.
 *
 * Only `dependencies` values are read. Override fields contribute names, never values: which of
 * `overrides`, `resolutions`, `pnpm.overrides` or `pnpm-workspace.yaml` a given install honoured
 * depends on the package manager and its version, so reproducing that precedence would mean
 * emulating three package managers. A name appearing in any of them is enough to know the resolved
 * version was chosen deliberately, which is all this needs.
 */
export type SourceDependencyConstraints = {
  dependencies: Record<string, string>;
  pinnedByResolutionField: Set<string>;
};

const toStringRecord = (value: unknown): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
};

/**
 * True when a specifier is something the isolated install in `.mastra/output` can resolve from the
 * registry: a semver range, a dist tag, a wildcard, or an npm alias whose target is a registry
 * package and range.
 *
 * This is an allowlist rather than a denylist of known protocols, so an unfamiliar protocol is
 * rejected without this code having to know it exists. The output directory is not a workspace, has
 * no catalog definitions and has a different relative-path base, so `catalog:`, `workspace:`,
 * `file:`, `link:` and git specifiers are all either uninstallable there or point somewhere else.
 */
export const isRegistryVersionSpec = (spec: string): boolean => {
  if (FILE_SPEC_PREFIX_PATTERN.test(spec) || TARBALL_SUFFIX_PATTERN.test(spec)) {
    return false;
  }

  if (spec.startsWith(NPM_ALIAS_PREFIX)) {
    const alias = spec.slice(NPM_ALIAS_PREFIX.length);
    // Skip index 0 so `npm:@scope/pkg` reads as an alias with no range rather than an empty name.
    const rangeSeparator = alias.lastIndexOf('@');
    const name = rangeSeparator > 0 ? alias.slice(0, rangeSeparator) : alias;
    const range = rangeSeparator > 0 ? alias.slice(rangeSeparator + 1) : '*';

    return PACKAGE_NAME_PATTERN.test(name) && isRegistryVersionSpec(range);
  }

  return REGISTRY_SPEC_PATTERN.test(spec);
};

/**
 * True when a specifier names a version the output install can be held to.
 *
 * A range admitting anything (`*`, `latest`, `>=0`, an alias with no range) is looser than the
 * version already resolved, so writing it would let a later install pull something the bundle was
 * never analyzed against.
 */
const isBoundedVersionSpec = (spec: string): boolean => {
  const range = spec.startsWith(NPM_ALIAS_PREFIX)
    ? (() => {
        const alias = spec.slice(NPM_ALIAS_PREFIX.length);
        const rangeSeparator = alias.lastIndexOf('@');
        return rangeSeparator > 0 ? alias.slice(rangeSeparator + 1) : '';
      })()
    : spec;

  return /\d/.test(range) && !range.split('||').some(part => UNBOUNDED_RANGE_PATTERN.test(part.trim()));
};

const readManifest = async (manifestPath: string | undefined): Promise<Record<string, unknown> | undefined> => {
  if (!manifestPath) {
    return undefined;
  }

  try {
    const manifest = await readJSON(manifestPath);
    return manifest && typeof manifest === 'object' ? manifest : undefined;
  } catch {
    // A manifest that cannot be read tells us nothing about intent.
    return undefined;
  }
};

/** Collect the package names a manifest's resolution fields pin, ignoring their values. */
const collectManifestPinnedNames = (manifest: Record<string, unknown> | undefined, pinned: Set<string>) => {
  const pnpmSection = manifest?.pnpm;
  const records = [
    manifest?.overrides,
    manifest?.resolutions,
    pnpmSection && typeof pnpmSection === 'object' ? (pnpmSection as { overrides?: unknown }).overrides : undefined,
  ];

  for (const record of records) {
    if (record && typeof record === 'object' && !Array.isArray(record)) {
      for (const key of Object.keys(record)) {
        pinned.add(key);
      }
    }
  }
};

/**
 * Collect the names under a top-level `overrides:` block in `pnpm-workspace.yaml`.
 *
 * pnpm moved overrides out of `package.json` into this file, so a workspace on a current pnpm keeps
 * them only here. Reading names off the indented block avoids a YAML dependency, the same tradeoff
 * `copyPnpmWorkspaceSettings` already makes for the top-level keys it copies.
 */
const collectPnpmWorkspacePinnedNames = (source: string, pinned: Set<string>) => {
  const lines = source.split(/\r?\n/);
  let insideOverrides = false;

  for (const line of lines) {
    if (/^\S/.test(line)) {
      insideOverrides = /^overrides:\s*$/.test(line);
      continue;
    }

    if (!insideOverrides) {
      continue;
    }

    const key = /^\s+(?:'([^']+)'|"([^"]+)"|([^'"\s:][^:]*?))\s*:/.exec(line);
    if (key) {
      pinned.add((key[1] ?? key[2] ?? key[3] ?? '').trim());
    }
  }
};

/**
 * Read the constraints the source app declared.
 *
 * `dependencies` come from the manifest at `projectRoot`, the package the build was invoked for and
 * whose directory receives the output, falling back to the manifest above the entry file. Anchoring
 * on `projectRoot` rather than the entry file keeps the answer deterministic when the entry handed
 * to the bundler is a generated wrapper rather than the app's own source file.
 *
 * Resolution-field names are collected from both that manifest and the workspace root, including the
 * root `pnpm-workspace.yaml`, because a name pinned anywhere means the resolved version may have been
 * chosen deliberately rather than hoisted by accident.
 */
export const getSourceDependencyConstraints = async ({
  projectRoot,
  mastraEntryFile,
  workspaceRoot,
}: {
  projectRoot: string;
  mastraEntryFile: string;
  workspaceRoot?: string;
}): Promise<SourceDependencyConstraints> => {
  const manifestPaths = [pkg.up({ cwd: projectRoot }), pkg.up({ cwd: dirname(mastraEntryFile) })].filter(
    (entry, index, entries): entry is string => !!entry && entries.indexOf(entry) === index,
  );

  if (workspaceRoot) {
    manifestPaths.push(join(workspaceRoot, 'package.json'));
  }

  const pinnedByResolutionField = new Set<string>();
  let dependencies: Record<string, string> | undefined;

  for (const manifestPath of manifestPaths) {
    const manifest = await readManifest(manifestPath);
    if (!manifest) {
      continue;
    }

    // Nearest manifest wins, and an empty `dependencies` record is still that package's answer.
    dependencies ??= toStringRecord(manifest.dependencies);
    collectManifestPinnedNames(manifest, pinnedByResolutionField);
  }

  if (workspaceRoot) {
    try {
      collectPnpmWorkspacePinnedNames(
        await readFile(join(workspaceRoot, 'pnpm-workspace.yaml'), 'utf-8'),
        pinnedByResolutionField,
      );
    } catch {
      // No pnpm workspace config, or unreadable: nothing to learn from it.
    }
  }

  return { dependencies: dependencies ?? {}, pinnedByResolutionField };
};

const findDeclaredConstraint = (
  constraints: SourceDependencyConstraints,
  dependencyName: string,
): string | undefined => {
  const names = [dependencyName, getPackageName(dependencyName)].filter(
    (name, index, all): name is string => !!name && all.indexOf(name) === index,
  );

  for (const name of names) {
    // A pinned package's resolved version is the deliberate answer, so leave it as `main` wrote it.
    if (constraints.pinnedByResolutionField.has(name)) {
      return undefined;
    }
  }

  for (const name of names) {
    const declared = (constraints.dependencies[name] ?? '').trim();
    if (declared && isBoundedVersionSpec(declared) && isRegistryVersionSpec(declared)) {
      return declared;
    }
  }

  return undefined;
};

/**
 * Prefer the constraint the app declared over the version resolved from `node_modules`.
 *
 * The resolved version is whatever the install happened to hoist, so an app declaring `zod: ^4.3.6`
 * next to a hoisted `zod@3.25.76` gets the hoisted version written into the output manifest and the
 * isolated install then locks it in.
 */
export const applySourceDependencyRange = (
  dependencyName: string,
  dependencyInfo: ExternalDependencyInfo,
  constraints: SourceDependencyConstraints,
): ExternalDependencyInfo => {
  const declared = findDeclaredConstraint(constraints, dependencyName);
  if (!declared) {
    return dependencyInfo;
  }

  if (declared.startsWith(NPM_ALIAS_PREFIX)) {
    return { ...dependencyInfo, packageSpec: declared };
  }

  // `packageSpec` is set only when the resolved package's own name differs from the requested one, so
  // a bare range under this key describes a different package and the resolved alias is the answer.
  if (dependencyInfo.packageSpec) {
    return dependencyInfo;
  }

  return { ...dependencyInfo, version: declared };
};

async function toolIdForEntry(relativeEntryFile: string): Promise<string> {
  const digest = Buffer.from(
    await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(relativeEntryFile)),
  ).toString('hex');
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
}

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
    dependencies: Map<string, string | ExternalDependencyInfo>,
    resolutions?: Record<string, string>,
  ) {
    this.logger.debug("Writing project's package.json");

    await ensureDir(outputDirectory);
    const pkgPath = join(outputDirectory, 'package.json');

    const dependenciesMap = new Map();
    for (const [key, value] of dependencies.entries()) {
      const dependencyValue = typeof value === 'string' ? value : (value.packageSpec ?? value.version ?? 'latest');
      if (key.startsWith('@')) {
        // Handle scoped packages (e.g. @org/package)
        const pkgChunks = key.split('/');
        dependenciesMap.set(`${pkgChunks[0]}/${pkgChunks[1]}`, dependencyValue);
      } else {
        // For non-scoped packages, take only the first part before any slash
        const pkgName = key.split('/')[0] || key;
        dependenciesMap.set(pkgName, dependencyValue);
      }
    }

    await writeFile(
      pkgPath,
      JSON.stringify(
        {
          name: 'server',
          version: '1.0.0',
          private: true,
          type: 'module',
          main: 'index.mjs',
          scripts: {
            start: 'node ./index.mjs',
          },
          dependencies: Object.fromEntries(dependenciesMap.entries()),
          ...(Object.keys(resolutions ?? {}).length > 0 && { resolutions }),
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

  protected pnpmNodeLinker?: 'hoisted';

  protected getAdditionalEntries(): Record<string, string> {
    return {};
  }

  protected async installDependencies(
    outputDirectory: string,
    rootDir = process.cwd(),
    pnpmOverrides?: Record<string, string>,
  ) {
    const deps = new DepsService(rootDir);
    deps.__setLogger(this.logger);
    const installOptions = {
      dir: join(outputDirectory, this.outputDir),
      pnpmOverrides,
      pnpmNodeLinker: this.pnpmNodeLinker,
    };

    this.logger.info('Updating dependency lockfile and installing dependencies');
    await deps.install(installOptions);
    this.logger.info('Done updating dependency lockfile and installing dependencies');
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

  /**
   * Writes the `mastra-project.json` deployment marker for Software Factory
   * projects after public assets have been copied. Verifies that the Factory
   * SPA (`factory/index.html`) exists in the output before emitting the marker.
   */
  protected async writeFactoryMarker(outputDirectory: string): Promise<void> {
    const outputDir = join(outputDirectory, this.outputDir);
    const factoryIndex = join(outputDir, 'factory', 'index.html');
    if (!existsSync(factoryIndex)) {
      throw new MastraError({
        id: 'DEPLOYER_BUNDLER_FACTORY_UI_MISSING',
        text: 'Software Factory project detected but factory/index.html was not found after copying the prebuilt Factory UI.',
        domain: ErrorDomain.DEPLOYER,
        category: ErrorCategory.SYSTEM,
      });
    }
    await writeFile(
      join(outputDir, 'mastra-project.json'),
      JSON.stringify({ schemaVersion: 1, projectType: 'factory', assets: { ui: 'factory' } }, null, 2),
    );
    this.logger.info('Wrote mastra-project.json for Software Factory project');
  }

  protected async getBundlerOptions(
    serverFile: string,
    mastraEntryFile: string,
    analyzedBundleInfo: Awaited<ReturnType<typeof analyzeBundle>>,
    toolsPaths: (string | string[])[],
    { enableSourcemap, enableMinify, enableEsmShim, externals }: BundlerOptions,
    additionalEntries: Record<string, string>,
    projectRoot: string,
  ) {
    const { workspaceRoot } = await getWorkspaceInformation({ mastraEntryFile });

    const inputOptions: InputOptions = await getInputOptions(
      mastraEntryFile,
      analyzedBundleInfo,
      this.platform,
      {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      {
        sourcemap: enableSourcemap,
        minify: enableMinify,
        workspaceRoot,
        projectRoot,
        enableEsmShim,
        externalsPreset: externals === true,
      },
    );
    const toolsInputOptions = await this.listToolsInputOptions(toolsPaths, projectRoot);
    const entryInputs: Record<string, string> = {};
    const virtualEntries: Record<string, string> = {};
    const entries = { index: serverFile, ...additionalEntries };

    for (const [name, entry] of Object.entries(entries)) {
      if (entry.includes('\n') || !existsSync(entry)) {
        const virtualId = name === 'index' ? '#entry' : `#entry-${name}`;
        entryInputs[name] = virtualId;
        virtualEntries[virtualId] = entry;
      } else {
        entryInputs[name] = entry;
      }
    }

    inputOptions.input = { ...entryInputs, ...toolsInputOptions };

    if (Object.keys(virtualEntries).length > 0) {
      if (Array.isArray(inputOptions.plugins)) {
        inputOptions.plugins.unshift(virtual(virtualEntries));
      } else {
        inputOptions.plugins = [virtual(virtualEntries)];
      }
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

  async listToolsInputOptions(toolsPaths: (string | string[])[], projectRoot: string = process.cwd()) {
    const entries = new Map<string, string>();

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
            this.logger.warn('No entry file found, skipping', { path });
            continue;
          }

          const normalizedEntryFile = entryFile.replaceAll('\\', '/');
          const relativeEntryFile = relative(projectRoot, entryFile).replaceAll('\\', '/');
          entries.set(relativeEntryFile, normalizedEntryFile);
        } else {
          this.logger.warn('Tool path does not exist, skipping', { path });
        }
      }
    }

    return Object.fromEntries(
      await Promise.all(
        [...entries.entries()]
          .sort(([first], [second]) => (first < second ? -1 : first > second ? 1 : 0))
          .map(
            async ([relativeEntryFile, entryFile]): Promise<[string, string]> => [
              `tools/${await toolIdForEntry(relativeEntryFile)}`,
              entryFile,
            ],
          ),
      ),
    );
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
    const additionalEntries = this.getAdditionalEntries();
    const closestPkgJson = pkg.up({ cwd: dirname(mastraEntryFile) });
    const entryProjectRoot = closestPkgJson ? dirname(closestPkgJson) : projectRoot;

    const bundlerOptions = await this.getUserBundlerOptions(mastraEntryFile, outputDirectory);
    const internalBundlerOptions: BundlerOptions = {
      enableSourcemap: !!bundlerOptions.sourcemap,
      enableMinify: !!bundlerOptions.minify,
      externals: bundlerOptions.externals ?? [],
      enableEsmShim,
      dynamicPackages: bundlerOptions.dynamicPackages,
    };

    let analyzedBundleInfo;
    try {
      const resolvedToolsPaths = await this.listToolsInputOptions(toolsPaths, entryProjectRoot);
      analyzedBundleInfo = await analyzeBundle(
        [serverFile, ...Object.values(additionalEntries), ...Object.values(resolvedToolsPaths)],
        mastraEntryFile,
        {
          outputDir: analyzeDir,
          projectRoot: entryProjectRoot,
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

    const { workspaceRoot } = await getWorkspaceInformation({ dir: projectRoot, mastraEntryFile });
    const sourceDependencyConstraints = await getSourceDependencyConstraints({
      projectRoot: entryProjectRoot,
      mastraEntryFile,
      workspaceRoot,
    });
    const dependenciesToInstall = new Map<string, ExternalDependencyInfo>();
    for (const [dep, depInfo] of analyzedBundleInfo.externalDependencies) {
      if (analyzedBundleInfo.workspaceMap.has(dep) || !isBareModuleSpecifier(dep)) {
        continue;
      }

      dependenciesToInstall.set(dep, applySourceDependencyRange(dep, depInfo, sourceDependencyConstraints));
    }

    const initialWorkspaceDependencies = new Set<string>();
    for (const dep of analyzedBundleInfo.dependencies.keys()) {
      const pkgName = getPackageName(dep);
      if (pkgName && analyzedBundleInfo.workspaceMap.has(pkgName)) {
        initialWorkspaceDependencies.add(pkgName);
      }
    }

    const transitiveWorkspaceDependencies = collectTransitiveWorkspaceDependencies({
      workspaceMap: analyzedBundleInfo.workspaceMap,
      initialDependencies: initialWorkspaceDependencies,
      logger: this.logger,
    });

    for (const [dep, packageSpec] of Object.entries(transitiveWorkspaceDependencies.resolutions)) {
      dependenciesToInstall.set(dep, {
        version: analyzedBundleInfo.workspaceMap.get(dep)?.version,
        packageSpec,
      });
    }

    try {
      await this.writePackageJson(
        join(outputDirectory, this.outputDir),
        dependenciesToInstall,
        transitiveWorkspaceDependencies.resolutions,
      );
      if (transitiveWorkspaceDependencies.usedWorkspacePackages.size > 0) {
        await packWorkspaceDependencies({
          workspaceMap: analyzedBundleInfo.workspaceMap,
          usedWorkspacePackages: transitiveWorkspaceDependencies.usedWorkspacePackages,
          bundleOutputDir: join(outputDirectory, this.outputDir),
          logger: this.logger,
        });
      }

      this.logger.info('Bundling Mastra application');

      const inputOptions: InputOptions = await this.getBundlerOptions(
        serverFile,
        mastraEntryFile,
        analyzedBundleInfo,
        toolsPaths,
        internalBundlerOptions,
        additionalEntries,
        entryProjectRoot,
      );

      const unresolvedWorkspaceImports: Array<{ source: string }> = [];

      const bundler = await this.createBundler(
        {
          ...inputOptions,
          logLevel: inputOptions.logLevel === 'silent' ? 'warn' : inputOptions.logLevel,
          onwarn: warning => {
            const unresolvedWorkspaceDep = getUnresolvedWorkspaceImport(
              warning as { code: string; source?: string; id?: string },
              analyzedBundleInfo.workspaceMap,
            );
            if (unresolvedWorkspaceDep) {
              unresolvedWorkspaceImports.push({ source: unresolvedWorkspaceDep });
            }

            if (warning.code === 'CIRCULAR_DEPENDENCY') {
              if (warning.ids?.[0]?.includes('node_modules')) {
                return;
              }

              this.logger.warn('Circular dependency found', {
                dependency: warning.message.replace('Circular dependency: ', ''),
              });
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

      if (unresolvedWorkspaceImports.length > 0) {
        const importList = unresolvedWorkspaceImports.map(i => `  - ${i.source}`).join('\n');
        throw new MastraError({
          id: 'DEPLOYER_BUNDLER_UNRESOLVED_WORKSPACE_IMPORT',
          text: `Workspace imports could not be resolved during bundling:\n${importList}\n\nThis means the analyzer did not capture these workspace subpath imports during the analysis phase. Try adding the package as a direct dependency of the app, or check the workspace configuration.`,
          domain: ErrorDomain.DEPLOYER,
          category: ErrorCategory.SYSTEM,
        });
      }
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

      // For Software Factory projects, write a deterministic deployment marker
      // after public assets (including the SPA) have been copied.
      if (analyzedBundleInfo.projectType === 'factory') {
        await this.writeFactoryMarker(outputDirectory);
      }

      this.logger.info('Copying .npmrc file');
      await this.copyDOTNPMRC({ outputDirectory, rootDir: projectRoot });

      this.logger.info('Done copying .npmrc file');

      if (shouldSkipInstall()) {
        this.logger.info('Skipping dependency installation (MASTRA_BUILD_SKIP_INSTALL set)');
      } else {
        await this.installDependencies(outputDirectory, projectRoot, transitiveWorkspaceDependencies.resolutions);
      }
    } catch (error) {
      if (
        error instanceof MastraError &&
        (error.id === 'DEPLOYER_BUNDLER_FACTORY_UI_MISSING' || error.id === 'DEPLOYER_PNPM_IGNORED_BUILDS')
      ) {
        throw error;
      }

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

  async lint(_entryFile: string, outputDirectory: string, toolsPaths: (string | string[])[]): Promise<void> {
    const toolsInputOptions = await this.listToolsInputOptions(toolsPaths, dirname(outputDirectory));
    const toolsLength = Object.keys(toolsInputOptions).length;
    if (toolsLength > 0) {
      this.logger.info('Found tools', { count: toolsLength });
    }
  }
}
