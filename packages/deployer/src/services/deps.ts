import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MastraBase } from '@mastra/core/base';
import type { BundlerConfig } from '@mastra/core/bundler';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { readJSON, writeJSON, ensureFile } from 'fs-extra/esm';
import type { PackageJson } from 'type-fest';
import { parse, stringify } from 'yaml';

import { createChildProcessLogger } from '../deploy/log.js';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

/** Version used to pack private workspace packages whose package.json has no `version`. */
export const WORKSPACE_PLACEHOLDER_VERSION = '0.0.0';

// Write via temp file + rename so an interrupted write never leaves a truncated manifest.
async function writeManifestAtomically(manifestPath: string, contents: string, inFlight?: Set<string>) {
  const tmpPath = `${manifestPath}.${process.pid}.${Date.now()}.tmp`;
  inFlight?.add(tmpPath);
  try {
    const { mode } = await fsPromises.stat(manifestPath);
    await fsPromises.writeFile(tmpPath, contents, { mode });
    await fsPromises.chmod(tmpPath, mode);
    await fsPromises.rename(tmpPath, manifestPath);
  } catch (error) {
    await fsPromises.rm(tmpPath, { force: true });
    throw error;
  } finally {
    inFlight?.delete(tmpPath);
  }
}

/**
 * Package managers refuse to pack a manifest without a version, and pnpm/bun also
 * resolve `workspace:` ranges from the dependency's manifest. So every versionless
 * package in `dirs` gets the placeholder version for the whole of `operation`, and
 * the original manifests are restored afterwards — also on SIGINT/SIGTERM.
 */
export async function withPlaceholderVersions<T>(dirs: string[], operation: () => Promise<T>): Promise<T> {
  const acquired: string[] = [];
  try {
    for (const dir of new Set(dirs.map(dir => path.resolve(dir)))) {
      const manifestPath = path.join(dir, 'package.json');
      let lease = placeholderLeases.get(manifestPath);
      // A lease whose last owner is restoring it can't be joined; wait and start a fresh one.
      while (lease?.releasing) {
        await lease.releasing.catch(() => {});
        lease = placeholderLeases.get(manifestPath);
      }
      if (lease) {
        lease.refs++;
      } else {
        lease = { refs: 1, injected: false, ready: Promise.resolve() };
        lease.ready = injectPlaceholderVersion(manifestPath, lease);
        placeholderLeases.set(manifestPath, lease);
        installSignalHandlers();
      }
      acquired.push(manifestPath);
      await lease.ready;
    }
    return await operation();
  } finally {
    try {
      for (const manifestPath of acquired) {
        await releasePlaceholderVersion(manifestPath);
      }
    } finally {
      if (placeholderLeases.size === 0) {
        removeSignalHandlers();
      }
    }
  }
}

interface PlaceholderLease {
  refs: number;
  original?: string;
  injected: boolean;
  ready: Promise<void>;
  releasing?: Promise<void>;
}

// Shared across calls so one bundle can't restore a manifest another is still packing.
const placeholderLeases = new Map<string, PlaceholderLease>();
const inFlightTmpPaths = new Set<string>();

async function injectPlaceholderVersion(manifestPath: string, lease: PlaceholderLease) {
  const original = await fsPromises.readFile(manifestPath, 'utf-8').catch(() => undefined);
  if (original === undefined) return;
  let manifest: PackageJson;
  try {
    manifest = JSON.parse(original) as PackageJson;
  } catch (error) {
    throw new Error(`Failed to parse ${manifestPath}: ${(error as Error).message}`, { cause: error });
  }
  if (manifest.version) return;
  lease.original = original;
  // Mark before writing so a signal mid-write still restores this manifest.
  lease.injected = true;
  await writeManifestAtomically(
    manifestPath,
    JSON.stringify({ ...manifest, version: WORKSPACE_PLACEHOLDER_VERSION }, null, 2) + '\n',
    inFlightTmpPaths,
  );
}

