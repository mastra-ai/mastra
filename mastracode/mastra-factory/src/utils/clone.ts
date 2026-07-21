import fs from 'node:fs';
import path from 'node:path';

import { execFileAsync } from './exec.js';

export const DEFAULT_TEMPLATE_REPO = 'https://github.com/mastra-ai/softwarefactory-template';

export interface CloneOptions {
  /** Git URL of the template repo. */
  repoUrl: string;
  /** Absolute path to create the project at (must not exist). */
  projectPath: string;
  /** Optional tag/branch to pin (`--template-ref`). */
  ref?: string;
  /** Local directory override — copies instead of cloning (development/tests). */
  localDir?: string;
}

/** Clone (or copy) the template without git history into `projectPath`. */
export async function cloneTemplate(options: CloneOptions): Promise<void> {
  const { repoUrl, projectPath, ref, localDir } = options;
  if (fs.existsSync(projectPath)) {
    throw new Error(`Directory ${path.basename(projectPath)} already exists`);
  }

  if (localDir) {
    fs.cpSync(localDir, projectPath, {
      recursive: true,
      filter: src => !src.split(path.sep).includes('node_modules') && !src.split(path.sep).includes('.git'),
    });
    return;
  }

  const args = ['clone', '--depth', '1'];
  if (ref) args.push('--branch', ref);
  args.push(repoUrl, projectPath);
  try {
    await execFileAsync('git', args);
  } catch (err) {
    throw new Error(
      `Failed to clone template from ${repoUrl}${ref ? `@${ref}` : ''}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  fs.rmSync(path.join(projectPath, '.git'), { recursive: true, force: true });
}

/** Rewrite the scaffolded package.json name to the chosen project name. */
export function renameProject(projectPath: string, projectName: string): void {
  const pkgPath = path.join(projectPath, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
  pkg.name = toPackageName(projectName);
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

/** Best-effort conversion of a directory name into a valid npm package name. */
export function toPackageName(name: string): string {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9-_.~]+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '');
  return cleaned || 'softwarefactory';
}
