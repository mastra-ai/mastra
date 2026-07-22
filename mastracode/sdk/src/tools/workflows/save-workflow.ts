/**
 * Sub-agent tool: persist the static workflow definition and live-register it.
 * Calls `mastra.addStoredWorkflow()` — the same path `POST /api/stored/workflows`
 * takes. After this returns the workflow is immediately runnable.
 */
import type { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Optional step-level knobs that round-trip on both agent and tool entries.
// Keep this shape JSON-safe — no closures, no live handles.
const stepOptions = z
  .object({
    retries: z.number().int().nonnegative().optional().describe('Retry count on failure. Static number only.'),
    metadata: z.record(z.string(), z.any()).optional().describe('Arbitrary JSON-safe metadata attached to the step.'),
  })
  .optional()
  .describe(
    'JSON-safe subset of step options that round-trips through storage. `onFinish` callbacks and function-valued scorers are NOT supported.',
  );

// Single-step-like entries — the shapes that can appear at the top level AND
// nested inside `parallel.steps` / `foreach.step`.
const agentEntry = z.object({
  type: z.literal('agent'),
  id: z.string().describe('Step id — kebab-case, unique within the workflow.'),
  agentId: z.string().describe('Id of an agent registered on this Mastra instance (see list-available-agents).'),
  outputSchema: z
    .any()
    .optional()
    .describe(
      "OPTIONAL JSON Schema (Draft 2020-12) describing the structured output the agent must produce for this step. When set, the agent runs with structured output and the step's output IS that shape (not `{ text: string }`). Use this when a downstream step needs a machine-readable field — for example, an agent that reads a directory listing and emits `{ files: string[] }`, which a subsequent `foreach` iterates over.",
    ),
  options: stepOptions,
});
const toolEntry = z.object({
  type: z.literal('tool'),
  id: z.string().describe('Step id — kebab-case, unique within the workflow.'),
  toolId: z.string().describe('Id of a tool registered on this Mastra instance (see list-available-tools).'),
  options: stepOptions,
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
const workflowEntry = z.object({
  type: z.literal('workflow'),
  id: z.string().describe('Step id — kebab-case, unique within the parent workflow.'),
  workflowId: z
    .string()
    .describe(
      'Id of another workflow registered on this Mastra instance (code-defined or stored). The referenced workflow runs as a single step; its input is the current step input and its output becomes this step output. Cycles are rejected at load time.',
    ),
  options: stepOptions,
});
const singleStepEntry = z.discriminatedUnion('type', [agentEntry, toolEntry, mappingEntry, workflowEntry]);

// ---------------------------------------------------------------------------
// Predicate DSL — declarative condition used by conditional (branch) and loop
// entries. Mirrors `Predicate` in `@mastra/core/workflows/predicate`. Kept in
// sync manually because this file uses zod v3 while core exports zod v4.
// ---------------------------------------------------------------------------
const literalScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const pathOrLiteral: z.ZodType<any> = z.union([
  z.object({ path: z.string().min(1) }).strict(),
  z.object({ literal: literalScalar }).strict(),
]);
const predicate: z.ZodType<any> = z.lazy(() =>
  z.union([
    z
      .object({
        op: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte']),
        left: pathOrLiteral,
        right: pathOrLiteral,
      })
      .strict(),
    z
      .object({
        op: z.enum(['in', 'notIn']),
        value: pathOrLiteral,
        set: z.array(literalScalar).min(1),
      })
      .strict(),
    z.object({ op: z.enum(['exists', 'notExists']), path: z.string().min(1) }).strict(),
    z.object({ op: z.enum(['truthy', 'falsy']), value: pathOrLiteral }).strict(),
    z.object({ op: z.enum(['and', 'or']), args: z.array(predicate).min(1) }).strict(),
    z.object({ op: z.literal('not'), arg: predicate }).strict(),
  ]),
);

// Foreach inner step — same discriminated shape as agent/tool at the top level.
// `mapping` is deliberately excluded: a mapping's output is always an object
// keyed by mapConfig fields, so iterating it per-element is meaningless and the
// rehydrator rejects it.
const foreachInnerStep = z.discriminatedUnion('type', [agentEntry, toolEntry, workflowEntry]);

// Full top-level entry union — includes container step types (parallel, foreach,
// sleep, sleepUntil) in addition to the single-step-like entries above.
const graphEntry = z.discriminatedUnion('type', [
  agentEntry,
  toolEntry,
  mappingEntry,
  workflowEntry,
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
    step: foreachInnerStep.describe(
      "The inner step, run once per element of the previous step's array output. MUST be `agent` or `tool` — mapping steps cannot be foreach inner steps because their output shape isn't per-element executable. Give this inner step its own unique `id` distinct from surrounding steps.",
    ),
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
  z.object({
    type: z.literal('conditional'),
    steps: z
      .array(singleStepEntry)
      .describe(
        'One step per branch. The predicate at the same index decides whether that branch fires. Multiple predicates may match; each matching branch runs.',
      ),
    predicates: z
      .array(predicate)
      .describe(
        'Declarative predicate per branch, aligned by index with `steps`. Each predicate is a small JSON expression (see the `op` shapes) — no JS closures. Reference workflow inputs via `{ path: "initData.<field>" }`, previous step output via `{ path: "inputData.<field>" }`, and other step outputs via `{ path: "stepResults.<stepId>.<field>" }`.',
      ),
  }),
  z.object({
    type: z.literal('loop'),
    step: singleStepEntry.describe('The step executed each iteration.'),
    loopType: z
      .enum(['dowhile', 'dountil'])
      .describe(
        '`dowhile` keeps looping while the predicate is TRUE; `dountil` keeps looping until the predicate is TRUE (exit condition).',
      ),
    predicate: predicate.describe('Declarative predicate — no JS closures. Same path scopes as `conditional`.'),
  }),
]);

export const saveWorkflowTool = createTool({
  id: 'save-workflow',
  description:
    'Persist a static workflow definition and live-register it on the running Mastra instance. Supports all nine step types the engine can rehydrate: agent, tool, mapping, parallel, foreach, sleep, sleepUntil, conditional, loop. Conditional and loop entries require a declarative `predicate` payload — JS closure conditions cannot round-trip through storage. After this returns, the workflow is immediately runnable. Call it exactly once with the complete definition; there is no incremental save API.',
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
    const m = mastra as Mastra;

    // `mastra.addStoredWorkflow` performs registry pre-flight — a mis-classified
    // agentId/toolId or unregistered id throws before rehydration with an
    // actionable message listing every offender. It also rejects JSON Schemas
    // that use keywords the storage-side converter can't rehydrate
    // (oneOf/anyOf/allOf/not/$ref/patternProperties/discriminator).
    await m.addStoredWorkflow(def as Parameters<Mastra['addStoredWorkflow']>[0]);
    return { ok: true as const, id: def.id };
  },
});
