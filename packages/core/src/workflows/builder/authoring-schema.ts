/**
 * Shared model-facing authoring contract for complete persisted workflow
 * definitions. Both authoring surfaces (Mastra Code `save-workflow` and
 * Studio `submit-workflow-draft`) consume these schemas so the guidance a
 * model sees at the final submission boundary is identical everywhere.
 *
 * The model-facing input flavor (`...InputSchema`) reuses the canonical entry
 * schemas directly and differs only where the wider input is genuinely
 * friendlier to authoring models AND survives provider strict-schema
 * compatibility transforms (OpenAI makes every property required and closes
 * arbitrary-key records to empty objects, so optional alias pairs and
 * required `z.record(...)` fields become unfillable contradictions):
 * - `mapConfig` accepts object form as well as the canonical JSON string.
 * - Optional fields accept explicit `null` (strict providers force models to
 *   emit `null` for fields they cannot omit).
 * - Opaque JSON Schema fields are `z.unknown()`, mirroring the persisted
 *   `WorkflowDefinition` contract, so they stay fillable under OpenAI.
 * `normalizeWorkflowBuilderDefinition` canonicalizes the wider input
 * (stringifies object `mapConfig`, drops `null` optionals).
 *
 * Surface-specific lifecycle wording (persist-immediately vs. Ready + explicit
 * user Save) stays out of this module; attach it on the tool description at
 * each surface.
 */
import { z } from 'zod';

import type { Predicate } from '../predicate';
import { validateCron } from '../scheduler/cron';

export const WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION =
  'An object whose top-level keys become the mapping output fields. Each value must use exactly one canonical source form: { "template": "<text with ${placeholders}>" }, { "value": <constant> }, { "step": "<stepId>", "path": "<field.path>" }, { "initData": true, "path": "<workflow-input-field.path>" }, or { "requestContextPath": "<field.path>" }. IMPORTANT: initData is the boolean true, never a field name string; put the workflow input field name in path. Template placeholders use JavaScript-style ${initData.<field>}, ${inputData.<field>}, ${stepResults.<stepId>.<field>}, ${state.<field>}, or ${requestContext.<field>} — never Handlebars {{...}} and never separate sources/data bindings. May also be provided as a JSON-encoded string of the same object.';

const jsonSchema = z.record(z.string(), z.unknown());

const STEP_OPTIONS_DESCRIPTION =
  'JSON-safe subset of step options that round-trips through storage. `onFinish` callbacks and function-valued scorers are NOT supported.';

const stepOptionsSchema = z
  .object({
    retries: z.number().int().nonnegative().optional().describe('Retry count on failure. Static number only.'),
    metadata: jsonSchema.optional().describe('Arbitrary JSON-safe metadata attached to the step.'),
  })
  .optional()
  .describe(STEP_OPTIONS_DESCRIPTION);

// Input-dialect twin: strict-provider compatibility (OpenAI) rewrites optional
// properties as required+nullable, so models on those providers are forced to
// emit null where they would omit the field. The input dialect accepts null at
// exactly those optional slots; normalization strips the nulls before the
// canonical schema validates. `metadata` is additionally `z.unknown()` here
// because OpenAI turns arbitrary-key records into unfillable closed objects.
const stepOptionsInputSchema = z
  .object({
    retries: z.number().int().nonnegative().nullish().describe('Retry count on failure. Static number only.'),
    metadata: z.unknown().nullish().describe('Arbitrary JSON-safe metadata object attached to the step.'),
  })
  .nullish()
  .describe(STEP_OPTIONS_DESCRIPTION);

const agentOutputSchemaDescription =
  "OPTIONAL JSON Schema (Draft 2020-12) describing the structured output the agent must produce for this step. When set, the agent runs with structured output and the step's output IS that shape (not `{ text: string }`). Use this when a downstream step needs a machine-readable field — for example, an agent that reads a listing and emits `{ files: string[] }`, which a subsequent `foreach` iterates over.";