async function releasePlaceholderVersion(manifestPath: string) {
  const lease = placeholderLeases.get(manifestPath)!;
  if (--lease.refs > 0) return;
  lease.releasing = (async () => {
    await lease.ready.catch(() => {});
    try {
      if (lease.injected) {
        await writeManifestAtomically(manifestPath, lease.original!, inFlightTmpPaths);
        lease.injected = false;
      }
    } finally {
      placeholderLeases.delete(manifestPath);
    }
  })();
  await lease.releasing;
}

function restorePlaceholderVersionsSync() {
  // Removing in-flight temp files keeps them out of later tarballs and makes any
  // pending rename fail instead of overwriting the restored manifest.
  for (const tmpPath of inFlightTmpPaths) {
    fs.rmSync(tmpPath, { force: true });
  }
  inFlightTmpPaths.clear();
  for (const [manifestPath, lease] of placeholderLeases) {
    if (lease.injected) {
      fs.writeFileSync(manifestPath, lease.original!);
      lease.injected = false;
    }
  }
}

function onPlaceholderSignal(signal: NodeJS.Signals) {
  restorePlaceholderVersionsSync();
  removeSignalHandlers();
  process.kill(process.pid, signal);
}

function installSignalHandlers() {
  if (process.listeners('SIGINT').includes(onPlaceholderSignal)) return;
  process.once('SIGINT', onPlaceholderSignal);
  process.once('SIGTERM', onPlaceholderSignal);
}

function removeSignalHandlers() {
  process.off('SIGINT', onPlaceholderSignal);
  process.off('SIGTERM', onPlaceholderSignal);
}

interface LockFileInfo {
  path: string;
  filename: string;
  packageManager: PackageManager;
}

interface ArchitectureOptions {
  os?: string[];
  cpu?: string[];
  libc?: string[];
}

interface InstallOptions extends ArchitectureOptions {
  pnpmWorkspaceSettings?: BundlerConfig['pnpmWorkspaceSettings'];
  pnpmOverrides?: Record<string, string>;
  pnpmNodeLinker?: 'hoisted';
  /** Patch key -> path relative to the output directory. */
  patchedDependencies?: Record<string, string>;
}

const PNPM_PATCHES_DIR = 'pnpm-patches';
const BUN_PATCHES_DIR = 'bun-patches';

const PNPM_CONFIG_KEYS_TO_COPY = new Set([
  'allowBuilds',
  'onlyBuiltDependencies',
  'ignoredBuiltDependencies',
  'neverBuiltDependencies',
  'minimumReleaseAge',
  'minimumReleaseAgeExclude',
  'trustPolicy',
  'trustPolicyExclude',
  'trustPolicyIgnoreAfter',
  'supportedArchitectures',
]);

// supportedArchitectures is generated from deployer architecture targets, so it can't be set explicitly.
// neverBuiltDependencies switches pnpm 10 into deny-list mode, which runs every build script it doesn't name.
const PNPM_EXPLICIT_SETTING_KEYS = new Set(
  [...PNPM_CONFIG_KEYS_TO_COPY, 'blockExoticSubdeps'].filter(
    key => key !== 'supportedArchitectures' && key !== 'neverBuiltDependencies',
  ),
);

function serializePnpmWorkspaceSettings(settings: BundlerConfig['pnpmWorkspaceSettings']) {
  // Untyped JS configs can pass undefined; treat it as omitted so the copied source setting survives.
  const definedSettings = Object.entries(settings ?? {}).filter(([, value]) => value !== undefined);
  return definedSettings.map(([key, value]) => {
    if (!PNPM_EXPLICIT_SETTING_KEYS.has(key)) {
      throw new MastraError({
        id: 'DEPLOYER_INVALID_PNPM_WORKSPACE_SETTING',
        domain: ErrorDomain.DEPLOYER,
        category: ErrorCategory.USER,
        text: `pnpm workspace setting ${JSON.stringify(key)} isn't supported in bundler.pnpmWorkspaceSettings. Supported settings: ${[...PNPM_EXPLICIT_SETTING_KEYS].join(', ')}.`,
      });
    }
    const block = stringify({ [key]: value }).trimEnd();
    validatePnpmBuildApprovals(key, block);
    return block;
  });
}

