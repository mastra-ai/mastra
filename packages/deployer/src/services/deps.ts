import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path, { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MastraBase } from '@mastra/core/base';
import { readJSON, writeJSON, ensureFile } from 'fs-extra/esm';
import type { PackageJson } from 'type-fest';

import { createChildProcessLogger } from '../deploy/log.js';

type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

interface ArchitectureOptions {
  os?: string[];
  cpu?: string[];
  libc?: string[];
}

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

/**
 * Parses the `patchedDependencies:` block of a pnpm-workspace.yaml into a map of
 * `<dependency spec>` -> `<patch file path>`. Uses the same line-based approach as
 * {@link copyPnpmWorkspaceSettings} so the deployer stays free of a YAML dependency.
 *
 * Keys and values may be quoted (scoped specs such as `'@scope/pkg@1.2.3'` require it);
 * surrounding single/double quotes are stripped.
 */
export function extractPnpmPatchedDependencies(source: string): Record<string, string> {
  const lines = source.split(/\r?\n/);
  const patches: Record<string, string> = {};

  const stripQuotes = (value: string) => value.replace(/^['"]|['"]$/g, '');

  for (let index = 0; index < lines.length;) {
    const key = getTopLevelYamlKey(lines[index] ?? '');
    if (key !== 'patchedDependencies') {
      index += 1;
      continue;
    }

    index += 1;
    while (index < lines.length && !getTopLevelYamlKey(lines[index] ?? '')) {
      const entry = lines[index] ?? '';
      // Match `  <spec>: <path>` where <spec> may be quoted and contain a colon.
      const match = /^\s+(?:(['"])(.*?)\1|([^:]+)):\s*(.+?)\s*$/.exec(entry);
      if (match) {
        const spec = stripQuotes((match[2] ?? match[3] ?? '').trim());
        const patchPath = stripQuotes((match[4] ?? '').trim());
        if (spec && patchPath) {
          patches[spec] = patchPath;
        }
      }
      index += 1;
    }
  }

  return patches;
}

interface PnpmWorkspaceSettingsOptions extends ArchitectureOptions {
  /**
   * Patched dependencies to emit in the generated workspace file. Paths are written
   * verbatim, so callers are responsible for rewriting them relative to the output dir.
   */
  patchedDependencies?: Record<string, string>;
}

export function copyPnpmWorkspaceSettings(source: string, options: PnpmWorkspaceSettingsOptions = {}) {
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
      blocks.push(block);
    }
  }

  const patchedDependencies = options.patchedDependencies ?? {};
  const patchEntries = Object.entries(patchedDependencies);
  if (patchEntries.length > 0) {
    const patchedBlock = [
      'patchedDependencies:',
      ...patchEntries.map(([spec, patchPath]) => `  '${spec}': ${patchPath}`),
    ];
    blocks.push(patchedBlock.join('\n'));
    // The bundled output only installs the app's runtime dependencies, so a copied
    // patch may target a package that is no longer in the tree. pnpm treats unused
    // patches as a hard error by default, which would fail the deploy install.
    blocks.push('allowUnusedPatches: true');
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

  return ["packages:\n  - '.'", ...blocks].join('\n\n') + '\n';
}

export class Deps extends MastraBase {
  private packageManager: PackageManager;
  private rootDir: string;

  constructor(rootDir = process.cwd()) {
    super({ component: 'DEPLOYER', name: 'DEPS' });

    this.rootDir = rootDir;
    this.packageManager = this.getPackageManager();
  }

  private findLockFile(dir: string): string | null {
    const lockFiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lock'];
    for (const file of lockFiles) {
      if (fs.existsSync(path.join(dir, file))) {
        return file;
      }
    }
    const parentDir = path.resolve(dir, '..');
    if (parentDir !== dir) {
      return this.findLockFile(parentDir);
    }
    return null;
  }

  private getPackageManager(): PackageManager {
    const lockFile = this.findLockFile(this.rootDir);
    switch (lockFile) {
      case 'pnpm-lock.yaml':
        return 'pnpm';
      case 'package-lock.json':
        return 'npm';
      case 'yarn.lock':
        return 'yarn';
      case 'bun.lock':
        return 'bun';
      default:
        return 'npm';
    }
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

  private async writePnpmConfig(dir: string, options: ArchitectureOptions = {}) {
    const sourceWorkspaceYamlPath = this.findPnpmWorkspaceFile(this.rootDir);
    const sourceWorkspaceYaml = sourceWorkspaceYamlPath
      ? await fsPromises.readFile(sourceWorkspaceYamlPath, 'utf-8')
      : '';

    const patchedDependencies = sourceWorkspaceYamlPath
      ? await this.copyPatchedDependencies(sourceWorkspaceYamlPath, sourceWorkspaceYaml, dir)
      : {};

    await fsPromises.writeFile(
      path.join(dir, 'pnpm-workspace.yaml'),
      copyPnpmWorkspaceSettings(sourceWorkspaceYaml, { ...options, patchedDependencies }),
      'utf-8',
    );
  }

  /**
   * Copies the patch files referenced by `patchedDependencies` in the source workspace
   * into `<dir>/patches/` so the bundled output is self-contained, and returns a map of
   * dependency spec -> output-relative patch path suitable for the generated workspace file.
   */
  private async copyPatchedDependencies(
    sourceWorkspaceYamlPath: string,
    sourceWorkspaceYaml: string,
    dir: string,
  ): Promise<Record<string, string>> {
    const patchedDependencies = extractPnpmPatchedDependencies(sourceWorkspaceYaml);
    const entries = Object.entries(patchedDependencies);
    if (entries.length === 0) {
      return {};
    }

    const sourceRoot = path.dirname(sourceWorkspaceYamlPath);
    const patchesDir = path.join(dir, 'patches');
    const rewritten: Record<string, string> = {};
    const usedNames = new Map<string, string>();

    for (const [spec, patchPath] of entries) {
      const sourcePatchPath = path.resolve(sourceRoot, patchPath);
      if (!fs.existsSync(sourcePatchPath)) {
        this.logger.warn(`Skipping patch for "${spec}": patch file not found at ${sourcePatchPath}`);
        continue;
      }

      // Avoid collisions when two patches share a basename (e.g. from nested workspaces).
      let destName = path.basename(sourcePatchPath);
      const existing = usedNames.get(destName);
      if (existing && existing !== sourcePatchPath) {
        destName = `${spec.replace(/[^\w.-]+/g, '_')}-${destName}`;
      }
      usedNames.set(destName, sourcePatchPath);

      await ensureFile(path.join(patchesDir, destName));
      await fsPromises.copyFile(sourcePatchPath, path.join(patchesDir, destName));
      rewritten[spec] = `patches/${destName}`;
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
  private getPackageManagerCommand(pm: PackageManager, type: 'install' | 'add'): string {
    const cmd = type === 'install' ? 'install' : 'add';

    switch (pm) {
      case 'npm':
        return `${cmd} --audit=false --fund=false --loglevel=error --progress=false --update-notifier=false`;
      case 'yarn':
        return `${cmd}`;
      case 'pnpm':
        return cmd === 'install' ? `${cmd} --loglevel=error` : `${cmd} --loglevel=error`;
      case 'bun':
        return cmd;
      default:
        return cmd;
    }
  }

  public async install({
    dir = this.rootDir,
    architecture,
  }: { dir?: string; architecture?: ArchitectureOptions } = {}) {
    const pm = this.packageManager;
    const installCommand = this.getPackageManagerCommand(pm, 'install');
    let args: string[] = [];

    switch (pm) {
      case 'pnpm':
        await this.writePnpmConfig(dir, architecture);
        break;
      case 'yarn':
        // similar to --ignore-workspace but for yarn
        await ensureFile(path.join(dir, 'yarn.lock'));
        if (architecture) {
          await this.writeYarnConfig(dir, architecture);
        }
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

    return cpLogger({
      cmd: `${pm} ${installCommand}`,
      args,
      env: process.env as Record<string, string>,
    });
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
