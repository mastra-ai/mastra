import { exec as execNodejs, execFile as execFileNodejs, spawn as nodeSpawn } from 'child_process';
import type { SpawnOptions } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { copyFile, readFile } from 'fs/promises';
import { createRequire } from 'module';
import { dirname, basename, extname, resolve, join } from 'path';
import { promisify } from 'util';
import { openai as openai_v5 } from '@ai-sdk/openai-v5';
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

      console.info(`Checking for workspace indicators in: ${currentDir}`);

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
    console.warn(`Error in workspace detection: ${error}`);
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
    console.info('Running install command with swpm');
    const swpmPath = createRequire(import.meta.filename).resolve('swpm');
    await spawn(swpmPath, [command, ...packageNames], { cwd });
    return;
  } catch (e) {
    console.warn('Failed to run install command with swpm', e);
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

    console.info(`Falling back to ${packageManager} ${args.join(' ')}`);
    await spawn(packageManager, args, { cwd });
    return;
  } catch (e) {
    console.warn(`Failed to run install command with native package manager: ${e}`);
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

    console.info(`📊 Git state ${label}:`);
    console.info('Status:', gitStatusResult.stdout.trim() || 'Clean working directory');
    console.info('Recent commits:', gitLogResult.stdout.trim());
    console.info('Total commits:', gitCountResult.stdout.trim());
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
    console.info(`Created new branch: ${branchName}`);
  } catch (error) {
    // If branch exists, check if we can switch to it or create a unique name
    const errorStr = error instanceof Error ? error.message : String(error);
    if (errorStr.includes('already exists')) {
      try {
        // Try to switch to existing branch
        await git(targetPath, 'checkout', branchName);
        console.info(`Switched to existing branch: ${branchName}`);
      } catch {
        // If can't switch, create a unique branch name
        const timestamp = Date.now().toString().slice(-6);
        const uniqueBranchName = `${branchName}-${timestamp}`;
        await git(targetPath, 'checkout', '-b', uniqueBranchName);
        console.info(`Created unique branch: ${uniqueBranchName}`);
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
  console.info(`📦 Created backup: ${basename(backupFile)}`);

  // Replace with template file
  await copyFile(sourceFile, targetFile);
  console.info(`🔄 Replaced file with template version (backup created)`);
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
  console.info(`📝 Copied with unique name: ${basename(uniqueTargetFile)}`);
  return uniqueTargetFile;
}

// Type guard to check if object is a valid MastraLanguageModel
export const isValidMastraLanguageModel = (model: any): model is MastraLanguageModel => {
  return model && typeof model === 'object' && typeof model.modelId === 'string';
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

// Helper function to merge .gitignore files intelligently
export const mergeGitignoreFiles = (targetContent: string, templateContent: string, templateSlug: string): string => {
  // Normalize line endings and split into lines
  const targetLines = targetContent.replace(/\r\n/g, '\n').split('\n');
  const templateLines = templateContent.replace(/\r\n/g, '\n').split('\n');

  // Parse existing target entries (normalize for comparison)
  const existingEntries = new Set<string>();

  for (const line of targetLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      // Normalize path for comparison (remove leading ./, handle different separators)
      const normalized = trimmed.replace(/^\.\//, '').replace(/\\/g, '/');
      existingEntries.add(normalized);
    }
  }

  // Extract new entries from template that don't already exist
  const newEntries: string[] = [];
  for (const line of templateLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const normalized = trimmed.replace(/^\.\//, '').replace(/\\/g, '/');
      if (!existingEntries.has(normalized)) {
        // Check for conflicts (e.g., !file vs file)
        const isNegation = normalized.startsWith('!');
        const basePath = isNegation ? normalized.slice(1) : normalized;
        const hasConflict = isNegation ? existingEntries.has(basePath) : existingEntries.has('!' + basePath);

        if (!hasConflict) {
          newEntries.push(trimmed);
        } else {
          console.info(`⚠ Skipping conflicting .gitignore rule: ${trimmed} (conflicts with existing rule)`);
        }
      }
    }
  }

  // If no new entries, return original content
  if (newEntries.length === 0) {
    return targetContent;
  }

  // Build merged content
  const result: string[] = [...targetLines];

  // Add a blank line if the file doesn't end with one
  const lastLine = result[result.length - 1];
  if (result.length > 0 && lastLine && lastLine.trim() !== '') {
    result.push('');
  }

  // Add template section header
  result.push(`# Added by template: ${templateSlug}`);
  result.push(...newEntries);

  return result.join('\n');
};

// Helper function to merge .env files intelligently
export const mergeEnvFiles = (
  targetContent: string,
  templateVariables: Record<string, string>,
  templateSlug: string,
): string => {
  // Parse existing target .env file
  const targetLines = targetContent.replace(/\r\n/g, '\n').split('\n');
  const existingVars = new Set<string>();

  // Extract existing variable names (handle comments and empty lines)
  for (const line of targetLines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const varName = trimmed.substring(0, equalIndex).trim();
        existingVars.add(varName);
      }
    }
  }

  // Filter out variables that already exist
  const newVars: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(templateVariables)) {
    if (!existingVars.has(key)) {
      newVars.push({ key, value });
    } else {
      console.info(`⚠ Skipping existing environment variable: ${key} (already exists in .env)`);
    }
  }

  // If no new variables, return original content
  if (newVars.length === 0) {
    return targetContent;
  }

  // Build merged content
  const result: string[] = [...targetLines];

  // Add a blank line if the file doesn't end with one
  const lastLine = result[result.length - 1];
  if (result.length > 0 && lastLine && lastLine.trim() !== '') {
    result.push('');
  }

  // Add template section header
  result.push(`# Added by template: ${templateSlug}`);

  // Add new environment variables
  for (const { key, value } of newVars) {
    result.push(`${key}=${value}`);
  }

  return result.join('\n');
};

