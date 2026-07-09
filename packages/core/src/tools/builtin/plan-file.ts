import fs from 'node:fs/promises';
import path from 'node:path';

const LOCAL_PLAN_DIR = ['.mastracode', 'plans'];

export interface PlanFile {
  title: string;
  plan: string;
}

/**
 * Resolve the project root `submit_plan` reads plan files from.
 *
 * Honors the submit-plan-specific override first (used by hosts like the Studio
 * preview that write plans into a writable temp dir), then the general
 * `MASTRA_PROJECT_ROOT` the CLI sets during `dev`/`start`, then the current working
 * directory. The writer tool and this reader share the exact same chain so they always
 * agree on where plan files live.
 */
export const getSubmitPlanProjectRoot = (projectRoot?: string): string =>
  path.resolve(
    projectRoot ?? process.env.MASTRA_SUBMIT_PLAN_PROJECT_ROOT ?? process.env.MASTRA_PROJECT_ROOT ?? process.cwd(),
  );

/**
 * Resolve a submitted plan path (absolute or project-relative) to an absolute path,
 * but only when it is a `.md` file located directly inside the project's
 * `.mastracode/plans` directory. Returns `undefined` for anything else, so the tool
 * never reads arbitrary files off disk.
 */
export const resolveLocalPlanPath = (projectRoot: string, submittedPath: string): string | undefined => {
  if (!submittedPath) return undefined;

  const root = path.resolve(projectRoot);
  const target = path.isAbsolute(submittedPath) ? path.resolve(submittedPath) : path.resolve(root, submittedPath);

  if (path.extname(target).toLowerCase() !== '.md') {
    return undefined;
  }

  const plansDir = path.resolve(root, ...LOCAL_PLAN_DIR);
  const relative = path.relative(plansDir, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || relative.includes(path.sep)) {
    return undefined;
  }

  return target;
};

const parsePlanFile = (raw: string): PlanFile => {
  const lines = raw.split(/\r?\n/);
  const headingIndex = lines.findIndex(line => line.trim().length > 0);
  const heading = headingIndex >= 0 ? lines[headingIndex] : undefined;

  if (heading?.startsWith('# ')) {
    return {
      title: heading.slice(2).trim(),
      plan: lines
        .slice(headingIndex + 1)
        .join('\n')
        .replace(/^\n+/, '')
        .trimEnd(),
    };
  }

  return { title: '', plan: raw.trimEnd() };
};

/**
 * Read a plan markdown file by absolute path.
 *
 * The leading `# <title>` heading (if present) is parsed as the title and the remaining
 * content is returned as the plan body. Returns `undefined` when the file cannot be read.
 */
export const readPlanFile = async (absPath: string): Promise<PlanFile | undefined> => {
  try {
    return parsePlanFile(await fs.readFile(absPath, 'utf-8'));
  } catch {
    return undefined;
  }
};
