import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { getAppDataDir } from './project.js';

/** The working plan filename within a thread-scoped plan directory. */
export const CURRENT_PLAN_FILENAME = 'current-plan.md';

/** Global plans directory for approved plans. */
export function getPlansDir(): string {
  return process.env.MASTRA_PLANS_DIR ?? path.join(getAppDataDir(), 'plans');
}

/** Local (project-scoped) plans directory for the working plan file + approved archives. */
export function getLocalPlansDir(projectPath: string): string {
  return path.join(projectPath, DEFAULT_CONFIG_DIR, 'plans');
}

function encodeThreadId(threadId: string): string {
  return encodeURIComponent(threadId);
}

/** Local directory for one thread's working plan file. */
export function getThreadPlansDir(projectPath: string, threadId: string): string {
  return path.join(getLocalPlansDir(projectPath), 'threads', encodeThreadId(threadId));
}

/** Path to show in the approval UI, relative to `.mastracode/plans/`. */
export function getCurrentPlanFilename(threadId: string): string {
  return path.join('threads', encodeThreadId(threadId), CURRENT_PLAN_FILENAME);
}

/** Workspace-relative path to the thread-scoped working plan file. */
export function getCurrentPlanRelativePath(threadId: string): string {
  return path.join(DEFAULT_CONFIG_DIR, 'plans', getCurrentPlanFilename(threadId));
}

/** Absolute path to the thread-scoped working plan file. */
export function getCurrentPlanPath(projectPath: string, threadId: string): string {
  return path.join(getThreadPlansDir(projectPath, threadId), CURRENT_PLAN_FILENAME);
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
  const baseDir = path.resolve(plansDir);
  const dir = path.resolve(baseDir, resourceId);
  const rel = path.relative(baseDir, dir);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Invalid resourceId: ${resourceId}`);
  }

  await fs.mkdir(dir, { recursive: true });

  const now = new Date();
  const timestamp = now.toISOString().replace(/:/g, '-');
  const slug = slugify(title);
  const filename = `${timestamp}-${slug}.md`;

  const content = `# ${title}\n\nApproved: ${now.toISOString()}\n\n${plan}\n`;

  await fs.writeFile(path.join(dir, filename), content, 'utf-8');
}

/**
 * Read the thread-scoped working plan file.
 *
 * The leading `# <title>` heading (if present) is parsed as the title and the remaining
 * content is returned as the plan body. Returns `undefined` when the file does not exist.
 */
export async function readCurrentPlan(
  projectPath: string,
  threadId: string,
): Promise<{ title: string; plan: string } | undefined> {
  const target = getCurrentPlanPath(projectPath, threadId);
  let raw: string;
  try {
    raw = await fs.readFile(target, 'utf-8');
  } catch {
    return undefined;
  }

  const lines = raw.split('\n');
  const headingIndex = lines.findIndex(line => line.trim().length > 0);
  const heading = headingIndex >= 0 ? lines[headingIndex] : undefined;
  if (heading?.startsWith('# ')) {
    const title = heading.slice(2).trim();
    const plan = lines
      .slice(headingIndex + 1)
      .join('\n')
      .replace(/^\n+/, '')
      .trimEnd();
    return { title, plan };
  }

  return { title: '', plan: raw.trimEnd() };
}

/**
 * Approve the thread-scoped working plan: archive `current-plan.md` to a stable,
 * title-derived local name (`.mastracode/plans/<slug>.md`), write a copy to the
 * global plans archive, then delete the thread working file so the next plan in
 * this thread starts fresh.
 *
 * Returns the archived local filename (e.g. `add-dark-mode.md`), or `undefined` when there
 * was no working plan file to approve.
 */
export async function approveCurrentPlan(opts: {
  title: string;
  projectPath: string;
  resourceId: string;
  threadId: string;
  plansDir?: string;
}): Promise<string | undefined> {
  const { title, projectPath, resourceId, threadId, plansDir } = opts;

  const current = await readCurrentPlan(projectPath, threadId);
  if (!current) {
    return undefined;
  }

  const resolvedTitle = title || current.title || 'Implementation Plan';
  const baseDir = path.resolve(getLocalPlansDir(projectPath));
  const filename = `${slugify(resolvedTitle)}.md`;
  const target = path.resolve(baseDir, filename);
  const rel = path.relative(baseDir, target);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`Invalid plan title: ${resolvedTitle}`);
  }

  const content = `# ${resolvedTitle}\n\n${current.plan}\n`;
  await fs.mkdir(baseDir, { recursive: true });
  await fs.writeFile(target, content, 'utf-8');

  // Global archive (timestamped, never overwritten) so approved plans are findable later.
  await savePlanToDisk({ title: resolvedTitle, plan: current.plan, resourceId, plansDir });

  // Delete the working file so the next plan re-creates a fresh current-plan.md.
  await fs.rm(getCurrentPlanPath(projectPath, threadId), { force: true });

  return filename;
}

/** Derive the plan filename from a title without writing to disk. */
export function getPlanFilename(title: string): string {
  return `${slugify(title)}.md`;
}
