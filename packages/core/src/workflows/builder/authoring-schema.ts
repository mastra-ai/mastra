/**
 * Shared model-facing authoring contract for complete persisted workflow
 * definitions. Both authoring surfaces (Mastra Code `save-workflow` and
 * Studio `submit-workflow-draft`) consume these schemas so the guidance a
 * model sees at the final submission boundary is identical everywhere.
 *
 * Two flavors per shape:
 * - `...InputSchema` — the model-facing schema. Accepts authoring aliases
 *   (`agent` for `agentId`, object-form `mapConfig`/`output`) and carries the
 *   full authoring guidance in descriptions.
 * - the plain schema — the strict canonical form produced by
 *   `normalizeWorkflowBuilderDefinition` (string `mapConfig`, `agentId` only).
 *
 * Surface-specific lifecycle wording (persist-immediately vs. Ready + explicit
 * user Save) stays out of this module; attach it on the tool description at
 * each surface.
 */
import { z } from 'zod';

export const WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION =
  'An object whose top-level keys become the mapping output fields. Each value must use exactly one canonical source form: { "template": "<text with ${placeholders}>" }, { "value": <constant> }, { "step": "<stepId>", "path": "<field.path>" }, { "initData": true, "path": "<workflow-input-field.path>" }, or { "requestContextPath": "<field.path>" }. IMPORTANT: initData is the boolean true, never a field name string; put the workflow input field name in path. Template placeholders use JavaScript-style ${initData.<field>}, ${inputData.<field>}, ${stepResults.<stepId>.<field>}, ${state.<field>}, or ${requestContext.<field>} — never Handlebars {{...}} and never separate sources/data bindings. May also be provided as a JSON-encoded string of the same object.';

const jsonSchema = z.record(z.string(), z.unknown());

const stepOptionsSchema = z
  .object({
    retries: z.number().int().nonnegative().optional().describe('Retry count on failure. Static number only.'),
    metadata: jsonSchema.optional().describe('Arbitrary JSON-safe metadata attached to the step.'),
  })
  .optional()
  .describe(
    'JSON-safe subset of step options that round-trips through storage. `onFinish` callbacks and function-valued scorers are NOT supported.',
  );

const agentOutputSchemaDescription =
  "OPTIONAL JSON Schema (Draft 2020-12) describing the structured output the agent must produce for this step. When set, the agent runs with structured output and the step's output IS that shape (not `{ text: string }`). Use this when a downstream step needs a machine-readable field — for example, an agent that reads a listing and emits `{ files: string[] }`, which a subsequent `foreach` iterates over.";

const AGENT_ENTRY_DESCRIPTION =
  'Agent step. Default agents consume { prompt: string } and return { text: string }; insert a mapping step producing { prompt } before the agent when shapes differ, and map its result from the `text` field afterwards — never invent output fields such as `response`. When `outputSchema` is set the output IS that schema shape instead. Use an agent ID returned by resource discovery; never invent IDs.';

export const workflowBuilderAgentEntrySchema = z
  .object({
    type: z.literal('agent'),
    id: z.string().min(1).describe('Step id — kebab-case, unique within the workflow.'),
    agentId: z.string().min(1).describe('Id of an agent registered on this Mastra instance (from resource discovery).'),
    outputSchema: z.any().optional().describe(agentOutputSchemaDescription),
    options: stepOptionsSchema,
  })
  .describe(AGENT_ENTRY_DESCRIPTION);

export const workflowBuilderAgentEntryInputSchema = z
  .object({
    type: z.literal('agent'),
    id: z.string().min(1).describe('Step id — kebab-case, unique within the workflow.'),
    agentId: z
      .string()
      .min(1)
      .optional()
      .describe('Id of an agent registered on this Mastra instance (from resource discovery).'),
    agent: z.string().min(1).optional().describe('Alias for agentId; prefer agentId.'),
    outputSchema: z.any().optional().describe(agentOutputSchemaDescription),
    options: stepOptionsSchema,
  })
  .describe(AGENT_ENTRY_DESCRIPTION);

