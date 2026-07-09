import fs from 'node:fs/promises';
import path from 'node:path';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const PLAN_DIR = ['.mastracode', 'plans'];

const defaultResolveProjectRoot = () =>
  path.resolve(process.env.MASTRA_SUBMIT_PLAN_PROJECT_ROOT ?? process.env.MASTRA_PROJECT_ROOT ?? process.cwd());

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'plan';
};

const normalizeFilename = (title: string, filename?: string) => {
  const rawFilename = filename?.trim() || `${slugify(title)}.md`;
  const normalized = rawFilename.startsWith('.mastracode/plans/')
    ? rawFilename.slice('.mastracode/plans/'.length)
    : rawFilename;

  if (normalized.includes('/') || normalized.includes('\\')) {
    throw new Error('Plan filename must be a direct markdown file under .mastracode/plans.');
  }

  const withExtension = normalized.endsWith('.md') ? normalized : `${normalized}.md`;
  return slugify(withExtension.replace(/\.md$/i, '')) + '.md';
};

export interface CreateWritePlanFileToolOptions {
  /**
   * Resolve the project root the plan file is written under. Defaults to the
   * `MASTRA_SUBMIT_PLAN_PROJECT_ROOT` → `MASTRA_PROJECT_ROOT` → `process.cwd()` chain,
   * matching where the built-in `submit_plan` tool reads plan files from. Hosts with a
   * read-only filesystem (e.g. the serverless Studio preview) pass a resolver that points
   * at a writable directory.
   */
  resolveProjectRoot?: () => string;
  /** Example filename shown in the `filename` field description. */
  filenameExample?: string;
}

/**
 * Build a `write_plan_file` tool: it writes a markdown plan under `.mastracode/plans` so a
 * plain agent (one without generic filesystem tools) can materialize the file that
 * `submit_plan` then reads and submits for review.
 */
export const createWritePlanFileTool = ({
  resolveProjectRoot = defaultResolveProjectRoot,
  filenameExample = 'recipe-plan.md',
}: CreateWritePlanFileToolOptions = {}) =>
  createTool({
    id: 'write_plan_file',
    description:
      'Write a markdown plan file under .mastracode/plans before submitting it for review. After this tool returns, call submit_plan with the returned path.',
    inputSchema: z.object({
      title: z.string().min(1).describe('Plan title. This becomes the first markdown heading.'),
      plan: z.string().min(1).describe('Full markdown plan body to write to disk. Do not pass only a summary.'),
      filename: z
        .string()
        .optional()
        .describe(`Optional markdown filename inside .mastracode/plans, for example ${filenameExample}.`),
    }),
    execute: async ({ title, plan, filename }) => {
      const resolvedFilename = normalizeFilename(title, filename);
      const relativePath = path.posix.join('.mastracode', 'plans', resolvedFilename);
      const planDir = path.join(resolveProjectRoot(), ...PLAN_DIR);
      const planPath = path.join(planDir, resolvedFilename);
      const content = plan.trimStart().startsWith('# ') ? plan.trimEnd() : `# ${title.trim()}\n\n${plan.trimEnd()}`;

      await fs.mkdir(planDir, { recursive: true });
      await fs.writeFile(planPath, `${content}\n`, 'utf-8');

      return {
        path: relativePath,
        title: title.trim(),
        bytes: Buffer.byteLength(content, 'utf-8'),
        message: `Plan file written. Call submit_plan with path "${relativePath}".`,
      };
    },
  });

export const writePlanFileTool = createWritePlanFileTool();
