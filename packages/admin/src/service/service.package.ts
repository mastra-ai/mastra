import { execa } from 'execa';
import * as fs from 'fs';

export class PackageService {
  private packageJsonPath: string;

  constructor(packageJsonPath: string) {
    this.packageJsonPath = packageJsonPath;
  }

  isPackageInstalled(packageName: string): boolean {
    const packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf-8'));
    if (packageJson?.dependencies[packageName]) {
      return true;
    } else {
      return false;
    }
  }
  //({ filePath, data }: { filePath: string; data: string })
  async installPackage({
    packageName,
    packageManager,
  }: {
    packageName: string;
    packageManager: string;
  }): Promise<void> {
    try {
      let installCommand = 'install';

      if (packageManager === 'yarn') {
        installCommand = 'add';
      }

      await execa(`${packageManager} ${installCommand} ${packageName}`, {
        cwd: process.cwd(),
        all: true,
        buffer: false,
        shell: true,
        stdio: 'inherit',
      });
    } catch (err) {
      console.error(`Error installing package: ${err}`);
    }
  }
}
