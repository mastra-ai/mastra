/**
 * Sub-agent tool: list agents the workflow-builder can reference in agent-step
 * entries of a Dynamic Workflow graph. Read-only.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

/** Self / management tools the workflow-builder shouldn't recursively try to compose. */
const WORKFLOW_BUILDER_NOISE_AGENTS = new Set(['workflow-builder']);

export const listAvailableAgentsTool = createTool({
  id: 'list-available-agents',
  description:
    'Returns the agents currently registered on the Mastra instance. The agent ids returned here are the only valid values you can put in `{ type: "agent", agentId }` graph entries. `outputShape` describes the default text output; an entry-level `outputSchema` replaces that default with structured output.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    agents: z.array(
      z.object({
        id: z.string(),
        description: z.string().optional(),
        // Human-readable string in v1. Could become a JSON Schema now that
        // structuredOutput round-trips through the rehydrator
        // (packages/core/src/workflows/rehydrate-workflow.ts).
        outputShape: z.string(),
      }),
    ),
  }),
  execute: async (_input, { mastra }) => {
    if (!mastra) throw new Error('list-available-agents requires a Mastra context.');
    const all = (mastra as { listAgents?: () => Record<string, unknown> }).listAgents?.() ?? {};
    return {
      agents: Object.entries(all)
        .filter(([id]) => !WORKFLOW_BUILDER_NOISE_AGENTS.has(id))
        .map(([id, a]) => ({
          id,
          description: (a as { description?: string } | undefined)?.description,
          outputShape: 'Default: { text: string }. An entry-level outputSchema produces that schema instead.',
        })),
    };
  },
});
