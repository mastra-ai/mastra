import fs from 'fs';
import fsPromises from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { MastraBase } from '@mastra/core/base';
import { readJSON, writeJSON, ensureFile } from 'fs-extra/esm';
import type { PackageJson } from 'type-fest';

import { createChildProcessLogger } from '../deploy/log.js';

interface ArchitectureOptions {
  os?: string[];
  cpu?: string[];
  libc?: string[];
}

export class Deps extends MastraBase {
  private packageManager: string;
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

  private getPackageManager(): string {
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

  private async writePnpmConfig(dir: string, options: ArchitectureOptions) {
    const packageJsonPath = path.join(dir, 'package.json');
    const packageJson = await readJSON(packageJsonPath);

    packageJson.pnpm = {
      ...packageJson.pnpm,
      supportedArchitectures: {
        os: options.os || [],
        cpu: options.cpu || [],
        libc: options.libc || [],
      },
    };

    await writeJSON(packageJsonPath, packageJson, { spaces: 2 });
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

  public async install({
    dir = this.rootDir,
    architecture,
  }: { dir?: string; architecture?: ArchitectureOptions } = {}) {
    let runCommand = this.packageManager;
    let args: string[] = [];

    switch (this.packageManager) {
      case 'pnpm':
        runCommand = `${this.packageManager} --ignore-workspace install`;
        if (architecture) {
          await this.writePnpmConfig(dir, architecture);
        }
        break;
      case 'yarn':
        // similar to --ignore-workspace but for yarn
        await ensureFile(path.join(dir, 'yarn.lock'));
        if (architecture) {
          await this.writeYarnConfig(dir, architecture);
        }
        runCommand = `${this.packageManager} install`;
        break;
      case 'npm':
        runCommand = `${this.packageManager} install`;
        if (architecture) {
          args = this.getNpmArgs(architecture);
        }
        break;
      default:
        runCommand = `${this.packageManager} install`;
    }

    const cpLogger = createChildProcessLogger({
      logger: this.logger,
      root: dir,
    });

    return cpLogger({
      cmd: runCommand,
      args,
      env: {
        PATH: process.env.PATH!,
      },
    });
  }

  public async installPackages(packages: string[]) {
    let runCommand = this.packageManager;
    if (this.packageManager === 'npm') {
      runCommand = `${this.packageManager} i`;
    } else {
      runCommand = `${this.packageManager} add`;
    }

    const cpLogger = createChildProcessLogger({
      logger: this.logger,
      root: '',
    });

    return cpLogger({
      cmd: `${runCommand}`,
      args: packages,
      env: {
        PATH: process.env.PATH!,
      },
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
