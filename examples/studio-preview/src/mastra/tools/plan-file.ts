import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const planRoot = path.join(os.tmpdir(), 'mastra-studio-preview', '.mastracode', 'plans');

const slugify = (value: string) => {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || 'plan';
};

export const writePlanFileTool = createTool({
  id: 'write_plan_file',
  description: 'Write a markdown plan before submitting it for review with submit_plan.',
  inputSchema: z.object({
    title: z.string().min(1).describe('Plan title.'),
    plan: z.string().min(1).describe('Full markdown plan body.'),
  }),
  execute: async ({ title, plan }, context) => {
    const threadKey = slugify(context.agent?.threadId ?? randomUUID());
    const filename = `${threadKey}-${slugify(title)}.md`;
    const planPath = path.join(planRoot, filename);
    const content = plan.trimStart().startsWith('# ') ? plan.trimEnd() : `# ${title.trim()}\n\n${plan.trimEnd()}`;

    await fs.mkdir(planRoot, { recursive: true });
    await fs.writeFile(planPath, `${content}\n`, 'utf-8');

    return {
      path: planPath,
      title: title.trim(),
      message: `Plan file written. Call submit_plan with path "${planPath}".`,
    };
  },
});