// Helper function to detect AI SDK version from package.json
export const detectAISDKVersion = async (projectPath: string): Promise<'v1' | 'v2'> => {
  try {
    const packageJsonPath = join(projectPath, 'package.json');

    if (!existsSync(packageJsonPath)) {
      console.info('No package.json found, defaulting to v2');
      return 'v2';
    }

    const packageContent = await readFile(packageJsonPath, 'utf-8');
    const packageJson = JSON.parse(packageContent);

    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies,
    };

    // Check individual provider packages for version hints
    const providerPackages = ['@ai-sdk/openai', '@ai-sdk/anthropic', '@ai-sdk/google', '@ai-sdk/groq', '@ai-sdk/xai'];
    for (const pkg of providerPackages) {
      const version = allDeps[pkg];
      if (version) {
        const versionMatch = version.match(/(\d+)/);
        if (versionMatch) {
          const majorVersion = parseInt(versionMatch[1]);
          if (majorVersion >= 2) {
            console.info(`Detected ${pkg} v${majorVersion} -> using v2 specification`);
            return 'v2';
          } else {
            console.info(`Detected ${pkg} v${majorVersion} -> using v1 specification`);
            return 'v1';
          }
        }
      }
    }

    console.info('No AI SDK version detected, defaulting to v2');
    return 'v2';
  } catch (error) {
    console.warn(`Failed to detect AI SDK version: ${error instanceof Error ? error.message : String(error)}`);
    return 'v2';
  }
};

// Helper function to create model instance based on provider and version
export const createModelInstance = async (
  provider: string,
  modelId: string,
  version: 'v1' | 'v2' = 'v2',
): Promise<MastraLanguageModel | null> => {
  try {
    // Dynamic imports to avoid issues if packages aren't available
    const providerMap = {
      v1: {
        openai: async () => {
          const { openai } = await import('@ai-sdk/openai');
          return openai(modelId);
        },
        anthropic: async () => {
          const { anthropic } = await import('@ai-sdk/anthropic');
          return anthropic(modelId);
        },
        groq: async () => {
          const { groq } = await import('@ai-sdk/groq');
          return groq(modelId);
        },
        xai: async () => {
          const { xai } = await import('@ai-sdk/xai');
          return xai(modelId);
        },
        google: async () => {
          const { google } = await import('@ai-sdk/google');
          return google(modelId);
        },
      },
      v2: {
        openai: async () => {
          const { openai } = await import('@ai-sdk/openai-v5');
          return openai(modelId);
        },
        anthropic: async () => {
          const { anthropic } = await import('@ai-sdk/anthropic-v5');
          return anthropic(modelId);
        },
        groq: async () => {
          const { groq } = await import('@ai-sdk/groq-v5');
          return groq(modelId);
        },
        xai: async () => {
          const { xai } = await import('@ai-sdk/xai-v5');
          return xai(modelId);
        },
        google: async () => {
          const { google } = await import('@ai-sdk/google-v5');
          return google(modelId);
        },
      },
    };

    const providerFn = providerMap[version][provider as keyof (typeof providerMap)[typeof version]];
    if (!providerFn) {
      console.error(`Unsupported provider: ${provider}`);
      return null;
    }

    const modelInstance = await providerFn();
    console.info(`Created ${provider} model instance (${version}): ${modelId}`);
    return modelInstance;
  } catch (error) {
    console.error(`Failed to create model instance: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
};

// Helper function to resolve model from runtime context with AI SDK version detection
export const resolveModel = async ({
  runtimeContext,
  defaultModel = openai_v5('gpt-4.1'),
  projectPath,
}: {
  runtimeContext: RuntimeContext;
  defaultModel?: MastraLanguageModel;
  projectPath?: string;
}): Promise<MastraLanguageModel> => {
  // First try to get model from runtime context
  const modelFromContext = runtimeContext.get('model');
  if (modelFromContext) {
    console.info('Using model from runtime context');
    // Type check to ensure it's a MastraLanguageModel
    if (isValidMastraLanguageModel(modelFromContext)) {
      return modelFromContext;
    }
    throw new Error(
      'Invalid model provided. Model must be a MastraLanguageModel instance (e.g., openai("gpt-4"), anthropic("claude-3-5-sonnet"), etc.)',
    );
  }

  // Check for selected model info in runtime context
  const selectedModel = runtimeContext.get('selectedModel') as { provider: string; modelId: string } | undefined;
  if (selectedModel?.provider && selectedModel?.modelId && projectPath) {
    console.info(`Resolving selected model: ${selectedModel.provider}/${selectedModel.modelId}`);

    // Detect AI SDK version from project
    const version = await detectAISDKVersion(projectPath);

    // Create model instance with detected version
    const modelInstance = await createModelInstance(selectedModel.provider, selectedModel.modelId, version);
    if (modelInstance) {
      // Store resolved model back in context for other steps to use
      runtimeContext.set('model', modelInstance);
      return modelInstance;
    }
  }

  console.info('Using default model');
  return defaultModel;
};
