/**
 * Server-side tools the workflow-builder-agent uses.
 *
 * All three are real Mastra tools (no closures, no per-process state). They
 * read everything they need from `mastra` on the tool execution context, so
 * they work identically when the agent runs in a CLI demo or inside a Mastra
 * HTTP server hosted somewhere else.
 *
 * The agent's authoring loop:
 *   1. list-available-tools / list-available-agents — discover the registry
 *   2. (think) construct the entire static workflow definition
 *   3. save-workflow — persist + live-register in one shot
 */
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

export const listAvailableAgentsTool = createTool({
  id: 'list-available-agents',
  description:
    'Returns the agents currently registered on the Mastra instance. The agent ids returned here are the only valid values you can put in `{ type: "agent", agentId }` graph entries.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    agents: z.array(z.object({ id: z.string(), description: z.string().optional() })),
  }),
  execute: async (_input, { mastra }) => {
    if (!mastra) throw new Error('list-available-agents requires a Mastra context.');
    const all = (mastra as any).listAgents?.() ?? {};
    return {
      agents: Object.entries(all)
        .filter(([id]) => id !== 'workflow-builder-agent')
        .map(([id, a]: [string, any]) => ({ id, description: a?.description })),
    };
  },
});

export const listAvailableToolsTool = createTool({
  id: 'list-available-tools',
  description:
    'Returns the tools currently registered on the Mastra instance. The tool ids returned here are the only valid values you can put in `{ type: "tool", toolId }` graph entries.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    tools: z.array(z.object({ id: z.string(), description: z.string().optional() })),
  }),
  execute: async (_input, { mastra }) => {
    if (!mastra) throw new Error('list-available-tools requires a Mastra context.');
    const all = (mastra as any).listTools?.() ?? {};
    return {
      tools: Object.entries(all)
        // Workflow-builder helper tools are noise to the agent — strip them.
        .filter(([id]) => !['list-available-agents', 'list-available-tools', 'save-workflow'].includes(id))
        .map(([id, t]: [string, any]) => ({ id, description: t?.description })),
    };
  },
});

/**
 * The save-workflow tool body matches `mastra.addStoredWorkflow()` exactly,
 * which is the same shape `POST /stored/workflows` accepts. So Studio's
 * eventual "Save" button hits the identical wire shape this tool emits.
 */
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
    await (mastra as any).addStoredWorkflow(def);
    return { ok: true as const, id: def.id };
  },
});
