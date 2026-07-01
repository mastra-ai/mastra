/**
 * Parent-mode tool: run a saved workflow with input data. Returns the run
 * result inline so the parent agent can summarise / chain it.
 */
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { runWorkflow } from '../../workflows/service.js';

export const runWorkflowTool = createTool({
  id: 'run-workflow',
  description:
    'Run a saved workflow by id with the provided input data. Returns the run result inline. Use when the user asks you to "run X", "execute X", or asks for the outcome of a saved workflow.',
  inputSchema: z.object({
    workflowId: z.string().describe('The id of the saved workflow to run.'),
    inputData: z.any().describe('The input object the workflow consumes. Must match the workflow inputSchema.'),
  }),
  outputSchema: z.object({
    status: z.string(),
    result: z.any().optional(),
    error: z.any().optional(),
  }),
  execute: async ({ workflowId, inputData }, { mastra, requestContext }) => {
    if (!mastra) throw new Error('run-workflow requires a Mastra context.');
    // Forward the caller's requestContext so agent steps (code-agent's
    // getDynamicModel + memory processors) can resolve. When code-agent
    // invokes this tool, requestContext already contains its `controller`
    // and `MastraMemory` bindings — same shape /workflows run builds
    // synthetically. See packages/core/src/tools/tool.ts:389-406.
    const result = await runWorkflow(mastra as unknown as Mastra, workflowId, inputData, requestContext);
    return { status: result.status, result: result.result, error: result.error };
  },
});
