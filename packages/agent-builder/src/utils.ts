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

export async function spawnSWPM(cwd: string, command: string, packageNames: string[]) {
  await spawn(createRequire(import.meta.filename).resolve('swpm'), [command, ...packageNames], {
    cwd,
  });
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
    const gitStatusResult = await exec('git status --porcelain', { cwd: targetPath });
    const gitLogResult = await exec('git log --oneline -3', { cwd: targetPath });
    const gitCountResult = await exec('git rev-list --count HEAD', { cwd: targetPath });

    console.log(`📊 Git state ${label}:`);
    console.log('Status:', gitStatusResult.stdout.trim() || 'Clean working directory');
    console.log('Recent commits:', gitLogResult.stdout.trim());
    console.log('Total commits:', gitCountResult.stdout.trim());
  } catch (gitError) {
    console.warn(`Could not get git state ${label}:`, gitError);
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