function getTopLevelYamlKey(line: string) {
  const match = /^(?!\s)([\w-]+):/.exec(line);
  return match?.[1];
}

const PNPM_IGNORED_BUILDS_ERROR = 'ERR_PNPM_IGNORED_BUILDS';

export function getPnpmIgnoredBuildPackages(output: string): string[] {
  const match = new RegExp(`\\[?${PNPM_IGNORED_BUILDS_ERROR}\\]?[^\\n]*Ignored build scripts:\\s*([^\\n]+)`).exec(
    output,
  );
  if (!match?.[1]) return [];

  return match[1]
    .split(',')
    .map(specifier => specifier.trim())
    .filter(Boolean)
    .map(specifier => {
      if (specifier.startsWith('@')) {
        const versionSeparator = specifier.indexOf('@', 1);
        return versionSeparator === -1 ? specifier : specifier.slice(0, versionSeparator);
      }
      return specifier.split('@', 1)[0]!;
    });
}

function validatePnpmBuildApprovals(key: string, block: string): void {
  if (key !== 'allowBuilds' && key !== 'onlyBuiltDependencies') return;

  let value: unknown;
  try {
    value = (parse(block) as Record<string, unknown>)[key];
  } catch (error) {
    throw new MastraError(
      {
        id: 'DEPLOYER_INVALID_PNPM_BUILD_APPROVAL_CONFIG',
        domain: ErrorDomain.DEPLOYER,
        category: ErrorCategory.USER,
        details: { key },
        text: `Invalid pnpm ${key} configuration`,
      },
      error,
    );
  }

  const invalidEntries =
    key === 'allowBuilds'
      ? value && typeof value === 'object' && !Array.isArray(value)
        ? Object.entries(value).filter(
            ([dependency, approval]) => dependency.trim().length === 0 || typeof approval !== 'boolean',
          )
        : [[key, value]]
      : Array.isArray(value) &&
          value.every(dependency => typeof dependency === 'string' && dependency.trim().length > 0)
        ? []
        : [[key, value]];

  if (invalidEntries.length === 0) return;
  const invalidEntryNames = invalidEntries.map(([entry]) => entry).join(', ');

  throw new MastraError({
    id: 'DEPLOYER_INVALID_PNPM_BUILD_APPROVAL_CONFIG',
    domain: ErrorDomain.DEPLOYER,
    category: ErrorCategory.USER,
    details: { key, invalidEntries: invalidEntryNames },
    text: `Invalid pnpm ${key} entries: ${invalidEntryNames}`,
  });
}

/**
 * Reads the `patchedDependencies` map from a pnpm workspace file. Paths are returned as declared,
 * i.e. relative to the workspace root. Returns an empty map for absent or unusable declarations.
 */
export function parsePnpmPatchedDependencies(source: string): Record<string, string> {
  let parsed: unknown;
  try {
    parsed = parse(source);
  } catch {
    return {};
  }

  const patched = (parsed as { patchedDependencies?: unknown } | null)?.patchedDependencies;
  if (!patched || typeof patched !== 'object' || Array.isArray(patched)) {
    return {};
  }

  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(patched as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim() && key.trim()) {
      result[key] = value.trim();
    }
  }

  return result;
}

