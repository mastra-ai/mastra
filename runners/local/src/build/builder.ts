import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import type { Build, Project, BuildOptions, LogStreamCallback } from '@mastra/admin';
import { BuildStatus } from '@mastra/admin';
import { detectPackageManager, getInstallArgs, getBuildArgs, hasBuildScript } from './package-manager';
import { runCommand } from '../process/spawner';
import type { BuildContext, PackageManager } from '../types';

export interface BuilderConfig {
  /** Default build timeout (ms) */
  defaultTimeoutMs: number;
  /** Working directory for builds */
  buildDir: string;
  /** Global env vars to inject */
  globalEnvVars: Record<string, string>;
}

const DEFAULT_CONFIG: BuilderConfig = {
  defaultTimeoutMs: 600000, // 10 minutes
  buildDir: '.mastra/builds',
  globalEnvVars: {},
};

/**
 * Builds Mastra projects by running install and build commands.
 */
export class ProjectBuilder {
  private readonly config: BuilderConfig;

  constructor(config: Partial<BuilderConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Build a project.
   */
  async build(
    _project: Project,
    build: Build,
    projectPath: string,
    options?: BuildOptions,
    onLog?: LogStreamCallback,
  ): Promise<Build> {
    const startTime = Date.now();
    const log = (message: string) => onLog?.(`[${new Date().toISOString()}] ${message}`);

    try {
      // Detect package manager
      const packageManager = await detectPackageManager(projectPath);
      log(`Detected package manager: ${packageManager}`);

      // Prepare environment
      const envVars = {
        ...this.config.globalEnvVars,
        ...options?.envVars,
        NODE_ENV: 'production',
      };

      // Build context
      const context: BuildContext = {
        projectPath,
        outputDir: path.join(projectPath, '.mastra/output'),
        packageManager,
        envVars,
      };

      // Step 1: Install dependencies (unless skipped)
      if (!options?.skipInstall) {
        log('Installing dependencies...');
        await this.installDependencies(context, onLog);
        log('Dependencies installed successfully');
      }

      // Step 2: Run build
      if (await hasBuildScript(projectPath)) {
        log('Running build script...');
        await this.runBuild(context, onLog);
        log('Build completed successfully');
      } else {
        log('No build script found, skipping build step');
      }

      // Verify output exists
      const outputExists = await this.verifyOutput(context.outputDir);
      if (!outputExists) {
        throw new Error(`Build output not found at ${context.outputDir}`);
      }

      const duration = Date.now() - startTime;
      log(`Build completed in ${Math.round(duration / 1000)}s`);

      return {
        ...build,
        status: BuildStatus.SUCCEEDED as Build['status'],
        completedAt: new Date(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(`Build failed: ${message}`);

      return {
        ...build,
        status: BuildStatus.FAILED as Build['status'],
        completedAt: new Date(),
        errorMessage: message,
      };
    }
  }

  private async installDependencies(context: BuildContext, onLog?: LogStreamCallback): Promise<void> {
    const args = getInstallArgs(context.packageManager);

    const result = await runCommand(context.packageManager, args, {
      cwd: context.projectPath,
      env: context.envVars,
      onOutput: onLog,
    });

    if (result.exitCode !== 0) {
      throw new Error(`Dependency installation failed with exit code ${result.exitCode}`);
    }
  }

  private async runBuild(context: BuildContext, onLog?: LogStreamCallback): Promise<void> {
    const args = getBuildArgs(context.packageManager);

    const result = await runCommand(context.packageManager, args, {
      cwd: context.projectPath,
      env: context.envVars,
      onOutput: onLog,
    });

    if (result.exitCode !== 0) {
      throw new Error(`Build failed with exit code ${result.exitCode}`);
    }
  }

  private async verifyOutput(outputDir: string): Promise<boolean> {
    try {
      const stats = await fs.stat(outputDir);
      if (!stats.isDirectory()) {
        return false;
      }

      // Check for index.mjs entry point
      const entryPoint = path.join(outputDir, 'index.mjs');
      await fs.access(entryPoint);
      return true;
    } catch {
      return false;
    }
  }
}
