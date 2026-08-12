/**
 * Parent-mode tool: delete a saved workflow from storage and unregister the
 * live in-process Workflow instance so a subsequent save-workflow with the
 * same id re-registers cleanly.
 */
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { deleteWorkflow } from '../../workflows/service.js';

export const deleteWorkflowTool = createTool({
  id: 'delete-workflow',
  description:
    'Remove a saved workflow from storage and unregister the live in-process Workflow instance. Idempotent. Subsequent save-workflow calls with the same id re-register cleanly.',
  inputSchema: z.object({
    id: z.string().describe('The workflow id to delete.'),
  }),
  outputSchema: z.object({
    ok: z.literal(true),
    id: z.string(),
  }),
  execute: async ({ id }, { mastra }) => {
    if (!mastra) throw new Error('delete-workflow requires a Mastra context.');
    return deleteWorkflow(mastra as Mastra, id);
  },
});
