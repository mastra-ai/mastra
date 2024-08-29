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
    isNotPublished,
  }: {
    packageName: string;
    packageManager: string;
    isNotPublished?: boolean;
  }): Promise<{ ok: boolean }> {
    try {
      //we now add a hack when we are in admin, example apps
      if (isNotPublished) {
        let packageJson = JSON.parse(fs.readFileSync(this.packageJsonPath, 'utf-8'));

        packageJson = { ...packageJson, dependencies: { ...packageJson.dependencies, [packageName]: 'workspace:*' } };

        fs.writeFileSync(this.packageJsonPath, JSON.stringify(packageJson, null, 2));

        await execa(`pnpm i`, {
          cwd: process.cwd(),
          all: true,
          buffer: false,
          shell: true,
          stdio: 'inherit',
        });

        return { ok: true };
      }

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

      return { ok: true };
    } catch (err) {
      console.error(`Error installing package: ${err}`);
      return { ok: false };
    }
  }
}
