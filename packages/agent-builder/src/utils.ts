import { exec as execNodejs, spawn as nodeSpawn } from 'child_process';
import { existsSync } from 'fs';
import { copyFile } from 'fs/promises';
import { createRequire } from 'module';
import { dirname, basename, extname, resolve } from 'path';
import { promisify } from 'util';
import { UNIT_KINDS } from './types';
import type { UnitKind } from './types';

export const exec = promisify(execNodejs);

export function spawn(command: string, args: string[], options: any) {
  return new Promise((resolve, reject) => {
    const childProcess = nodeSpawn(command, args, {
      // stdio: 'inherit',
      ...options,
    });
    childProcess.on('error', error => {
      reject(error);
    });
    let stderr = '';
    childProcess.stderr?.on('data', message => {
      stderr += message;
    });
    childProcess.on('close', code => {
      if (code === 0) {
        resolve(void 0);
      } else {
        reject(new Error(stderr));
      }
    });
  });
}

// Variant of spawn that captures stdout and stderr
export function spawnWithOutput(
  command: string,
  args: string[],
  options: any,
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
      stdout += chunk?.toString?.() ?? String(chunk);
    });
    childProcess.stderr?.on('data', chunk => {
      stderr += chunk?.toString?.() ?? String(chunk);
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
    const swpmPath = createRequire(import.meta.filename).resolve('swpm');
    await spawn(swpmPath, [command, ...packageNames], { cwd });
    return;
  } catch {
    // ignore and try fallbacks
  }

  // 2) Fallback to npx -y swpm
  try {
    await spawn('npx', ['-y', 'swpm', command, ...packageNames], { cwd });
    return;
  } catch {
    // ignore and try native package manager
  }
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
  await git(cwd, 'checkout', ref);
}

export async function gitRevParse(cwd: string, rev: string): Promise<string> {
  const { stdout } = await git(cwd, 'rev-parse', rev);
  return stdout.trim();
}

export async function gitAddFiles(cwd: string, files: string[]) {
  if (!files || files.length === 0) return;
  await git(cwd, 'add', ...files);
}

export async function gitAddAll(cwd: string) {
  await git(cwd, 'add', '.');
}

export async function gitHasStagedChanges(cwd: string): Promise<boolean> {
  const { stdout } = await git(cwd, 'diff', '--cached', '--name-only');
  return stdout.trim().length > 0;
}

export async function gitCommit(
  cwd: string,
  message: string,
  opts?: { allowEmpty?: boolean; skipIfNoStaged?: boolean },
): Promise<boolean> {
  try {
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
  if (files && files.length > 0) {
    await gitAddFiles(cwd, files);
  } else {
    await gitAddAll(cwd);
  }
  return gitCommit(cwd, message, opts);
}

export async function gitCheckoutBranch(branchName: string, baseBranchName: string, targetPath: string) {
  try {
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
        branchName = `${baseBranchName}-${timestamp}`;
        await git(targetPath, 'checkout', '-b', branchName);
        console.log(`Created unique branch: ${branchName}`);
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
