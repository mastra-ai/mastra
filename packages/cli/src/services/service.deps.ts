import fs from 'fs';
import fsPromises from 'fs/promises';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { execa } from 'execa';
import fsExtra from 'fs-extra/esm';
import type { PackageJson } from 'type-fest';

export class DepsService {
  private packageManager: string;

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

  private getPackageManager(): string {
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

  public async getPackageVersion() {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    const pkgJsonPath = path.join(__dirname, '..', 'package.json');

    const content = (await fsExtra.readJSON(pkgJsonPath)) as PackageJson;
    return content.version;
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
