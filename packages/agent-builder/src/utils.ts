import { exec as execNodejs, execFile as execFileNodejs, spawn as nodeSpawn } from 'child_process';
import type { SpawnOptions } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { copyFile } from 'fs/promises';
import { createRequire } from 'module';
import { dirname, basename, extname, resolve } from 'path';
import { promisify } from 'util';
import { openai as openai_v5 } from '@ai-sdk/openai_v5';
import type { MastraLanguageModel } from '@mastra/core/agent';
import type { RuntimeContext } from '@mastra/core/runtime-context';
import { UNIT_KINDS } from './types';
import type { UnitKind } from './types';

export const exec = promisify(execNodejs);
export const execFile = promisify(execFileNodejs);

// Helper function to detect if we're in a workspace subfolder
function isInWorkspaceSubfolder(cwd: string): boolean {
  try {
    // First, check if current directory has package.json (it's a package)
    const currentPackageJson = resolve(cwd, 'package.json');
    if (!existsSync(currentPackageJson)) {
      return false; // Not a package, so not a workspace subfolder
    }

    // Walk up the directory tree looking for workspace indicators
    let currentDir = cwd;
    let previousDir = '';

    // Keep going up until we reach the filesystem root or stop making progress
    while (currentDir !== previousDir && currentDir !== '/') {
      previousDir = currentDir;
      currentDir = dirname(currentDir);

      // Skip if we're back at the original directory
      if (currentDir === cwd) {
        continue;
      }

      console.log(`Checking for workspace indicators in: ${currentDir}`);

      // Check for pnpm workspace
      if (existsSync(resolve(currentDir, 'pnpm-workspace.yaml'))) {
        return true;
      }

      // Check for npm/yarn workspaces in package.json
      const parentPackageJson = resolve(currentDir, 'package.json');
      if (existsSync(parentPackageJson)) {
        try {
          const parentPkg = JSON.parse(readFileSync(parentPackageJson, 'utf-8'));
          if (parentPkg.workspaces) {
            return true; // Found workspace config
          }
        } catch {
          // Ignore JSON parse errors
        }
      }

      // Check for lerna
      if (existsSync(resolve(currentDir, 'lerna.json'))) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.log(`Error in workspace detection: ${error}`);
    return false; // Default to false on any error
  }
}

export function spawn(command: string, args: string[], options: any) {
  return new Promise((resolve, reject) => {
    const childProcess = nodeSpawn(command, args, {
      stdio: 'inherit', // Enable proper stdio handling
      ...options,
    });
    childProcess.on('error', error => {
      reject(error);
    });
    childProcess.on('close', code => {
      if (code === 0) {
        resolve(void 0);
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });
  });
}

// --- Git environment probes ---
export async function isGitInstalled(): Promise<boolean> {
  try {
    await spawnWithOutput('git', ['--version'], {});
    return true;
  } catch {
    return false;
  }
}

export async function isInsideGitRepo(cwd: string): Promise<boolean> {
  try {
    if (!(await isGitInstalled())) return false;
    const { stdout } = await spawnWithOutput('git', ['rev-parse', '--is-inside-work-tree'], { cwd });
    return stdout.trim() === 'true';
  } catch {
    return false;
  }
}

// Variant of spawn that captures stdout and stderr
export function spawnWithOutput(
  command: string,
  args: string[],
  options: SpawnOptions,
): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolvePromise, rejectPromise) => {
    const childProcess = nodeSpawn(command, args, {
      ...options,
    });
    let stdout = '';
    let stderr = '';
    childProcess.on('error', error => {
      rejectPromise(error);
    });
    childProcess.stdout?.on('data', chunk => {
      process.stdout.write(chunk);
      stdout += chunk?.toString?.() ?? String(chunk);
    });
    childProcess.stderr?.on('data', chunk => {
      stderr += chunk?.toString?.() ?? String(chunk);
      process.stderr.write(chunk);
    });
    childProcess.on('close', code => {
      if (code === 0) {
        resolvePromise({ stdout, stderr, code: code ?? 0 });
      } else {
        const err = new Error(stderr || `Command failed: ${command} ${args.join(' ')}`);
        // @ts-expect-error augment
        err.code = code;
        rejectPromise(err);
      }
    });
  });
}

