import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import type { PackageManager, ProjectMetadata } from './types';

/**
 * Filenames that indicate a Mastra configuration.
 */
const MASTRA_CONFIG_FILES = [
  'mastra.config.ts',
  'mastra.config.js',
  'mastra.config.mjs',
  'src/mastra/index.ts',
  'src/mastra/index.js',
];

/**
 * Package names that indicate a Mastra project.
 */
const MASTRA_PACKAGES = ['@mastra/core', 'mastra', '@mastra/cli', '@mastra/server'];

/**
 * Lock files and their corresponding package managers.
 */
const LOCK_FILES: Record<string, PackageManager> = {
  'pnpm-lock.yaml': 'pnpm',
  'yarn.lock': 'yarn',
  'bun.lockb': 'bun',
  'package-lock.json': 'npm',
};

/**
 * Detects whether a directory contains a valid Mastra project
 * and extracts project metadata.
 */
export class MastraProjectDetector {
  /**
   * Check if a directory is a valid Mastra project.
   *
   * A directory is considered a Mastra project if:
   * 1. It has a package.json file
   * 2. It has @mastra/core or mastra as a dependency
   *    OR it has a mastra.config file
   *
   * @param dir - Absolute path to the directory
   * @returns True if the directory is a Mastra project
   */
  async isMastraProject(dir: string): Promise<boolean> {
    try {
      // Check for package.json
      const packageJsonPath = path.join(dir, 'package.json');
      const packageJsonExists = await this.fileExists(packageJsonPath);
      if (!packageJsonExists) {
        return false;
      }

      // Check for Mastra config file
      const hasMastraConfig = await this.findMastraConfig(dir);
      if (hasMastraConfig) {
        return true;
      }

      // Check for Mastra dependencies in package.json
      const packageJson = await this.readPackageJson(dir);
      if (!packageJson) {
        return false;
      }

      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      return MASTRA_PACKAGES.some(pkg => pkg in allDeps);
    } catch {
      return false;
    }
  }

  /**
   * Get metadata about a Mastra project.
   *
   * @param dir - Absolute path to the project directory
   * @returns Project metadata
   * @throws Error if not a valid Mastra project
   */
  async getProjectMetadata(dir: string): Promise<ProjectMetadata> {
    const packageJson = await this.readPackageJson(dir);
    if (!packageJson) {
      throw new Error(`No package.json found in ${dir}`);
    }

    const isValid = await this.isMastraProject(dir);
    if (!isValid) {
      throw new Error(`Directory ${dir} is not a valid Mastra project`);
    }

    const packageManager = await this.detectPackageManager(dir);
    const mastraConfigPath = await this.findMastraConfig(dir);
    const isTypeScript = await this.detectTypeScript(dir);

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
    };

    const mastraDependencies = MASTRA_PACKAGES.filter(pkg => pkg in allDeps);

    return {
      name: packageJson.name || path.basename(dir),
      version: packageJson.version,
      description: packageJson.description,
      packageManager,
      hasMastraConfig: !!mastraConfigPath,
      mastraConfigPath: mastraConfigPath || undefined,
      entryPoint: packageJson.main || packageJson.module,
      isTypeScript,
      mastraDependencies,
    };
  }

  /**
   * Detect the package manager used by the project.
   */
  async detectPackageManager(dir: string): Promise<PackageManager> {
    // Check for lock files in order of preference
    for (const [lockFile, manager] of Object.entries(LOCK_FILES)) {
      const lockPath = path.join(dir, lockFile);
      if (await this.fileExists(lockPath)) {
        return manager;
      }
    }

    // Check packageManager field in package.json
    const packageJson = await this.readPackageJson(dir);
    if (packageJson?.packageManager) {
      const pmField = packageJson.packageManager;
      if (pmField.startsWith('pnpm')) return 'pnpm';
      if (pmField.startsWith('yarn')) return 'yarn';
      if (pmField.startsWith('bun')) return 'bun';
      if (pmField.startsWith('npm')) return 'npm';
    }

    // Default to npm
    return 'npm';
  }

  /**
   * Find the Mastra config file path if it exists.
   */
  private async findMastraConfig(dir: string): Promise<string | null> {
    for (const configFile of MASTRA_CONFIG_FILES) {
      const configPath = path.join(dir, configFile);
      if (await this.fileExists(configPath)) {
        return configPath;
      }
    }
    return null;
  }

  /**
   * Detect if the project uses TypeScript.
   */
  private async detectTypeScript(dir: string): Promise<boolean> {
    const tsconfigPath = path.join(dir, 'tsconfig.json');
    return this.fileExists(tsconfigPath);
  }

  /**
   * Read and parse package.json from a directory.
   */
  private async readPackageJson(dir: string): Promise<PackageJson | null> {
    try {
      const packageJsonPath = path.join(dir, 'package.json');
      const content = await fs.readFile(packageJsonPath, 'utf-8');
      return JSON.parse(content) as PackageJson;
    } catch {
      return null;
    }
  }

  /**
   * Check if a file exists.
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Simplified package.json type.
 */
interface PackageJson {
  name?: string;
  version?: string;
  description?: string;
  main?: string;
  module?: string;
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Singleton instance for convenience.
 */
export const detector = new MastraProjectDetector();