export const workflowBuilderToolEntrySchema = z
  .object({
    type: z.literal('tool'),
    id: z.string().min(1).describe('Step id — kebab-case, unique within the workflow.'),
    toolId: z.string().min(1).describe('Id of a tool registered on this Mastra instance (from resource discovery).'),
    options: stepOptionsSchema,
  })
  .describe(
    "Tool step. The previous step's output is validated against the tool's inputSchema and the step produces the tool's outputSchema shape exactly.",
  );

export const workflowBuilderMappingDescriptorSchema = z
  .union([
    z.object({ value: z.unknown() }).strict().describe('Constant source: { "value": <JSON value> }.'),
    z
      .object({
        template: z
          .string()
          .min(1)
          .describe(
            'JavaScript-style interpolation using ${initData.name}, ${inputData.field}, ${stepResults.stepId.field}, ${state.field}, or ${requestContext.field}. Do not use Handlebars {{...}} or separate sources/data bindings.',
          ),
      })
      .strict()
      .describe('Template source: { "template": "Hello, ${initData.name}!" }. The descriptor contains only template.'),
    z.object({ requestContextPath: z.string().min(1) }).strict(),
    z
      .object({ initData: z.literal(true), path: z.string().min(1) })
      .strict()
      .describe('Workflow-input source: { "initData": true, "path": "field.path" }. initData must be true.'),
    z
      .object({ step: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]), path: z.string() })
      .strict()
      .describe('Prior-step source: { "step": "step-id", "path": "field.path" }.'),
  ])
  .describe('Use exactly one source form. Never combine initData and step.');

export const workflowBuilderMappingConfigSchema = z.record(z.string(), workflowBuilderMappingDescriptorSchema);

export const workflowBuilderMappingEntrySchema = z
  .object({
    type: z.literal('mapping'),
    id: z.string().min(1).describe('Step id — kebab-case, unique within the workflow.'),
    mapConfig: z.string().min(1).describe(`A JSON-ENCODED STRING of ${WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION}`),
  })
  .describe('Mapping step. Its output is an object whose top-level keys are exactly the keys of mapConfig.');

export const workflowBuilderMappingEntryInputSchema = z
  .object({
    type: z.literal('mapping'),
    id: z.string().min(1).describe('Step id — kebab-case, unique within the workflow.'),
    mapConfig: z
      .union([workflowBuilderMappingConfigSchema, z.string().min(1)])
      .optional()
      .describe(WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION),
    output: workflowBuilderMappingConfigSchema.optional().describe('Alias for mapConfig; prefer mapConfig.'),
  })
  .refine(step => (step.mapConfig === undefined) !== (step.output === undefined), {
    message: 'Provide exactly one of mapConfig or output.',
  })
  .describe('Mapping step. Its output is an object whose top-level keys are exactly the keys of mapConfig.');

export const workflowBuilderNestedWorkflowEntrySchema = z
  .object({
    type: z.literal('workflow'),
    id: z.string().min(1).describe('Must be the authoritative nested workflow ID; id must exactly equal workflowId.'),
    workflowId: z
      .string()
      .min(1)
      .describe(
        'Authoritative ID of another workflow registered on this Mastra instance, exactly as returned by resource discovery; id must exactly equal workflowId. Never invent workflow IDs, self-reference, or create cycles.',
      ),
    options: stepOptionsSchema,
  })
  .describe(
    'Nested workflow step; id must exactly equal workflowId. The referenced workflow runs as a single step: its input is the current step input (a first top-level nested workflow receives the parent input directly when schemas match) and its output becomes this step output. Map its output through stepResults.<workflowId> when a different final shape is required.',
  );

const executableInnerStepSchema = z.union([
  workflowBuilderAgentEntrySchema,
  workflowBuilderToolEntrySchema,
  workflowBuilderNestedWorkflowEntrySchema,
]);
const executableInnerStepInputSchema = z.union([
  workflowBuilderAgentEntryInputSchema,
  workflowBuilderToolEntrySchema,
  workflowBuilderNestedWorkflowEntrySchema,
]);

const literalScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const predicatePathSchema = z
  .string()
  .regex(/^(initData|inputData|stepResults|state)(\.[A-Za-z0-9_-]+)*$/, 'Use a canonical predicate path root.')
  .describe(
    'Declarative path: initData.<field> for workflow input, inputData.<field> for the previous step output, stepResults.<stepId>.<field> for another step output, or state.<field>.',
  );