export async function spawnSWPM(cwd: string, command: string, packageNames: string[]) {
  // 1) Try local swpm module resolution/execution
  try {
    console.log('Running install command with swpm');
    const swpmPath = createRequire(import.meta.filename).resolve('swpm');
    await spawn(swpmPath, [command, ...packageNames], { cwd });
    return;
  } catch (e) {
    console.log('Failed to run install command with swpm', e);
    // ignore and try fallbacks
  }

  // 2) Fallback to native package manager based on lock files
  try {
    // Detect package manager from lock files
    let packageManager: string;

    if (existsSync(resolve(cwd, 'pnpm-lock.yaml'))) {
      packageManager = 'pnpm';
    } else if (existsSync(resolve(cwd, 'yarn.lock'))) {
      packageManager = 'yarn';
    } else {
      packageManager = 'npm';
    }

    // Normalize command
    let nativeCommand = command === 'add' ? 'add' : command === 'install' ? 'install' : command;

    // Build args with non-interactive flags for install commands
    const args = [nativeCommand];
    if (nativeCommand === 'install') {
      const inWorkspace = isInWorkspaceSubfolder(cwd);
      if (packageManager === 'pnpm') {
        args.push('--force'); // pnpm install --force

        // Check if we're in a workspace subfolder
        if (inWorkspace) {
          args.push('--ignore-workspace');
        }
      } else if (packageManager === 'npm') {
        args.push('--yes'); // npm install --yes

        // Check if we're in a workspace subfolder
        if (inWorkspace) {
          args.push('--ignore-workspaces');
        }
      }
    }
    args.push(...packageNames);

    console.log(`Falling back to ${packageManager} ${args.join(' ')}`);
    await spawn(packageManager, args, { cwd });
    return;
  } catch (e) {
    console.log(`Failed to run install command with native package manager: ${e}`);
  }

  throw new Error(`Failed to run install command with swpm and native package managers`);
}

// Utility functions
export function kindWeight(kind: UnitKind): number {
  const idx = UNIT_KINDS.indexOf(kind as any);
  return idx === -1 ? UNIT_KINDS.length : idx;
}

// Utility functions to work with Mastra templates
export async function fetchMastraTemplates(): Promise<
  Array<{
    slug: string;
    title: string;
    description: string;
    githubUrl: string;
    tags: string[];
    agents: string[];
    workflows: string[];
    tools: string[];
  }>