export function copyPnpmWorkspaceSettings(source: string, options: InstallOptions = {}) {
  const hasArchitecture = Boolean(options.os?.length || options.cpu?.length || options.libc?.length);
  const lines = source.split(/\r?\n/);
  const customBlocks = serializePnpmWorkspaceSettings(options.pnpmWorkspaceSettings);
  const blocks: string[] = [];

  for (let index = 0; index < lines.length;) {
    const key = getTopLevelYamlKey(lines[index] ?? '');
    if (!key) {
      index += 1;
      continue;
    }

    const start = index;
    index += 1;
    while (index < lines.length && !getTopLevelYamlKey(lines[index] ?? '')) {
      index += 1;
    }

    if (
      !PNPM_CONFIG_KEYS_TO_COPY.has(key) ||
      options.pnpmWorkspaceSettings?.[key] !== undefined ||
      (key === 'supportedArchitectures' && hasArchitecture)
    ) {
      continue;
    }

    const block = lines.slice(start, index).join('\n').trimEnd();
    if (block) {
      validatePnpmBuildApprovals(key, block);
      blocks.push(block);
    }
  }

  if (hasArchitecture) {
    const architectureBlock = ['supportedArchitectures:'];
    if (options.os?.length) {
      architectureBlock.push(`  os: ${JSON.stringify(options.os)}`);
    }
    if (options.cpu?.length) {
      architectureBlock.push(`  cpu: ${JSON.stringify(options.cpu)}`);
    }
    if (options.libc?.length) {
      architectureBlock.push(`  libc: ${JSON.stringify(options.libc)}`);
    }
    blocks.push(architectureBlock.join('\n'));
  }

  if (options.pnpmOverrides && Object.keys(options.pnpmOverrides).length > 0) {
    blocks.push(
      [
        'overrides:',
        ...Object.entries(options.pnpmOverrides).map(
          ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`,
        ),
      ].join('\n'),
    );
  }

  if (options.patchedDependencies && Object.keys(options.patchedDependencies).length > 0) {
    blocks.push(
      [
        'patchedDependencies:',
        ...Object.entries(options.patchedDependencies).map(
          ([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`,
        ),
      ].join('\n'),
    );
    // The bundled output only installs runtime dependencies, so patches declared for
    // dev-only or bundled-away packages are legitimately unused here.
    blocks.push('allowUnusedPatches: true');
  }

  if (options.pnpmNodeLinker) {
    blocks.push(`nodeLinker: ${options.pnpmNodeLinker}`);
  }

  return ["packages:\n  - '.'", ...blocks, ...customBlocks].join('\n\n') + '\n';
}

// Semver characters only; versions are interpolated into a shell command.
const SAFE_PACKAGE_VERSION = /^[0-9A-Za-z.+-]+$/;

/**
 * Yarn classic writes `# yarn lockfile v1` within the first two lines; Berry lockfiles never contain it.
 * Only the head of the file is read so large monorepo lockfiles are never loaded into memory.
 */
async function isYarnClassicLockfile(lockfilePath: string): Promise<boolean> {
  const handle = await fsPromises.open(lockfilePath, 'r');
  try {
    const buffer = Buffer.alloc(512);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return /^# yarn lockfile v1\r?$/m.test(buffer.toString('utf-8', 0, bytesRead));
  } finally {
    await handle.close();
  }
}

export class Deps extends MastraBase {
  private packageManager: PackageManager;
  private rootDir: string;
  private lockFile: LockFileInfo | null;

  constructor(rootDir = process.cwd()) {
    super({ component: 'DEPLOYER', name: 'DEPS' });

    this.rootDir = rootDir;
    this.lockFile = this.findLockFile(rootDir);
    this.packageManager = this.lockFile?.packageManager ?? 'npm';
  }

  private findLockFile(dir: string): LockFileInfo | null {
    const lockFiles: Array<{ filename: string; packageManager: PackageManager }> = [
      { filename: 'pnpm-lock.yaml', packageManager: 'pnpm' },
      { filename: 'package-lock.json', packageManager: 'npm' },
      { filename: 'yarn.lock', packageManager: 'yarn' },
      { filename: 'bun.lock', packageManager: 'bun' },
    ];
    for (const lockFile of lockFiles) {
      const lockFilePath = path.join(dir, lockFile.filename);
      if (fs.existsSync(lockFilePath)) {
        return { ...lockFile, path: lockFilePath };
      }
    }
    const parentDir = path.resolve(dir, '..');
    if (parentDir !== dir) {
      return this.findLockFile(parentDir);
    }
    return null;
  }

  public getWorkspaceDependencyPath({ pkgName, version }: { pkgName: string; version: string }) {
    return `file:./workspace-module/${pkgName}-${version}.tgz`;
  }

