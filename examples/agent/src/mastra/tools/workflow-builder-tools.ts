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

/**
 * Extract a JSON Schema from a Mastra tool's schema field. Tools created via
 * `createTool({...})` wrap their Zod schemas with `toStandardSchema`, exposing
 * `['~standard'].jsonSchema` as a `{ input(opts), output(opts) }` converter
 * (see packages/schema-compat/src/standard-schema/adapters/zod-v3.ts:110-119).
 * `direction` selects which side — pass 'input' for inputSchema, 'output' for
 * outputSchema. Returns undefined if the schema is missing or not
 * standard-schema-compliant — the workflow-builder agent then knows the tool's
 * shape is opaque and must reshape via mapping.
 */
function extractJsonSchema(maybeSchema: unknown, direction: 'input' | 'output'): unknown | undefined {
  try {
    const s = maybeSchema as
      | {
          ['~standard']?: {
            jsonSchema?: { input?: (opts: unknown) => unknown; output?: (opts: unknown) => unknown };
          };
        }
      | undefined;
    const converter = s?.['~standard']?.jsonSchema;
    return converter?.[direction]?.({ target: 'draft-2020-12' });
  } catch {
    return undefined;
  }
}

export const listAvailableAgentsTool = createTool({
  id: 'list-available-agents',
  description:
    'Returns the agents currently registered on the Mastra instance. The agent ids returned here are the only valid values you can put in `{ type: "agent", agentId }` graph entries. Each row includes `outputShape` so you know what fields the agent step will produce — read it instead of guessing.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    agents: z.array(
      z.object({
        id: z.string(),
        description: z.string().optional(),
        // Literal string in v1 because the rehydrator drops agent-step options
        // today (see packages/core/src/workflows/load-from-storage.ts:198-202).
        // Phase 2: when structuredOutput round-trips, this becomes a JSON Schema.
        outputShape: z.string(),
      }),
    ),
  }),
  execute: async (_input, { mastra }) => {
    if (!mastra) throw new Error('list-available-agents requires a Mastra context.');
    const all = (mastra as any).listAgents?.() ?? {};
    return {
      agents: Object.entries(all)
        .filter(([id]) => id !== 'workflow-builder-agent')
        .map(([id, a]: [string, any]) => ({
          id,
          description: a?.description,
          outputShape: '{ text: string }',
        })),
    };
  },
});

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
        // JSON Schema objects. Optional because a tool may not declare a schema;
        // in that case its shape is opaque and the agent must reshape via mapping.
        inputSchema: z.any().optional(),
        outputSchema: z.any().optional(),
      }),
    ),
  }),
  execute: async (_input, { mastra }) => {
    if (!mastra) throw new Error('list-available-tools requires a Mastra context.');
    const all = (mastra as any).listTools?.() ?? {};
    return {
      tools: Object.entries(all)
        // Workflow-builder helper tools are noise to the agent — strip them.
        .filter(([id]) => !['list-available-agents', 'list-available-tools', 'save-workflow'].includes(id))
        .map(([id, t]: [string, any]) => ({
          id,
          description: t?.description,
          inputSchema: extractJsonSchema(t?.inputSchema, 'input'),
          outputSchema: extractJsonSchema(t?.outputSchema, 'output'),
        })),
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
