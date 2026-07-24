/**
 * Parent-mode tool: inspect a saved workflow's full definition.
 */
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getWorkflow } from '../../workflows/service.js';

export const getWorkflowTool = createTool({
  id: 'get-workflow',
  description: 'Return the full stored definition of a workflow (input/output schemas + the step graph).',
  inputSchema: z.object({
    id: z.string().describe('The workflow id.'),
  }),
  outputSchema: z.object({
    id: z.string(),
    description: z.string().optional(),
    status: z.enum(['active', 'archived']),
    inputSchema: z.any().optional(),
    outputSchema: z.any().optional(),
    graph: z.array(z.any()).optional(),
  }),
  execute: async ({ id }, { mastra }) => {
    if (!mastra) throw new Error('get-workflow requires a Mastra context.');
    const def = await getWorkflow(mastra as Mastra, id);
    if (!def) throw new Error(`No workflow with id "${id}".`);
    return {
      id: def.id,
      description: def.description,
      status: def.status,
      inputSchema: def.inputSchema,
      outputSchema: def.outputSchema,
      graph: def.graph,
    };
  },
});
