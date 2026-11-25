import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG_DIR } from '../constants.js';
import { getAppDataDir } from './project.js';

/** Global plans directory for approved-plan archives. */
export function getPlansDir(): string {
  return process.env.MASTRA_PLANS_DIR ?? path.join(getAppDataDir(), 'plans');
}

export interface LocalPlansOptions {
  factoryProjectId?: string | null;
  /** Host-configured workspace-relative plans directory; wins over the default. */
  plansDir?: string;
}

/** Workspace-relative directory the agent writes plan files into. */
export function getLocalPlansRelativeDir(options: LocalPlansOptions = {}): string {
  if (options.plansDir) {
    const dir = path.normalize(options.plansDir);
    let end = dir.length;
    while (end > 0 && (dir[end - 1] === '/' || dir[end - 1] === '\\')) end--;
    return dir.slice(0, end);
  }
  return options.factoryProjectId ? path.join('.artifacts', 'plans') : path.join(DEFAULT_CONFIG_DIR, 'plans');
}

/** Local (project-scoped) plans directory where the agent writes named plan files. */
export function getLocalPlansDir(projectPath: string, options: LocalPlansOptions = {}): string {
  return path.join(projectPath, getLocalPlansRelativeDir(options));
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
export function getSuggestedPlanRelativePath(title?: string, options: LocalPlansOptions = {}): string {
  const filename = title ? getPlanFilename(title) : 'plan.md';
  return path.join(getLocalPlansRelativeDir(options), filename);
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
 * file located directly inside the project's configured plan directory. Used by the
 * plan-mode write guard so the agent can write any named plan file there, but nothing
 * outside that directory.
 */
export function isPlanFilePath(projectPath: string, targetPath: string, options: LocalPlansOptions = {}): boolean {
  const abs = resolvePlanPath(projectPath, targetPath);
  if (!abs) return false;
  if (path.extname(abs).toLowerCase() !== '.md') return false;

  const plansDir = path.resolve(getLocalPlansDir(projectPath, options));
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
 * Split plan markdown into its title and body.
 *
 * The leading `# <title>` heading (if present) is the title and the remaining content is
 * the plan body. Used both when reading a plan from local disk and when a host reads one
 * through a session workspace filesystem.
 */
export function parsePlanContent(raw: string): { title: string; plan: string } {
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

  return parsePlanContent(raw);
}

/**
 * Approve the plan file at `planPath`: write a timestamped copy to the global plans
 * archive so approved plans are findable later. The local named plan file is left in
 * place so the user can review every plan made over time.
 *
 * Pass `plan` — the text the user actually reviewed — whenever the caller has it.
 * The file can be edited, moved or removed while the approval card is open, so
 * re-reading it can archive something the user never approved. Reading the file
 * stays as the fallback for callers with no reviewed text.
 *
 * Returns the local plan filename (e.g. `add-dark-mode.md`), or `undefined` when there
 * was no plan to approve.
 */
export async function approvePlanFile(opts: {
  planPath: string;
  title: string;
  resourceId: string;
  plansDir?: string;
  /** The reviewed plan text. Preferred over re-reading the file at `planPath`. */
  plan?: string;
}): Promise<string | undefined> {
  const { planPath, title, resourceId, plansDir, plan } = opts;

  const reviewed = plan?.trim() ? plan : undefined;
  const current = reviewed ? undefined : await readPlanFile(planPath);
  const approvedPlan = reviewed ?? current?.plan;
  if (approvedPlan === undefined) {
    return undefined;
  }

  const resolvedTitle = title || current?.title || 'Implementation Plan';

  // Global archive (timestamped, never overwritten) so approved plans are findable later.
  await savePlanToDisk({ title: resolvedTitle, plan: approvedPlan, resourceId, plansDir });

  return path.basename(planPath);
}
