/**
 * Parent-mode tool: list saved workflows. Read-only, available in all modes.
 */
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { listWorkflows } from '../../workflows/service.js';

export const listWorkflowsTool = createTool({
  id: 'list-workflows',
  description: 'List static workflows persisted to storage. Returns id + description + status for each.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    workflows: z.array(
      z.object({
        id: z.string(),
        description: z.string().optional(),
        status: z.enum(['active', 'archived']),
      }),
    ),
    total: z.number(),
  }),
  execute: async (_input, { mastra }) => {
    if (!mastra) throw new Error('list-workflows requires a Mastra context.');
    const { workflows, total } = await listWorkflows(mastra as Mastra);
    return {
      workflows: workflows.map(wf => ({ id: wf.id, description: wf.description, status: wf.status })),
      total,
    };
  },
});
