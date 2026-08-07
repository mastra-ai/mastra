/**
 * Sub-agent tool: list workflows the workflow-builder can reference in
 * `{ type: "workflow", workflowId }` graph entries. Includes both code-defined
 * and stored workflows, so the builder can nest one workflow inside another.
 * Excludes the workflow currently being authored to prevent self-reference at
 * discovery time (the pre-flight validator will still reject cycles).
 */
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { extractJsonSchema } from './extract-json-schema.js';

export const listAvailableWorkflowsTool = createTool({
  id: 'list-available-workflows',
  description:
    'Returns the workflows currently registered on the Mastra instance (both code-defined and stored). The ids returned here are the only valid values you can put in `{ type: "workflow", workflowId }` graph entries. Each row includes `inputSchema` and `outputSchema` as JSON Schema — read them to know what shape the nested workflow expects and produces; never invent field names.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    workflows: z.array(
      z.object({
        id: z.string(),
        description: z.string().optional(),
        inputSchema: z.any().optional(),
        outputSchema: z.any().optional(),
      }),
    ),
  }),
  execute: async (_input, { mastra }) => {
    if (!mastra) throw new Error('list-available-workflows requires a Mastra context.');
    const all = (mastra as Mastra).listWorkflows?.() ?? {};
    return {
      workflows: Object.entries(all).map(([id, wf]) => {
        const w = wf as { description?: string; inputSchema?: unknown; outputSchema?: unknown } | undefined;
        return {
          id,
          description: w?.description,
          inputSchema: extractJsonSchema(w?.inputSchema, 'input'),
          outputSchema: extractJsonSchema(w?.outputSchema, 'output'),
        };
      }),
    };
  },
});
