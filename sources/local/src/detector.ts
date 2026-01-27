import { readFile, access } from 'node:fs/promises';
import { join } from 'node:path';
import { constants } from 'node:fs';

export interface ProjectMetadata {
  name?: string;
  version?: string;
  packageManager?: 'npm' | 'pnpm' | 'yarn' | 'bun';
  mastraVersion?: string;
}

export class MastraProjectDetector {
  /**
   * Detect if a directory is a Mastra project by checking for @mastra/core dependency
   */
  async detect(directory: string): Promise<boolean> {
    const packageJsonPath = join(directory, 'package.json');

    try {
      await access(packageJsonPath, constants.R_OK);
      const content = await readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };

      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      return '@mastra/core' in deps;
    } catch {
      return false;
    }
  }

  /**
   * Extract metadata from a Mastra project
   */
  async getMetadata(directory: string): Promise<ProjectMetadata> {
    const packageJsonPath = join(directory, 'package.json');

    try {
      const content = await readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content) as {
        name?: string;
        version?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      return {
        name: pkg.name,
        version: pkg.version,
        packageManager: await this.detectPackageManager(directory),
        mastraVersion: deps['@mastra/core'],
      };
    } catch {
      return {};
    }
  }

  private async detectPackageManager(directory: string): Promise<ProjectMetadata['packageManager']> {
    const lockFiles = [
      { file: 'pnpm-lock.yaml', manager: 'pnpm' as const },
      { file: 'yarn.lock', manager: 'yarn' as const },
      { file: 'bun.lockb', manager: 'bun' as const },
      { file: 'package-lock.json', manager: 'npm' as const },
    ];

    for (const { file, manager } of lockFiles) {
      try {
        await access(join(directory, file), constants.R_OK);
        return manager;
      } catch {
        // Continue checking
      }
    }

    return 'npm'; // Default
  }
}