> {
  try {
    const response = await fetch('https://mastra.ai/api/templates.json');
    const data = (await response.json()) as Array<{
      slug: string;
      title: string;
      description: string;
      githubUrl: string;
      tags: string[];
      agents: string[];
      workflows: string[];
      tools: string[];
    }>;
    return data;
  } catch (error) {
    throw new Error(`Failed to fetch Mastra templates: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper to get a specific template by slug
export async function getMastraTemplate(slug: string) {
  const templates = await fetchMastraTemplates();
  const template = templates.find(t => t.slug === slug);
  if (!template) {
    throw new Error(`Template "${slug}" not found. Available templates: ${templates.map(t => t.slug).join(', ')}`);
  }
  return template;
}

// Git commit tracking utility
export async function logGitState(targetPath: string, label: string): Promise<void> {
  try {
    // Skip if not a git repo
    if (!(await isInsideGitRepo(targetPath))) return;
    const gitStatusResult = await git(targetPath, 'status', '--porcelain');
    const gitLogResult = await git(targetPath, 'log', '--oneline', '-3');
    const gitCountResult = await git(targetPath, 'rev-list', '--count', 'HEAD');

    console.log(`📊 Git state ${label}:`);
    console.log('Status:', gitStatusResult.stdout.trim() || 'Clean working directory');
    console.log('Recent commits:', gitLogResult.stdout.trim());
    console.log('Total commits:', gitCountResult.stdout.trim());
  } catch (gitError) {
    console.warn(`Could not get git state ${label}:`, gitError);
  }
}

// Generic git runner that captures stdout/stderr
export async function git(cwd: string, ...args: string[]): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await spawnWithOutput('git', args, { cwd });
  return { stdout: stdout ?? '', stderr: stderr ?? '' };
}

// Common git helpers
export async function gitClone(repo: string, destDir: string, cwd?: string) {
  await git(cwd ?? process.cwd(), 'clone', repo, destDir);
}

export async function gitCheckoutRef(cwd: string, ref: string) {
  if (!(await isInsideGitRepo(cwd))) return;
  await git(cwd, 'checkout', ref);
}

export async function gitRevParse(cwd: string, rev: string): Promise<string> {
  if (!(await isInsideGitRepo(cwd))) return '';
  const { stdout } = await git(cwd, 'rev-parse', rev);
  return stdout.trim();
}

export async function gitAddFiles(cwd: string, files: string[]) {
  if (!files || files.length === 0) return;
  if (!(await isInsideGitRepo(cwd))) return;
  await git(cwd, 'add', ...files);
}

export async function gitAddAll(cwd: string) {
  if (!(await isInsideGitRepo(cwd))) return;
  await git(cwd, 'add', '.');
}

export async function gitHasStagedChanges(cwd: string): Promise<boolean> {
  if (!(await isInsideGitRepo(cwd))) return false;
  const { stdout } = await git(cwd, 'diff', '--cached', '--name-only');
  return stdout.trim().length > 0;
}

export async function gitCommit(
  cwd: string,
  message: string,
  opts?: { allowEmpty?: boolean; skipIfNoStaged?: boolean },
): Promise<boolean> {
  try {
    if (!(await isInsideGitRepo(cwd))) return false;
    if (opts?.skipIfNoStaged) {
      const has = await gitHasStagedChanges(cwd);
      if (!has) return false;
    }
    const args = ['commit', '-m', message];
    if (opts?.allowEmpty) args.push('--allow-empty');
    await git(cwd, ...args);
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/nothing to commit/i.test(msg) || /no changes added to commit/i.test(msg)) {
      return false;
    }
    throw e;
  }
}

export async function gitAddAndCommit(
  cwd: string,
  message: string,
  files?: string[],
  opts?: { allowEmpty?: boolean; skipIfNoStaged?: boolean },
): Promise<boolean> {
  try {
    if (!(await isInsideGitRepo(cwd))) return false;
    if (files && files.length > 0) {
      await gitAddFiles(cwd, files);
    } else {
      await gitAddAll(cwd);
    }
    return gitCommit(cwd, message, opts);
  } catch (e) {
    console.error(`Failed to add and commit files: ${e instanceof Error ? e.message : String(e)}`);
    return false;
  }
}

export async function gitCheckoutBranch(branchName: string, targetPath: string) {
  try {
    if (!(await isInsideGitRepo(targetPath))) return;
    // Try to create new branch using centralized git runner
    await git(targetPath, 'checkout', '-b', branchName);
    console.log(`Created new branch: ${branchName}`);
  } catch (error) {
    // If branch exists, check if we can switch to it or create a unique name
    const errorStr = error instanceof Error ? error.message : String(error);
    if (errorStr.includes('already exists')) {
      try {
        // Try to switch to existing branch
        await git(targetPath, 'checkout', branchName);
        console.log(`Switched to existing branch: ${branchName}`);
      } catch {
        // If can't switch, create a unique branch name
        const timestamp = Date.now().toString().slice(-6);
        const uniqueBranchName = `${branchName}-${timestamp}`;
        await git(targetPath, 'checkout', '-b', uniqueBranchName);
        console.log(`Created unique branch: ${uniqueBranchName}`);
      }
    } else {
      throw error; // Re-throw if it's a different error
    }
  }
}

// File conflict resolution utilities (for future use)
export async function backupAndReplaceFile(sourceFile: string, targetFile: string): Promise<void> {
  // Create backup of existing file
  const backupFile = `${targetFile}.backup-${Date.now()}`;
  await copyFile(targetFile, backupFile);
  console.log(`📦 Created backup: ${basename(backupFile)}`);

  // Replace with template file
  await copyFile(sourceFile, targetFile);
  console.log(`🔄 Replaced file with template version (backup created)`);
}

export async function renameAndCopyFile(sourceFile: string, targetFile: string): Promise<string> {
  // Find unique filename
  let counter = 1;
  let uniqueTargetFile = targetFile;
  const baseName = basename(targetFile, extname(targetFile));
  const extension = extname(targetFile);
  const directory = dirname(targetFile);

  while (existsSync(uniqueTargetFile)) {
    const uniqueName = `${baseName}.template-${counter}${extension}`;
    uniqueTargetFile = resolve(directory, uniqueName);
    counter++;
  }

  await copyFile(sourceFile, uniqueTargetFile);
  console.log(`📝 Copied with unique name: ${basename(uniqueTargetFile)}`);
  return uniqueTargetFile;
}

// Helper function to resolve the model to use
export const resolveModel = (runtimeContext: RuntimeContext): MastraLanguageModel => {
  const modelFromContext = runtimeContext.get('model');
  if (modelFromContext) {
    console.log(`Using model: ${modelFromContext}`);
    // Type check to ensure it's a MastraLanguageModel
    if (isValidMastraLanguageModel(modelFromContext)) {
      return modelFromContext;
    }
    throw new Error(
      'Invalid model provided. Model must be a MastraLanguageModel instance (e.g., openai("gpt-4"), anthropic("claude-3-5-sonnet"), etc.)',
    );
  }
  return openai_v5('gpt-4.1'); // Default model
};

// Type guard to check if object is a valid MastraLanguageModel
export const isValidMastraLanguageModel = (model: any): model is MastraLanguageModel => {
  return (
    model && typeof model === 'object' && typeof model.modelId === 'string' && typeof model.generate === 'function'
  );
};

// Helper function to resolve target path with smart defaults
export const resolveTargetPath = (inputData: any, runtimeContext: any): string => {
  // If explicitly provided, use it
  if (inputData.targetPath) {
    return inputData.targetPath;
  }

  // Check runtime context
  const contextPath = runtimeContext.get('targetPath');
  if (contextPath) {
    return contextPath;
  }

  // Smart resolution logic from prepareAgentBuilderWorkflowInstallation
  const envRoot = process.env.MASTRA_PROJECT_ROOT?.trim();
  if (envRoot) {
    return envRoot;
  }

  const cwd = process.cwd();
  const parent = dirname(cwd);
  const grand = dirname(parent);

  // Detect when running under `<project>/.mastra/output` and resolve back to project root
  if (basename(cwd) === 'output' && basename(parent) === '.mastra') {
    return grand;
  }

  return cwd;
};