  public async pack({
    dir,
    destination,
    sanitizedName,
    version,
  }: {
    dir: string;
    destination: string;
    sanitizedName: string;
    version: string;
  }) {
    const cpLogger = createChildProcessLogger({
      logger: this.logger,
      root: dir,
    });

    let packCmd = 'pack';
    let destinationFlag = `--pack-destination ${destination}`;
    if (this.packageManager === 'yarn') {
      if (this.lockFile && (await isYarnClassicLockfile(this.lockFile.path))) {
        if (!SAFE_PACKAGE_VERSION.test(version)) {
          throw new MastraError({
            id: 'DEPLOYER_INVALID_WORKSPACE_PACKAGE_VERSION',
            domain: ErrorDomain.DEPLOYER,
            category: ErrorCategory.USER,
            details: { dir, version: String(version) },
            text: `Invalid version ${JSON.stringify(version)} in workspace package at ${dir}`,
          });
        }
        // Yarn classic has no --out/%v; --filename takes the full output path.
        destinationFlag = `--filename ${destination}/${sanitizedName}-${version}.tgz`;
      } else {
        // %s includes an '@' at the start of packages names with an '@'
        // so we need to use our sanitizedName instead.
        destinationFlag = `--out ${destination}/${sanitizedName}-%v.tgz`;
      }
    }
    if (this.packageManager === 'bun') {
      // bun uses `pm pack` instead of `pack`
      packCmd = 'pm pack';
      // bun uses --destination instead of --pack-destination
      destinationFlag = `--destination ${destination}`;
    }

    return cpLogger({
      cmd: `${this.packageManager} ${packCmd} ${destinationFlag}`,
      args: [],
      env: {
        PATH: process.env.PATH!,
      },
    });
  }

  private findPnpmWorkspaceFile(dir: string): string | null {
    const workspaceYamlPath = path.join(dir, 'pnpm-workspace.yaml');
    if (fs.existsSync(workspaceYamlPath)) {
      return workspaceYamlPath;
    }

    const parentDir = path.resolve(dir, '..');
    if (parentDir !== dir) {
      return this.findPnpmWorkspaceFile(parentDir);
    }

    return null;
  }

  private async writePnpmConfig(dir: string, options: InstallOptions = {}) {
    const sourceWorkspaceYamlPath = this.findPnpmWorkspaceFile(this.rootDir);
    const sourceWorkspaceYaml = sourceWorkspaceYamlPath
      ? await fsPromises.readFile(sourceWorkspaceYamlPath, 'utf-8')
      : '';

    const patchedDependencies = sourceWorkspaceYamlPath
      ? await this.copyPnpmPatches(sourceWorkspaceYaml, path.dirname(sourceWorkspaceYamlPath), dir)
      : undefined;

    await fsPromises.writeFile(
      path.join(dir, 'pnpm-workspace.yaml'),
      copyPnpmWorkspaceSettings(sourceWorkspaceYaml, { ...options, patchedDependencies }),
      'utf-8',
    );
  }

  /**
   * Resolves a declared patch path against the source workspace and verifies that, once symlinks
   * are followed, it still resolves inside the workspace. Returns the real path to copy from, or
   * `undefined` when the patch escapes the workspace or its file cannot be resolved.
   */
  private async resolvePatchSource(
    resolvedWorkspaceRoot: string,
    declaredPath: string,
    { key, label }: { key: string; label: string },
  ): Promise<string | undefined> {
    const sourcePath = path.resolve(resolvedWorkspaceRoot, declaredPath);
    if (!sourcePath.startsWith(`${resolvedWorkspaceRoot}${path.sep}`)) {
      this.logger.warn(`Skipping ${label} patch for "${key}": patch file is outside the workspace at ${sourcePath}`);
      return undefined;
    }

    // A patch path can stay lexically under the workspace while traversing a symlink whose target
    // lives outside it. copyFile follows symlinks, so compare the resolved real paths before copying.
    let realWorkspaceRoot: string;
    let realSourcePath: string;
    try {
      [realWorkspaceRoot, realSourcePath] = await Promise.all([
        fsPromises.realpath(resolvedWorkspaceRoot),
        fsPromises.realpath(sourcePath),
      ]);
    } catch {
      this.logger.warn(`Skipping ${label} patch for "${key}": patch file not found at ${sourcePath}`);
      return undefined;
    }

    if (!realSourcePath.startsWith(`${realWorkspaceRoot}${path.sep}`)) {
      this.logger.warn(
        `Skipping ${label} patch for "${key}": patch file is outside the workspace at ${realSourcePath}`,
      );
      return undefined;
    }

    return realSourcePath;
  }

