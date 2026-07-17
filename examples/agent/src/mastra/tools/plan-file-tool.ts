import fs from 'node:fs/promises';
import path from 'node:path';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const PLAN_DIR = path.join('.mastracode', 'plans');

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'plan';
};

export const writePlanFileTool = createTool({
  id: 'write_plan_file',
  description:
    'Write a markdown plan under .mastracode/plans before submitting it for review. After this tool returns, call submit_plan with the returned path.',
  inputSchema: z.object({
    title: z.string().min(1).describe('Plan title. This becomes the first markdown heading.'),
    plan: z.string().min(1).describe('Full markdown plan body.'),
  }),
  execute: async ({ title, plan }) => {
    const filename = `${slugify(title)}.md`;
    const relativePath = path.posix.join('.mastracode', 'plans', filename);
    const projectRoot = path.resolve(process.env.MASTRA_PROJECT_ROOT ?? process.cwd());
    const planDir = path.join(projectRoot, PLAN_DIR);
    const planPath = path.join(planDir, filename);
    const content = plan.trimStart().startsWith('# ') ? plan.trimEnd() : `# ${title.trim()}\n\n${plan.trimEnd()}`;

    await fs.mkdir(planDir, { recursive: true });
    await fs.writeFile(planPath, `${content}\n`, 'utf-8');

    return {
      path: relativePath,
      title: title.trim(),
      message: `Plan file written. Call submit_plan with path "${relativePath}".`,
    };
  },
});
