import { execa } from 'execa';
import fs from 'fs';
import path from 'path';

import fsPromises from 'fs/promises';

export class DepsService {
  private packageManager: string;

  constructor() {
    this.packageManager = this.getPackageManager();
  }

  private findLockFile(dir: string): string | null {
    const lockFiles = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'];
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
    const lockFile = this.findLockFile(process.cwd());
    switch (lockFile) {
      case 'pnpm-lock.yaml':
        return 'pnpm';
      case 'package-lock.json':
        return 'npm';
      case 'yarn.lock':
        return 'yarn';
      default:
        return 'npm';
    }
  }

  public async installPackages(packages: string[]) {
    let runCommand = this.packageManager;
    if (this.packageManager === 'npm') {
      runCommand = `${this.packageManager} i`;
    } else {
      runCommand = `${this.packageManager} add`;
    }

    const packageList = packages.join(' ');
    return execa(`${runCommand} ${packageList}`, {
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
}