  /**
   * Copies the patch files declared by the source workspace into the output directory and returns
   * the patch map rewritten to output-relative paths, so the patches survive the output install.
   */
  private async copyPnpmPatches(
    sourceWorkspaceYaml: string,
    sourceWorkspaceRoot: string,
    dir: string,
  ): Promise<Record<string, string>> {
    const declared = parsePnpmPatchedDependencies(sourceWorkspaceYaml);
    const rewritten: Record<string, string> = {};
    const usedFileNames = new Set<string>();
    const resolvedWorkspaceRoot = path.resolve(sourceWorkspaceRoot);

    for (const [key, declaredPath] of Object.entries(declared)) {
      const sourcePath = await this.resolvePatchSource(resolvedWorkspaceRoot, declaredPath, {
        key,
        label: 'pnpm',
      });
      if (!sourcePath) continue;

      let fileName = path.basename(sourcePath);
      if (usedFileNames.has(fileName)) {
        fileName = `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}-${fileName}`;
      }
      usedFileNames.add(fileName);

      await fsPromises.mkdir(path.join(dir, PNPM_PATCHES_DIR), { recursive: true });
      await fsPromises.copyFile(sourcePath, path.join(dir, PNPM_PATCHES_DIR, fileName));
      rewritten[key] = `${PNPM_PATCHES_DIR}/${fileName}`;
    }

    return rewritten;
  }

  /**
   * Writes the `.yarnrc.yml` for the bundled output, recording the supported architectures so the
   * output install only resolves optional native binaries that match the deployment target.
   */
  private async writeYarnConfig(dir: string, options: ArchitectureOptions) {
    const yarnrcPath = path.join(dir, '.yarnrc.yml');
    const config = {
      supportedArchitectures: {
        cpu: options.cpu || [],
        os: options.os || [],
        libc: options.libc || [],
      },
    };

    await fsPromises.writeFile(
      yarnrcPath,
      `supportedArchitectures:\n${Object.entries(config.supportedArchitectures)
        .map(([key, value]) => `  ${key}: ${JSON.stringify(value)}`)
        .join('\n')}`,
    );
  }

  /**
   * Copies the source workspace's `.yarn/patches/` directory (Yarn Berry) into the output
   * directory so patches survive the output install. Yarn auto-discovers patches from this
   * directory and applies them per the lockfile references.
   */
  private async copyYarnPatches(dir: string): Promise<void> {
    const sourcePatchesDir = path.join(this.rootDir, '.yarn', 'patches');
    if (!fs.existsSync(sourcePatchesDir)) return;

    const outputPatchesDir = path.join(dir, '.yarn', 'patches');
    await fsPromises.cp(sourcePatchesDir, outputPatchesDir, { recursive: true, errorOnExist: false });
  }

  /**
   * Copies the patch files referenced by the source workspace's `patchedDependencies` in
   * package.json into the output directory and returns the map rewritten to output-relative
   * paths, so bun patches survive the output install.
   */
  private async copyBunPatches(
    declared: Record<string, string>,
    sourceRoot: string,
    dir: string,
  ): Promise<Record<string, string>> {
    const rewritten: Record<string, string> = {};
    const usedFileNames = new Set<string>();
    const resolvedRoot = path.resolve(sourceRoot);

    for (const [key, declaredPath] of Object.entries(declared)) {
      const sourcePath = await this.resolvePatchSource(resolvedRoot, declaredPath, {
        key,
        label: 'bun',
      });
      if (!sourcePath) continue;

      let fileName = path.basename(sourcePath);
      if (usedFileNames.has(fileName)) {
        fileName = `${key.replace(/[^a-zA-Z0-9._-]/g, '_')}-${fileName}`;
      }
      usedFileNames.add(fileName);

      await fsPromises.mkdir(path.join(dir, BUN_PATCHES_DIR), { recursive: true });
      await fsPromises.copyFile(sourcePath, path.join(dir, BUN_PATCHES_DIR, fileName));
      rewritten[key] = `${BUN_PATCHES_DIR}/${fileName}`;
    }

    return rewritten;
  }