const AGENT_ENTRY_DESCRIPTION =
  'Agent step. Default agents consume { prompt: string } and return { text: string }; insert a mapping step producing { prompt } before the agent when shapes differ, and map its result from the `text` field afterwards — never invent output fields such as `response`. When `outputSchema` is set the output IS that schema shape instead. Use an agent ID returned by resource discovery; never invent IDs.';

export const workflowBuilderAgentEntrySchema = z
  .strictObject({
    type: z.literal('agent'),
    id: z.string().min(1).describe('Step id — kebab-case, unique within the workflow.'),
    agentId: z.string().min(1).describe('Id of an agent registered on this Mastra instance (from resource discovery).'),
    description: z.string().optional(),
    outputSchema: z.unknown().optional().describe(agentOutputSchemaDescription),
    options: stepOptionsSchema,
  })
  .describe(AGENT_ENTRY_DESCRIPTION);

export const workflowBuilderAgentEntryInputSchema = workflowBuilderAgentEntrySchema
  .extend({
    description: z.string().nullish(),
    outputSchema: z.unknown().nullish().describe(agentOutputSchemaDescription),
    options: stepOptionsInputSchema,
  })
  .describe(AGENT_ENTRY_DESCRIPTION);

const TOOL_ENTRY_DESCRIPTION =
  "Tool step. The previous step's output is validated against the tool's inputSchema and the step produces the tool's outputSchema shape exactly.";

export const workflowBuilderToolEntrySchema = z
  .strictObject({
    type: z.literal('tool'),
    id: z.string().min(1).describe('Step id — kebab-case, unique within the workflow.'),
    toolId: z.string().min(1).describe('Id of a tool registered on this Mastra instance (from resource discovery).'),
    description: z.string().optional(),
    options: stepOptionsSchema,
  })
  .describe(TOOL_ENTRY_DESCRIPTION);

export const workflowBuilderToolEntryInputSchema = workflowBuilderToolEntrySchema
  .extend({
    description: z.string().nullish(),
    options: stepOptionsInputSchema,
  })
  .describe(TOOL_ENTRY_DESCRIPTION);

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
  .strictObject({
    type: z.literal('mapping'),
    id: z.string().min(1).describe('Step id — kebab-case, unique within the workflow.'),
    mapConfig: z.string().min(1).describe(`A JSON-ENCODED STRING of ${WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION}`),
  })
  .describe('Mapping step. Its output is an object whose top-level keys are exactly the keys of mapConfig.');

export const workflowBuilderMappingEntryInputSchema = z
  .strictObject({
    type: z.literal('mapping'),
    id: z.string().min(1).describe('Step id — kebab-case, unique within the workflow.'),
    mapConfig: z
      .union([workflowBuilderMappingConfigSchema, z.string().min(1)])
      .describe(WORKFLOW_BUILDER_MAPPING_CONFIG_DESCRIPTION),
  })
  .describe('Mapping step. Its output is an object whose top-level keys are exactly the keys of mapConfig.');

export const workflowBuilderNestedWorkflowEntrySchema = z
  .strictObject({
    type: z.literal('workflow'),
    id: z
      .string()
      .min(1)
      .describe(
        'Call-site step id — kebab-case, unique within the workflow. This is the id that addresses this step result (stepResults.<id>); it does not need to equal workflowId.',
      ),
    workflowId: z
      .string()
      .min(1)
      .describe(
        'Authoritative ID of another workflow registered on this Mastra instance, exactly as returned by resource discovery. Never invent workflow IDs, self-reference, or create cycles.',
      ),
    description: z.string().optional(),
    options: stepOptionsSchema,
  })
  .describe(
    'Nested workflow step. The referenced workflow runs as a single step: its input is the current step input (a first top-level nested workflow receives the parent input directly when schemas match) and its output becomes this step output. Map its output through stepResults.<id> — this step own id — when a different final shape is required.',
  );

export const workflowBuilderNestedWorkflowEntryInputSchema = workflowBuilderNestedWorkflowEntrySchema
  .extend({
    description: z.string().nullish(),
    options: stepOptionsInputSchema,
  })
  .describe(String(workflowBuilderNestedWorkflowEntrySchema.description));

