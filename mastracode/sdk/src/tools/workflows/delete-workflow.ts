/**
 * Parent-mode tool: delete a saved dynamic workflow from storage and
 * unregister its live in-process instance.
 */
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import type { DynamicWorkflowAccessPolicy } from '../../workflows/access-policy.js';
import { createWorkflowService } from '../../workflows/service.js';

export function createDeleteWorkflowTool(accessPolicy?: DynamicWorkflowAccessPolicy) {
  const service = createWorkflowService({ accessPolicy });
  return createTool({
    id: 'delete-workflow',
    description:
      'Remove a saved dynamic workflow from storage and unregister its live in-process instance. Idempotent.',
    inputSchema: z.object({
      id: z.string().describe('The workflow id to delete.'),
    }),
    outputSchema: z.object({
      ok: z.literal(true),
      id: z.string(),
    }),
    execute: async ({ id }, { mastra, requestContext }) => {
      if (!mastra) throw new Error('delete-workflow requires a Mastra context.');
      return service.deleteWorkflow(mastra as Mastra, id, { requestContext });
    },
  });
}

export const deleteWorkflowTool = createDeleteWorkflowTool();