  /**
   * Reads `patchedDependencies` from the source package.json, copies the referenced patch
   * files into the output directory, and writes the output-relative patch map into the
   * output's package.json so `bun install` preserves patches in the bundled output.
   */
  private async copyBunPatchesToOutput(dir: string): Promise<void> {
    const sourcePackageJsonPath = path.join(this.rootDir, 'package.json');
    if (!fs.existsSync(sourcePackageJsonPath)) return;

    const sourcePkg = await readJSON(sourcePackageJsonPath);
    const patchedDeps = sourcePkg.patchedDependencies as Record<string, string> | undefined;
    if (!patchedDeps || Object.keys(patchedDeps).length === 0) return;

    const rewritten = await this.copyBunPatches(patchedDeps, this.rootDir, dir);
    if (Object.keys(rewritten).length === 0) return;

    const outputPackageJsonPath = path.join(dir, 'package.json');
    let outputPkg: Record<string, unknown>;
    try {
      outputPkg = (await readJSON(outputPackageJsonPath)) as Record<string, unknown>;
    } catch {
      outputPkg = {};
    }
    outputPkg.patchedDependencies = rewritten;
    await writeJSON(outputPackageJsonPath, outputPkg, { spaces: 2 });
  }

  private getNpmArgs(options: ArchitectureOptions): string[] {
    const args: string[] = [];
    if (options.cpu) args.push(`--cpu=${options.cpu.join(',')}`);
    if (options.os) args.push(`--os=${options.os.join(',')}`);
    if (options.libc) args.push(`--libc=${options.libc.join(',')}`);
    return args;
  }

  /**
   * Depending on whether we want to install or add a package, this function returns the appropriate commands.
   * All package managers support both commands (e.g. npm install has an alias on "add")
   */
  private getPackageManagerCommand(
    pm: PackageManager,
    type: 'install' | 'add',
    { yarnClassic = false }: { yarnClassic?: boolean } = {},
  ): string {
    const cmd = type === 'install' ? 'install' : 'add';

    switch (pm) {
      case 'npm':
        return `${cmd} --audit=false --fund=false --loglevel=error --progress=false --update-notifier=false`;
      case 'yarn':
        return type === 'install' && !yarnClassic ? `${cmd} --no-immutable` : cmd;
      case 'pnpm':
        return type === 'install' ? `${cmd} --no-frozen-lockfile --loglevel=error` : `${cmd} --loglevel=error`;
      default:
        return cmd;
    }
  }

