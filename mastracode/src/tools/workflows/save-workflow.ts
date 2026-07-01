/**
 * Sub-agent tool: persist the static workflow definition and live-register it.
 * Calls `mastra.addStoredWorkflow()` — the same path `POST /api/stored/workflows`
 * takes. After this returns the workflow is immediately runnable.
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

interface AddStoredWorkflowable {
  addStoredWorkflow: (def: {
    id: string;
    description?: string;
    inputSchema: unknown;
    outputSchema: unknown;
    graph: unknown[];
  }) => Promise<void>;
}

export const saveWorkflowTool = createTool({
  id: 'save-workflow',
  description:
    'Persist a static workflow definition and live-register it on the running Mastra instance. After this returns, the workflow is immediately runnable. Use this once you have the full definition; do not call it incrementally.',
  inputSchema: z.object({
    id: z.string().describe('Workflow id — kebab-case, descriptive.'),
    description: z.string().optional(),
    inputSchema: z.any().describe('JSON Schema (Draft 2020-12) for the workflow input.'),
    outputSchema: z.any().describe('JSON Schema (Draft 2020-12) for the workflow output.'),
    graph: z
      .array(z.any())
      .describe(
        'The static workflow graph as SerializedStepFlowEntry[]. Each entry is one of: { type: "tool", id, toolId }, { type: "agent", id, agentId }, { type: "mapping", id, mapConfig: <JSON-string of object with template/value/step sources> }.',
      ),
  }),
  outputSchema: z.object({
    ok: z.literal(true),
    id: z.string(),
  }),
  execute: async (def, { mastra }) => {
    if (!mastra) throw new Error('save-workflow requires a Mastra context.');
    await (mastra as unknown as AddStoredWorkflowable).addStoredWorkflow(def);
    return { ok: true as const, id: def.id };
  },
});