const executableInnerStepSchema = z.union([
  workflowBuilderAgentEntrySchema,
  workflowBuilderToolEntrySchema,
  workflowBuilderNestedWorkflowEntrySchema,
]);

const executableInnerStepInputSchema = z.union([
  workflowBuilderAgentEntryInputSchema,
  workflowBuilderToolEntryInputSchema,
  workflowBuilderNestedWorkflowEntryInputSchema,
]);

const literalScalarSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const predicatePathSchema = z
  .string()
  .regex(/^(initData|inputData|stepResults|state)(\.[A-Za-z0-9_-]+)*$/, 'Use a canonical predicate path root.')
  .describe(
    'Declarative path: initData.<field> for workflow input, inputData.<field> for the previous step output, stepResults.<stepId>.<field> for another step output, or state.<field>.',
  );
const pathOrLiteralSchema = z.union([
  z.strictObject({ path: predicatePathSchema }),
  z.strictObject({ literal: literalScalarSchema }),
]);
export const workflowBuilderPredicateSchema: z.ZodType<Predicate> = z.lazy(() =>
  z.union([
    z.strictObject({
      op: z.enum(['eq', 'ne', 'lt', 'lte', 'gt', 'gte']),
      left: pathOrLiteralSchema,
      right: pathOrLiteralSchema,
    }),
    z.strictObject({
      op: z.enum(['in', 'notIn']),
      value: pathOrLiteralSchema,
      set: z.array(literalScalarSchema).min(1),
    }),
    z.strictObject({ op: z.enum(['exists', 'notExists']), path: predicatePathSchema }),
    z.strictObject({ op: z.enum(['truthy', 'falsy']), value: pathOrLiteralSchema }),
    z.strictObject({ op: z.enum(['and', 'or']), args: z.array(workflowBuilderPredicateSchema).min(1) }),
    z.strictObject({ op: z.literal('not'), arg: workflowBuilderPredicateSchema }),
  ]),
);

const PARALLEL_DESCRIPTION =
  'Parallel container. Each child receives the same preceding input and children must be agent/tool/nested workflow — no nested containers or mappings. The result is an object keyed by each child step id containing that child complete output; downstream steps pluck fields via stepResults.<childId>.<field>.';
const FOREACH_DESCRIPTION =
  'Foreach container. The preceding output MUST be a raw array (not an object with an array field). Each item is passed directly to the child step — no child inputMapping — and the output is an array of child outputs, order preserved. Give the inner step its own unique id.';
const CONDITIONAL_DESCRIPTION =
  'Conditional container. Predicates align by index with steps and use declarative initData, inputData, stepResults, or state paths; every branch whose predicate is truthy runs on the same preceding input. Branch results are keyed by the BRANCH step ids — map from those, never from the container id, which is not a readable step result. To collapse mutually exclusive branches into one field, give the mapping source a step ARRAY: { "step": ["urgent-support", "normal-support"], "path": "text" } selects whichever branch actually ran. Add a final mapping after the conditional whenever the branch result does not already match outputSchema.';
const LOOP_DESCRIPTION =
  '`dowhile` keeps looping while the predicate is TRUE; `dountil` keeps looping until the predicate is TRUE (exit condition). The inner step runs at least once and receives its own previous output on later iterations.';

export const workflowBuilderParallelEntrySchema = z
  .strictObject({ type: z.literal('parallel'), steps: z.array(executableInnerStepSchema).min(1) })
  .describe(PARALLEL_DESCRIPTION);

export const workflowBuilderForeachEntrySchema = z
  .strictObject({
    type: z.literal('foreach'),
    step: executableInnerStepSchema,
    opts: z
      .object({ concurrency: z.number().int().positive() })
      .optional()
      .describe('Optional concurrency control; defaults to 1 (sequential).'),
  })
  .describe(FOREACH_DESCRIPTION);

