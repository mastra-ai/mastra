/**
 * Sub-agent tool: list tools the workflow-builder can reference in tool-step
 * entries of the static workflow graph. Returns JSON Schema for inputs/outputs
 * so the LLM has ground truth instead of guessing.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { extractJsonSchema } from './extract-json-schema.js';

/**
 * Tools the workflow-builder shouldn't try to compose:
 *  - its own three authoring tools (recursive composition is nonsensical)
 *  - the five parent-mode workflow management tools (they manage stored
 *    workflows; they're not building blocks inside a workflow)
 */
const WORKFLOW_BUILDER_NOISE_TOOLS = new Set([
  'list-available-agents',
  'list-available-tools',
  'list-available-workflows',
  'save-workflow',
  'create-workflow',
  'list-workflows',
  'get-workflow',
  'run-workflow',
  'delete-workflow',
]);

export const listAvailableToolsTool = createTool({
  id: 'list-available-tools',
  description:
    'Returns the tools currently registered on the Mastra instance. The tool ids returned here are the only valid values you can put in `{ type: "tool", toolId }` graph entries. Each row includes `inputSchema` and `outputSchema` as JSON Schema — read them to know what fields the tool accepts and emits; never invent field names.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    tools: z.array(
      z.object({
        id: z.string(),
        description: z.string().optional(),
        inputSchema: z.any().optional(),
        outputSchema: z.any().optional(),
      }),
    ),
  }),
  execute: async (_input, { mastra }) => {
    if (!mastra) throw new Error('list-available-tools requires a Mastra context.');
    const all = (mastra as { listTools?: () => Record<string, unknown> }).listTools?.() ?? {};
    return {
      tools: Object.entries(all)
        .filter(([id]) => !WORKFLOW_BUILDER_NOISE_TOOLS.has(id))
        .map(([id, t]) => {
          const tool = t as { description?: string; inputSchema?: unknown; outputSchema?: unknown } | undefined;
          return {
            id,
            description: tool?.description,
            inputSchema: extractJsonSchema(tool?.inputSchema, 'input'),
            outputSchema: extractJsonSchema(tool?.outputSchema, 'output'),
          };
        }),
    };
  },
});
