import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { getAppDataDir } from './project.js';

/** Global plans directory for approved-plan archives. */
export function getPlansDir(): string {
  return process.env.MASTRA_PLANS_DIR ?? path.join(getAppDataDir(), 'plans');
}

/** Local (project-scoped) plans directory where the agent writes named plan files. */
export function getLocalPlansDir(projectPath: string): string {
  return path.join(projectPath, DEFAULT_CONFIG_DIR, 'plans');
}

/** Workspace-relative directory the agent writes plan files into. */
export function getLocalPlansRelativeDir(): string {
  return path.join(DEFAULT_CONFIG_DIR, 'plans');
}

function slugify(str: string): string {
  const slug = str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'untitled';
}

/** Derive a plan filename from a title (e.g. `add-dark-mode.md`). */
export function getPlanFilename(title: string): string {
  return `${slugify(title)}.md`;
}

/**
 * Suggested workspace-relative path for a new plan file, shown in plan-mode prompts.
 * Without a title we fall back to a generic name the agent can rename later.
 */
export function getSuggestedPlanRelativePath(title?: string): string {
  const filename = title ? getPlanFilename(title) : 'plan.md';
  return path.join(getLocalPlansRelativeDir(), filename);
}

/**
 * Resolve a plan path submitted by the agent (absolute or project-relative) to an
 * absolute path. Returns `undefined` when no usable path was provided.
 */
export function resolvePlanPath(projectPath: string, submittedPath: string): string | undefined {
  if (!submittedPath) return undefined;
  return path.isAbsolute(submittedPath) ? submittedPath : path.resolve(projectPath, submittedPath);
}

/**
 * Whether `targetPath` (absolute or project-relative) is a valid plan file: a `.md`
 * file located directly inside the project's `.mastracode/plans/` directory. Used by the
 * plan-mode write guard so the agent can write any named plan file there, but nothing
 * outside that directory.
 */
export function isPlanFilePath(projectPath: string, targetPath: string): boolean {
  const abs = resolvePlanPath(projectPath, targetPath);
  if (!abs) return false;
  if (path.extname(abs).toLowerCase() !== '.md') return false;

  const plansDir = path.resolve(getLocalPlansDir(projectPath));
  const rel = path.relative(plansDir, abs);
  // Must be directly inside the plans dir (no nested subdirectories, no escaping it).
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) return false;
  return !rel.includes(path.sep);
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
 * Read a plan markdown file by absolute path.
 *
 * The leading `# <title>` heading (if present) is parsed as the title and the remaining
 * content is returned as the plan body. Returns `undefined` when the file does not exist.
 */
export async function readPlanFile(absPath: string): Promise<{ title: string; plan: string } | undefined> {
  let raw: string;
  try {
    raw = await fs.readFile(absPath, 'utf-8');
  } catch {
    return undefined;
  }

  const lines = raw.split(/\r?\n/);
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
 * Approve the plan file at `planPath`: write a timestamped copy to the global plans
 * archive so approved plans are findable later. The local named plan file is left in
 * place so the user can review every plan made over time.
 *
 * Returns the local plan filename (e.g. `add-dark-mode.md`), or `undefined` when there
 * was no plan file to approve.
 */
export async function approvePlanFile(opts: {
  planPath: string;
  title: string;
  resourceId: string;
  plansDir?: string;
}): Promise<string | undefined> {
  const { planPath, title, resourceId, plansDir } = opts;

  const current = await readPlanFile(planPath);
  if (!current) {
    return undefined;
  }

  const resolvedTitle = title || current.title || 'Implementation Plan';

  // Global archive (timestamped, never overwritten) so approved plans are findable later.
  await savePlanToDisk({ title: resolvedTitle, plan: current.plan, resourceId, plansDir });

  return path.basename(planPath);
}
