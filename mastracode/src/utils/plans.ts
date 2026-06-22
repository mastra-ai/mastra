import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { getAppDataDir } from './project.js';

/** Global plans directory for approved plans. */
export function getPlansDir(): string {
  return process.env.MASTRA_PLANS_DIR ?? path.join(getAppDataDir(), 'plans');
}

/** Local (project-scoped) plans directory for in-progress plan editing. */
export function getLocalPlansDir(projectPath: string): string {
  return path.join(projectPath, DEFAULT_CONFIG_DIR, 'plans');
}

function slugify(str: string): string {
  const slug = str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'untitled';
}

export async function savePlanToDisk(opts: {
  title: string;
  plan: string;
  resourceId: string;
  plansDir?: string;
}): Promise<void> {
  const { title, plan, resourceId } = opts;
  const plansDir = opts.plansDir ?? getPlansDir();
  const dir = path.join(plansDir, resourceId);

  await fs.mkdir(dir, { recursive: true });

  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, '-');
  const slug = slugify(title);
  const filename = `${timestamp}-${slug}.md`;

  const content = `# ${title}\n\nApproved: ${now.toISOString()}\n\n${plan}\n`;

  await fs.writeFile(path.join(dir, filename), content, 'utf-8');
}

/**
 * Write a plan snapshot to disk on each submission (not just approval).
 * This lets users view/edit the plan file and enables diffing between revisions.
 * The snapshot writes to `$cwd/.mastracode/plans/<resourceId>/current-plan.md`
 * so the agent can read and edit it with regular workspace tools.
 */
export async function savePlanSnapshot(opts: {
  title: string;
  plan: string;
  resourceId: string;
  projectPath: string;
  plansDir?: string;
}): Promise<void> {
  const { title, plan, resourceId, projectPath } = opts;
  const plansDir = opts.plansDir ?? getLocalPlansDir(projectPath);
  const dir = path.join(plansDir, resourceId);

  await fs.mkdir(dir, { recursive: true });

  const content = `# ${title}\n\n${plan}\n`;
  await fs.writeFile(path.join(dir, 'current-plan.md'), content, 'utf-8');
}
