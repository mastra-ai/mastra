import fs from 'node:fs/promises';
import path from 'node:path';
import { execa } from 'execa';
import yoctoSpinner from 'yocto-spinner';

import { getPackageManager } from '../commands/utils';

import { logger } from './logger';
import type { PackageManager } from './package-manager';
import type { Template } from './template-utils';

const INTERRUPT_SIGNALS = ['SIGINT', 'SIGTERM'] as const;

function startSpinner(text: string, signal?: AbortSignal, silent = false) {
  if (silent) return undefined;
  if (!signal) return yoctoSpinner({ text }).start();

  const existingListeners = new Map(
    INTERRUPT_SIGNALS.map(interruptSignal => [interruptSignal, new Set(process.listeners(interruptSignal))]),
  );
  const spinner = yoctoSpinner({ text }).start();

  // The caller owns interruption handling so its finally block can clean up before the process exits.
  for (const interruptSignal of INTERRUPT_SIGNALS) {
    for (const listener of process.listeners(interruptSignal)) {
      if (!existingListeners.get(interruptSignal)?.has(listener)) {
        process.removeListener(interruptSignal, listener);
      }
    }
  }

  return spinner;
}

export interface CloneTemplateOptions {
  template: Template;
  projectName: string;
  targetDir?: string;
  branch?: string;
  signal?: AbortSignal;
  silent?: boolean;
}

export async function cloneTemplate(options: CloneTemplateOptions): Promise<string> {
  const { template, projectName, targetDir, branch, signal, silent = false } = options;
  const projectPath = targetDir ? path.resolve(targetDir, projectName) : path.resolve(projectName);

  const spinner = startSpinner(`Cloning template "${template.title}"...`, signal, silent);
  let ownsProjectPath = false;

  try {
    // Check if directory already exists
    if (await directoryExists(projectPath)) {
      spinner?.error(`Directory ${projectName} already exists`);
      throw new Error(`Directory ${projectName} already exists`);
    }

    ownsProjectPath = true;

    // Clone the repository without git history
    await cloneRepositoryWithoutGit(template.githubUrl, projectPath, branch, signal);

    // Update package.json with new project name
    await updatePackageJson(projectPath, projectName);

    spinner?.success(`Template "${template.title}" cloned successfully to ${projectName}`);
    return projectPath;
  } catch (error) {
    if (ownsProjectPath) {
      await fs.rm(projectPath, { recursive: true, force: true });
    }
    spinner?.error(`Failed to clone template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}

async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function cloneRepositoryWithoutGit(
  repoUrl: string,
  targetPath: string,
  branch?: string,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();

  try {
    // First try using degit if available (similar to Next.js)
    const degitRepo = repoUrl.replace('https://github.com/', '');
    // If branch is specified, append it to the degit repo (format: owner/repo#branch)
    const degitRepoWithBranch = branch ? `${degitRepo}#${branch}` : degitRepo;
    await execa('npx', ['degit', degitRepoWithBranch, targetPath], {
      cwd: process.cwd(),
      ...(signal ? { cancelSignal: signal } : {}),
    });
    signal?.throwIfAborted();

    if ((await fs.readdir(targetPath)).length === 0) {
      throw new Error('degit completed without cloning template files');
    }
  } catch {
    if (signal?.aborted) signal.throwIfAborted();

    // Degit can leave partial output behind, so reset only this clone-owned destination before the fallback.
    await fs.rm(targetPath, { recursive: true, force: true });

    // Fallback to git clone + remove .git
    try {
      const gitArgs = ['clone'];
      // Add branch flag if specified
      if (branch) {
        gitArgs.push('--branch', branch);
      }
      gitArgs.push(repoUrl, targetPath);

      await execa('git', gitArgs, {
        cwd: process.cwd(),
        ...(signal ? { cancelSignal: signal } : {}),
      });
      signal?.throwIfAborted();

      // Remove .git directory
      const gitDir = path.join(targetPath, '.git');
      if (await directoryExists(gitDir)) {
        await fs.rm(gitDir, { recursive: true, force: true });
      }
    } catch (gitError) {
      if (signal?.aborted) signal.throwIfAborted();
      throw new Error(`Failed to clone repository: ${gitError instanceof Error ? gitError.message : 'Unknown error'}`);
    }
  }
}

async function updatePackageJson(projectPath: string, projectName: string): Promise<void> {
  const packageJsonPath = path.join(projectPath, 'package.json');

  try {
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageJsonContent);

    // Update the name field
    packageJson.name = projectName;

    // Write back the updated package.json
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf-8');
  } catch (error) {
    // It's okay if package.json doesn't exist or can't be updated
    logger.warn('Could not update package.json', { error: error instanceof Error ? error.message : 'Unknown error' });
  }
}

export async function installDependencies(
  projectPath: string,
  packageManager?: PackageManager,
  timeout?: number,
  signal?: AbortSignal,
  silent = false,
): Promise<void> {
  const spinner = startSpinner('Installing dependencies...', signal, silent);

  try {
    // Use provided package manager or detect from environment/globally
    const pm = packageManager || getPackageManager();

    await execa(pm, ['install'], {
      cwd: projectPath,
      timeout,
      killSignal: 'SIGTERM',
      ...(signal ? { cancelSignal: signal } : {}),
    });

    spinner?.success('Dependencies installed successfully');
  } catch (error) {
    spinner?.error(`Failed to install dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    throw error;
  }
}