  public async install({
    dir = this.rootDir,
    architecture,
    pnpmOverrides,
    pnpmNodeLinker,
    pnpmWorkspaceSettings,
  }: {
    dir?: string;
    architecture?: ArchitectureOptions;
    pnpmOverrides?: Record<string, string>;
    pnpmNodeLinker?: 'hoisted';
    pnpmWorkspaceSettings?: BundlerConfig['pnpmWorkspaceSettings'];
  } = {}) {
    const pm = this.packageManager;
    let yarnClassic = false;
    if (this.lockFile) {
      const destination = path.join(dir, this.lockFile.filename);
      if (path.resolve(this.lockFile.path) !== path.resolve(destination)) {
        const packedBunWorkspaces =
          pm === 'bun' &&
          fs.existsSync(path.join(dir, 'package.json')) &&
          Object.values(
            ((await readJSON(path.join(dir, 'package.json'))) as { resolutions?: Record<string, string> })
              .resolutions ?? {},
          ).some(spec => spec.startsWith('file:./workspace-module/'));

        if (packedBunWorkspaces) {
          // Bun cannot reuse the source workspace lockfile with packed tarballs; removing its workspace entries
          // makes Bun ignore it and regenerate the lockfile anyway. Start with a clean lockfile instead.
          await fsPromises.rm(destination, { force: true });
        } else {
          await fsPromises.copyFile(this.lockFile.path, destination);
        }
      }

      if (pm === 'yarn') {
        yarnClassic = await isYarnClassicLockfile(destination);
      }
    }

    const installCommand = this.getPackageManagerCommand(pm, 'install', { yarnClassic });
    let args: string[] = [];

    switch (pm) {
      case 'pnpm':
        await this.writePnpmConfig(dir, { ...architecture, pnpmOverrides, pnpmNodeLinker, pnpmWorkspaceSettings });
        break;
      case 'yarn':
        // similar to --ignore-workspace but for yarn
        await ensureFile(path.join(dir, 'yarn.lock'));
        if (architecture) {
          await this.writeYarnConfig(dir, architecture);
        }
        await this.copyYarnPatches(dir);
        break;
      case 'bun':
        await this.copyBunPatchesToOutput(dir);
        break;
      case 'npm':
        if (architecture) {
          args = this.getNpmArgs(architecture);
        }
        break;
      default:
      // Do nothing
    }

    const cpLogger = createChildProcessLogger({
      logger: this.logger,
      root: dir,
    });

    try {
      return await cpLogger({
        cmd: `${pm} ${installCommand}`,
        args,
        env: process.env as Record<string, string>,
      });
    } catch (error) {
      if (pm !== 'pnpm') throw error;

      const processOutput =
        error && typeof error === 'object'
          ? `${'stdout' in error ? String(error.stdout) : ''}\n${'stderr' in error ? String(error.stderr) : ''}`
          : '';
      const ignoredPackages = getPnpmIgnoredBuildPackages(processOutput);
      if (ignoredPackages.length === 0) throw error;

      throw new MastraError(
        {
          id: 'DEPLOYER_PNPM_IGNORED_BUILDS',
          domain: ErrorDomain.DEPLOYER,
          category: ErrorCategory.USER,
          details: { packageNames: ignoredPackages.join(', ') },
          text: `pnpm blocked build scripts for: ${ignoredPackages.join(', ')}. Add these packages to allowBuilds in pnpm-workspace.yaml and retry the build.`,
        },
        error,
      );
    }
  }

  public async installPackages(packages: string[]) {
    const pm = this.packageManager;
    const installCommand = this.getPackageManagerCommand(pm, 'add');

    const env: Record<string, string> = {
      PATH: process.env.PATH!,
    };

    if (process.env.npm_config_registry) {
      env.npm_config_registry = process.env.npm_config_registry;
    }

    const cpLogger = createChildProcessLogger({
      logger: this.logger,
      root: '',
    });

    return cpLogger({
      cmd: `${pm} ${installCommand}`,
      args: packages,
      env,
    });
  }

  public async checkDependencies(dependencies: string[]): Promise<string> {
    try {
      const packageJsonPath = path.join(this.rootDir, 'package.json');

      try {
        await fsPromises.access(packageJsonPath);
      } catch {
        return 'No package.json file found in the current directory';
      }

      const packageJson = await readJSON(packageJsonPath);
      for (const dependency of dependencies) {
        if (!packageJson.dependencies || !packageJson.dependencies[dependency]) {
          return `Please install ${dependency} before running this command (${this.packageManager} install ${dependency})`;
        }
      }

      return 'ok';
    } catch (err) {
      console.error(err);
      return 'Could not check dependencies';
    }
  }

  public async getProjectName() {
    try {
      const packageJsonPath = path.join(this.rootDir, 'package.json');
      const pkg = await readJSON(packageJsonPath);
      return pkg.name;
    } catch (err) {
      throw err;
    }
  }

  public async getPackageVersion() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgJsonPath = path.join(__dirname, '..', '..', 'package.json');

    const content = (await readJSON(pkgJsonPath)) as PackageJson;
    return content.version;
  }

  public async addScriptsToPackageJson(scripts: Record<string, string>) {
    const packageJson = await readJSON('package.json');
    packageJson.scripts = {
      ...packageJson.scripts,
      ...scripts,
    };
    await writeJSON('package.json', packageJson, { spaces: 2 });
  }
}

export class DepsService extends Deps {}