const pathOrLiteralSchema = z.union([
  z.object({ path: predicatePathSchema }),
  z.object({ literal: literalScalarSchema }),
]);
export const workflowBuilderPredicateSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      op: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte']),
      left: pathOrLiteralSchema,
      right: pathOrLiteralSchema,
    }),
    z.object({
      op: z.enum(['in', 'notIn']),
      value: pathOrLiteralSchema,
      set: z.array(literalScalarSchema).min(1),
    }),
    z.object({ op: z.enum(['exists', 'notExists']), path: predicatePathSchema }),
    z.object({ op: z.enum(['truthy', 'falsy']), value: pathOrLiteralSchema }),
    z.object({ op: z.enum(['and', 'or']), args: z.array(workflowBuilderPredicateSchema).min(1) }),
    z.object({ op: z.literal('not'), arg: workflowBuilderPredicateSchema }),
  ]),
);

const PARALLEL_DESCRIPTION =
  'Parallel container. Each child receives the same preceding input and children must be agent/tool/nested workflow — no nested containers or mappings. The result is an object keyed by each child step id containing that child complete output; downstream steps pluck fields via stepResults.<childId>.<field>.';
const FOREACH_DESCRIPTION =
  'Foreach container. The preceding output MUST be a raw array (not an object with an array field). Each item is passed directly to the child step — no child inputMapping — and the output is an array of child outputs, order preserved. Give the inner step its own unique id.';
const CONDITIONAL_DESCRIPTION =
  'Conditional container. Predicates align by index with steps and use declarative initData, inputData, stepResults, or state paths; every branch whose predicate is truthy runs on the same preceding input. The result is an object keyed by each branch step id (undefined for branches that did not fire). Add a final mapping after the conditional when the keyed branch result does not match outputSchema.';
const LOOP_DESCRIPTION =
  '`dowhile` keeps looping while the predicate is TRUE; `dountil` keeps looping until the predicate is TRUE (exit condition). The inner step runs at least once and receives its own previous output on later iterations.';

export const workflowBuilderParallelEntrySchema = z
  .object({ type: z.literal('parallel'), steps: z.array(executableInnerStepSchema).min(1) })
  .describe(PARALLEL_DESCRIPTION);
export const workflowBuilderParallelEntryInputSchema = z
  .object({ type: z.literal('parallel'), steps: z.array(executableInnerStepInputSchema).min(1) })
  .describe(PARALLEL_DESCRIPTION);

export const workflowBuilderForeachEntrySchema = z
  .object({
    type: z.literal('foreach'),
    step: executableInnerStepSchema,
    opts: z
      .object({ concurrency: z.number().int().positive() })
      .optional()
      .describe('Optional concurrency control; defaults to 1 (sequential).'),
  })
  .describe(FOREACH_DESCRIPTION);
export const workflowBuilderForeachEntryInputSchema = z
  .object({
    type: z.literal('foreach'),
    step: executableInnerStepInputSchema,
    opts: z
      .object({ concurrency: z.number().int().positive() })
      .optional()
      .describe('Optional concurrency control; defaults to 1 (sequential).'),
  })
  .describe(FOREACH_DESCRIPTION);

export const workflowBuilderSleepEntrySchema = z.object({
  type: z.literal('sleep'),
  id: z.string().min(1),
  duration: z.number().nonnegative().describe('Milliseconds to wait. Static number only.'),
});
export const workflowBuilderSleepUntilEntrySchema = z.object({
  type: z.literal('sleepUntil'),
  id: z.string().min(1),
  date: z.string().min(1).describe('ISO 8601 wall-clock date to wait until. Static string only.'),
});

export const workflowBuilderConditionalEntrySchema = z
  .object({
    type: z.literal('conditional'),
    steps: z.array(executableInnerStepSchema).min(1),
    predicates: z.array(workflowBuilderPredicateSchema).min(1),
  })
  .describe(CONDITIONAL_DESCRIPTION);
