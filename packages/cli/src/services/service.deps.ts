import fs from 'fs';
import fsPromises from 'fs/promises';
import path from 'path';
import { execa } from 'execa';
import { getPackageManagerAddCommand } from '../utils/package-manager';
import type { PackageManager } from '../utils/package-manager';

export class DepsService {
  readonly packageManager: PackageManager;

  constructor() {
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
    const lockFile = this.findLockFile(process.cwd());
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

  public async installPackages(packages: string[]) {
    const pm = this.packageManager;
    const installCommand = getPackageManagerAddCommand(pm);

    const packageList = packages.join(' ');
    return execa(`${pm} ${installCommand} ${packageList}`, {
      all: true,
      shell: true,
      stdio: 'inherit',
    });
  }

  public async checkDependencies(dependencies: string[]): Promise<string> {
    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');

      try {
        await fsPromises.access(packageJsonPath);
      } catch {
        return 'No package.json file found in the current directory';
      }

      const packageJson = JSON.parse(await fsPromises.readFile(packageJsonPath, 'utf-8'));
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
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = await fsPromises.readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(packageJson);
      return pkg.name;
    } catch (err) {
      throw err;
    }
  }

  public async addScriptsToPackageJson(scripts: Record<string, string>) {
    const packageJson = JSON.parse(await fsPromises.readFile('package.json', 'utf-8'));
    packageJson.scripts = {
      ...packageJson.scripts,
      ...scripts,
    };
    await fsPromises.writeFile('package.json', JSON.stringify(packageJson, null, 2));
  }
}
