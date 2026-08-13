/**
 * Parent-mode tool: list saved workflows. Read-only, available in all modes.
 */
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { DynamicWorkflowAccessPolicy } from '../../workflows/access-policy.js';
import { createWorkflowService } from '../../workflows/service.js';

export function createListWorkflowsTool(accessPolicy?: DynamicWorkflowAccessPolicy) {
  const service = createWorkflowService({ accessPolicy });
  return createTool({
    id: 'list-workflows',
    description: 'List active Dynamic Workflows persisted to storage. Returns id + description + status for each.',
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
    execute: async (_input, { mastra, requestContext }) => {
      if (!mastra) throw new Error('list-workflows requires a Mastra context.');
      const { workflows, total } = await service.listWorkflows(mastra as Mastra, { requestContext });
      return {
        workflows: workflows.map(wf => ({ id: wf.id, description: wf.description, status: wf.status })),
        total,
      };
    },
  });
}

export const listWorkflowsTool = createListWorkflowsTool();
