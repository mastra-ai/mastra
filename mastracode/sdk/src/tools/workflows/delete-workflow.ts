/**
 * Parent-mode tool: delete a saved workflow from storage. The live-registered
 * Workflow instance stays in `mastra.#workflows` until the next process
 * restart — separate concern; this just removes the persistence row so the
 * boot-time loader doesn't re-register it next time.
 */
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { deleteWorkflow } from '../../workflows/service.js';

export const deleteWorkflowTool = createTool({
  id: 'delete-workflow',
  description:
    'Remove a saved workflow from storage. Idempotent. Note: the in-process Workflow instance stays registered until the next mastracode restart.',
  inputSchema: z.object({
    id: z.string().describe('The workflow id to delete.'),
  }),
  outputSchema: z.object({
    ok: z.literal(true),
    id: z.string(),
  }),
  execute: async ({ id }, { mastra }) => {
    if (!mastra) throw new Error('delete-workflow requires a Mastra context.');
    return deleteWorkflow(mastra as unknown as Mastra, id);
  },
});