export const workflowBuilderSleepEntrySchema = z.strictObject({
  type: z.literal('sleep'),
  id: z.string().min(1),
  duration: z.number().nonnegative().describe('Milliseconds to wait. Static number only.'),
});
export const workflowBuilderSleepUntilEntrySchema = z.strictObject({
  type: z.literal('sleepUntil'),
  id: z.string().min(1),
  date: z.string().min(1).describe('ISO 8601 wall-clock date to wait until. Static string only.'),
});

export const workflowBuilderConditionalEntrySchema = z
  .strictObject({
    type: z.literal('conditional'),
    steps: z.array(executableInnerStepSchema).min(1),
    predicates: z
      .array(workflowBuilderPredicateSchema)
      .min(1)
      .describe('One declarative predicate per branch, aligned by array index with steps. No JS closures.'),
  })
  .describe(CONDITIONAL_DESCRIPTION);

export const workflowBuilderLoopEntrySchema = z
  .strictObject({
    type: z.literal('loop'),
    step: executableInnerStepSchema,
    loopType: z.enum(['dowhile', 'dountil']),
    predicate: workflowBuilderPredicateSchema.describe('Declarative predicate — no JS closures.'),
  })
  .describe(LOOP_DESCRIPTION);

// Container input twins: children use the null-tolerant executable input steps,
// and foreach's optional opts accept null from strict providers.
export const workflowBuilderParallelEntryInputSchema = z
  .strictObject({ type: z.literal('parallel'), steps: z.array(executableInnerStepInputSchema).min(1) })
  .describe(PARALLEL_DESCRIPTION);

export const workflowBuilderForeachEntryInputSchema = z
  .strictObject({
    type: z.literal('foreach'),
    step: executableInnerStepInputSchema,
    opts: z
      .object({ concurrency: z.number().int().positive().nullish() })
      .nullish()
      .describe('Optional concurrency control; defaults to 1 (sequential).'),
  })
  .describe(FOREACH_DESCRIPTION);

export const workflowBuilderConditionalEntryInputSchema = z
  .strictObject({
    type: z.literal('conditional'),
    steps: z.array(executableInnerStepInputSchema).min(1),
    predicates: z
      .array(workflowBuilderPredicateSchema)
      .min(1)
      .describe('One declarative predicate per branch, aligned by array index with steps. No JS closures.'),
  })
  .describe(CONDITIONAL_DESCRIPTION);

export const workflowBuilderLoopEntryInputSchema = z
  .strictObject({
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

export const workflowBuilderGraphEntryInputSchema = z.discriminatedUnion('type', [
  workflowBuilderAgentEntryInputSchema,
  workflowBuilderToolEntryInputSchema,
  workflowBuilderMappingEntryInputSchema,
  workflowBuilderNestedWorkflowEntryInputSchema,
  workflowBuilderParallelEntryInputSchema,
  workflowBuilderForeachEntryInputSchema,
  workflowBuilderSleepEntrySchema,
  workflowBuilderSleepUntilEntrySchema,
  workflowBuilderConditionalEntryInputSchema,
  workflowBuilderLoopEntryInputSchema,
]);

const GRAPH_DESCRIPTION =
  'The complete ordered top-level graph covering all ten persisted graph families: agent, tool, mapping, nested workflow, parallel, foreach, sleep, sleepUntil, conditional, and loop. Every adjacent pair must compose: the previous output shape must satisfy the next input schema — insert a mapping step whenever shapes differ. The workflow result is exactly the final top-level entry output, so add an explicit final mapping whenever that output does not match outputSchema.';

const SCHEDULE_DESCRIPTION =
  'Optional declarative cron schedule(s) for the workflow. A single config or an array (array entries must each provide a unique stable id). Persisted with the definition and re-registered on every boot.';

type JsonValue = null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

const workflowBuilderJsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.null(),
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.array(workflowBuilderJsonValueSchema),
    z.record(z.string(), workflowBuilderJsonValueSchema),
  ]),
);

