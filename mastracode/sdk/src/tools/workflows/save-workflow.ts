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

// Single-step-like entries — the shapes that can appear at the top level AND
// nested inside `parallel.steps` / `foreach.step`.
const agentEntry = z.object({
  type: z.literal('agent'),
  id: z.string().describe('Step id — kebab-case, unique within the workflow.'),
  agentId: z.string().describe('Id of an agent registered on this Mastra instance (see list-available-agents).'),
});
const toolEntry = z.object({
  type: z.literal('tool'),
  id: z.string().describe('Step id — kebab-case, unique within the workflow.'),
  toolId: z.string().describe('Id of a tool registered on this Mastra instance (see list-available-tools).'),
});
const mappingEntry = z.object({
  type: z.literal('mapping'),
  id: z.string().describe('Step id — kebab-case, unique within the workflow.'),
  mapConfig: z
    .string()
    .describe(
      'A JSON-ENCODED STRING (not an object) of an object whose top-level keys become the mapping output fields. Each value is one of: { "template": "<text with ${placeholders}>" }, { "value": <constant> }, { "step": "<stepId>", "path": "<field.path>" }, { "initData": "<workflowId>", "path": "<field.path>" }, { "requestContextPath": "<field.path>" }.',
    ),
});
const singleStepEntry = z.discriminatedUnion('type', [agentEntry, toolEntry, mappingEntry]);

// Full top-level entry union — includes container step types (parallel, foreach,
// sleep, sleepUntil) in addition to the single-step-like entries above.
const graphEntry = z.discriminatedUnion('type', [
  agentEntry,
  toolEntry,
  mappingEntry,
  z.object({
    type: z.literal('parallel'),
    steps: z
      .array(singleStepEntry)
      .describe(
        'Children run in parallel on the same input. Each child MUST be agent/tool/mapping — no nested containers.',
      ),
  }),
  z.object({
    type: z.literal('foreach'),
    step: singleStepEntry.describe("The inner step, run once per element of the previous step's array output."),
    opts: z
      .object({ concurrency: z.number().int().positive() })
      .optional()
      .describe('Optional concurrency control; defaults to 1 (sequential).'),
  }),
  z.object({
    type: z.literal('sleep'),
    id: z.string(),
    duration: z.number().describe('Milliseconds to wait. Static number only — function form does not round-trip.'),
  }),
  z.object({
    type: z.literal('sleepUntil'),
    id: z.string(),
    date: z
      .string()
      .describe('ISO 8601 wall-clock date to wait until. Static string only — function form does not round-trip.'),
  }),
]);

export const saveWorkflowTool = createTool({
  id: 'save-workflow',
  description:
    'Persist a static workflow definition and live-register it on the running Mastra instance. Supports all seven step types the engine can rehydrate: agent, tool, mapping, parallel, foreach, sleep, sleepUntil. Conditional and loop entries are the only step types NOT supported (their predicates cannot round-trip in v1). After this returns, the workflow is immediately runnable. Call it exactly once with the complete definition; there is no incremental save API.',
  inputSchema: z.object({
    id: z.string().describe('Workflow id — kebab-case, descriptive.'),
    description: z.string().optional(),
    inputSchema: z.any().describe('JSON Schema (Draft 2020-12) for the workflow input.'),
    outputSchema: z.any().describe('JSON Schema (Draft 2020-12) for the workflow output.'),
    graph: z
      .array(graphEntry)
      .describe(
        'The workflow as an ordered array of step entries. Every one of the seven step types is a first-class option here; the discriminated-union schema lists them explicitly.',
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
