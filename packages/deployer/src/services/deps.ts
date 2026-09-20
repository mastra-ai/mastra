import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MastraBase } from '@mastra/core/base';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { readJSON, writeJSON, ensureFile } from 'fs-extra/esm';
import type { PackageJson } from 'type-fest';
import { parse } from 'yaml';

import { createChildProcessLogger } from '../deploy/log.js';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

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

    if (!PNPM_CONFIG_KEYS_TO_COPY.has(key) || (key === 'supportedArchitectures' && hasArchitecture)) {
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

  return ["packages:\n  - '.'", ...blocks].join('\n\n') + '\n';
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

  public async pack({ dir, destination, sanitizedName }: { dir: string; destination: string; sanitizedName: string }) {
    const cpLogger = createChildProcessLogger({
      logger: this.logger,
      root: dir,
    });

    let packCmd = 'pack';
    let destinationFlag = `--pack-destination ${destination}`;
    if (this.packageManager === 'yarn') {
      // %s includes an '@' at the start of packages names with an '@'
      // so we need to use our sanitizedName instead.
      destinationFlag = `--out ${destination}/${sanitizedName}-%v.tgz`;
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
      const sourcePath = path.resolve(resolvedWorkspaceRoot, declaredPath);
      if (!sourcePath.startsWith(`${resolvedWorkspaceRoot}${path.sep}`)) {
        this.logger.warn(`Skipping pnpm patch for "${key}": patch file is outside the workspace at ${sourcePath}`);
        continue;
      }
      if (!fs.existsSync(sourcePath)) {
        this.logger.warn(`Skipping pnpm patch for "${key}": patch file not found at ${sourcePath}`);
        continue;
      }

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
      const sourcePath = path.resolve(resolvedRoot, declaredPath);
      if (!sourcePath.startsWith(`${resolvedRoot}${path.sep}`)) {
        this.logger.warn(`Skipping bun patch for "${key}": patch file is outside the workspace at ${sourcePath}`);
        continue;
      }
      if (!fs.existsSync(sourcePath)) {
        this.logger.warn(`Skipping bun patch for "${key}": patch file not found at ${sourcePath}`);
        continue;
      }

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
  }: {
    dir?: string;
    architecture?: ArchitectureOptions;
    pnpmOverrides?: Record<string, string>;
    pnpmNodeLinker?: 'hoisted';
  } = {}) {
    const pm = this.packageManager;
    let yarnClassic = false;
    if (this.lockFile) {
      const destination = path.join(dir, this.lockFile.filename);
      if (path.resolve(this.lockFile.path) !== path.resolve(destination)) {
        await fsPromises.copyFile(this.lockFile.path, destination);
      }

      if (pm === 'yarn') {
        const lockfileContents = await fsPromises.readFile(destination, 'utf-8');
        yarnClassic = /^# yarn lockfile v1\r?$/m.test(lockfileContents);
      }
    }

    const installCommand = this.getPackageManagerCommand(pm, 'install', { yarnClassic });
    let args: string[] = [];

    switch (pm) {
      case 'pnpm':
        await this.writePnpmConfig(dir, { ...architecture, pnpmOverrides, pnpmNodeLinker });
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