export const workflowBuilderScheduleConfigSchema = z
  .strictObject({
    id: z.string().min(1).optional().describe('Stable schedule id, scoped to the workflow. Required in array form.'),
    cron: z.string().min(1).describe('Cron expression (5-, 6-, or 7-part).'),
    timezone: z.string().min(1).optional().describe('Optional IANA timezone.'),
    inputData: workflowBuilderJsonValueSchema.optional().describe('Static input data for each scheduled run.'),
    initialState: workflowBuilderJsonValueSchema.optional().describe('Static initial state for each scheduled run.'),
    requestContext: z
      .record(z.string(), workflowBuilderJsonValueSchema)
      .optional()
      .describe('Request context for each scheduled run.'),
    metadata: z
      .record(z.string(), workflowBuilderJsonValueSchema)
      .optional()
      .describe('Metadata persisted on the schedule row.'),
  })
  .superRefine(({ cron, timezone }, ctx) => {
    try {
      validateCron(cron, timezone);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: message.startsWith('Invalid timezone') ? ['timezone'] : ['cron'],
      });
    }
  });

export const workflowBuilderScheduleSchema = z
  .union([workflowBuilderScheduleConfigSchema, z.array(workflowBuilderScheduleConfigSchema)])
  .describe(SCHEDULE_DESCRIPTION);

export const workflowBuilderDefinitionSchema = z.strictObject({
  id: z.string().min(1).describe('Workflow id — kebab-case. Preserve the exact requested workflow ID.'),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  inputSchema: z.unknown().describe('Complete JSON Schema (Draft 2020-12) for the workflow input.'),
  outputSchema: z.unknown().describe('Complete JSON Schema (Draft 2020-12) for the workflow output.'),
  stateSchema: z.unknown().optional().describe('Optional JSON Schema for persisted workflow state.'),
  requestContextSchema: z.unknown().optional().describe('Optional JSON Schema for request context values.'),
  graph: z.array(workflowBuilderGraphEntrySchema).min(1).describe(GRAPH_DESCRIPTION),
  schedule: workflowBuilderScheduleSchema.optional(),
});

export const workflowBuilderDefinitionInputSchema = z
  .strictObject({
    id: z
      .string()
      .min(1)
      .describe('Workflow id — kebab-case. Preserve the exact requested workflow ID unless the user renames it.'),
    description: z.string().nullish(),
    metadata: z.record(z.string(), z.unknown()).nullish(),
    inputSchema: z.unknown().describe('Complete JSON Schema (Draft 2020-12) for the workflow input.'),
    outputSchema: z.unknown().describe('Complete JSON Schema (Draft 2020-12) for the workflow output.'),
    stateSchema: z.unknown().nullish().describe('Optional JSON Schema for persisted workflow state.'),
    requestContextSchema: z.unknown().nullish().describe('Optional JSON Schema for request context values.'),
    graph: z.array(workflowBuilderGraphEntryInputSchema).min(1).describe(GRAPH_DESCRIPTION),
    schedule: workflowBuilderScheduleSchema.nullish(),
  })
  .describe(
    'One complete canonical WorkflowDefinition. Submit exactly one complete candidate per attempt — never parallel alternatives. After diagnostics, correct and resubmit the whole definition.',
  );

/** Public HTTP/SDK contract for a persisted workflow definition row. */
export const storedWorkflowDefinitionSchema = workflowBuilderDefinitionSchema.extend({
  status: z.enum(['active', 'archived']),
  source: z.literal('storage'),
  authorId: z.string().optional(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

export const listStoredWorkflowsResponseSchema = z.object({
  workflows: z.array(storedWorkflowDefinitionSchema),
  total: z.number(),
});

export const upsertStoredWorkflowResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
});

export const deleteStoredWorkflowResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});

export type WorkflowBuilderDefinitionInput = z.input<typeof workflowBuilderDefinitionInputSchema>;
export type StoredWorkflowDefinition = z.infer<typeof storedWorkflowDefinitionSchema>;
export type ListStoredWorkflowsResponse = z.infer<typeof listStoredWorkflowsResponseSchema>;
export type UpsertStoredWorkflowResponse = z.infer<typeof upsertStoredWorkflowResponseSchema>;
export type DeleteStoredWorkflowResponse = z.infer<typeof deleteStoredWorkflowResponseSchema>;