export const workflowBuilderConditionalEntryInputSchema = z
  .object({
    type: z.literal('conditional'),
    steps: z.array(executableInnerStepInputSchema).min(1),
    predicates: z
      .array(workflowBuilderPredicateSchema)
      .min(1)
      .describe('One declarative predicate per branch, aligned by array index with steps. No JS closures.'),
  })
  .describe(CONDITIONAL_DESCRIPTION);

export const workflowBuilderLoopEntrySchema = z
  .object({
    type: z.literal('loop'),
    step: executableInnerStepSchema,
    loopType: z.enum(['dowhile', 'dountil']),
    predicate: workflowBuilderPredicateSchema,
  })
  .describe(LOOP_DESCRIPTION);
export const workflowBuilderLoopEntryInputSchema = z
  .object({
    type: z.literal('loop'),
    step: executableInnerStepInputSchema,
    loopType: z.enum(['dowhile', 'dountil']),
    predicate: workflowBuilderPredicateSchema.describe('Declarative predicate — no JS closures.'),
  })
  .describe(LOOP_DESCRIPTION);

export const workflowBuilderGraphEntrySchema = z.discriminatedUnion('type', [
  workflowBuilderAgentEntrySchema,
  workflowBuilderToolEntrySchema,
  workflowBuilderMappingEntrySchema,
  workflowBuilderNestedWorkflowEntrySchema,
  workflowBuilderParallelEntrySchema,
  workflowBuilderForeachEntrySchema,
  workflowBuilderSleepEntrySchema,
  workflowBuilderSleepUntilEntrySchema,
  workflowBuilderConditionalEntrySchema,
  workflowBuilderLoopEntrySchema,
]);

export const workflowBuilderGraphEntryInputSchema = z.union([
  workflowBuilderAgentEntryInputSchema,
  workflowBuilderToolEntrySchema,
  workflowBuilderMappingEntryInputSchema,
  workflowBuilderNestedWorkflowEntrySchema,
  workflowBuilderParallelEntryInputSchema,
  workflowBuilderForeachEntryInputSchema,
  workflowBuilderSleepEntrySchema,
  workflowBuilderSleepUntilEntrySchema,
  workflowBuilderConditionalEntryInputSchema,
  workflowBuilderLoopEntryInputSchema,
]);

const GRAPH_DESCRIPTION =
  'The complete ordered top-level graph covering all ten persisted graph families: agent, tool, mapping, nested workflow, parallel, foreach, sleep, sleepUntil, conditional, and loop. Every adjacent pair must compose: the previous output shape must satisfy the next input schema — insert a mapping step whenever shapes differ. The workflow result is exactly the final top-level entry output, so add an explicit final mapping whenever that output does not match outputSchema.';

export const workflowBuilderDefinitionSchema = z.object({
  id: z.string().min(1).describe('Workflow id — kebab-case. Preserve the exact requested workflow ID.'),
  description: z.string().optional(),
  inputSchema: z.any().describe('Complete JSON Schema (Draft 2020-12) for the workflow input.'),
  outputSchema: z.any().describe('Complete JSON Schema (Draft 2020-12) for the workflow output.'),
  stateSchema: z.any().optional().describe('Optional JSON Schema for persisted workflow state.'),
  requestContextSchema: z.any().optional().describe('Optional JSON Schema for request context values.'),
  graph: z.array(workflowBuilderGraphEntrySchema).min(1).describe(GRAPH_DESCRIPTION),
});

export const workflowBuilderDefinitionInputSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .describe('Workflow id — kebab-case. Preserve the exact requested workflow ID unless the user renames it.'),
    description: z.string().optional(),
    inputSchema: jsonSchema.describe('Complete JSON Schema (Draft 2020-12) for the workflow input.'),
    outputSchema: jsonSchema.describe('Complete JSON Schema (Draft 2020-12) for the workflow output.'),
    stateSchema: jsonSchema.nullish().describe('Optional JSON Schema for persisted workflow state.'),
    requestContextSchema: jsonSchema.nullish().describe('Optional JSON Schema for request context values.'),
    graph: z.array(workflowBuilderGraphEntryInputSchema).min(1).describe(GRAPH_DESCRIPTION),
  })
  .describe(
    'One complete canonical WorkflowDefinition. Submit exactly one complete candidate per attempt — never parallel alternatives. After diagnostics, correct and resubmit the whole definition.',
  );
