import { z } from 'zod/v4';

// ============================================================================
// Serialized graph — discriminated union mirroring core's SerializedStepFlowEntry.
// Duplicated locally rather than imported from @mastra/core/workflows because
// this file's peer-dependency floor predates that export. Structurally
// compatible with `Mastra.addDynamicWorkflow`'s input; the handler casts once
// to bridge the remaining wire-vs-runtime divergences (sleepUntil.date as
// ISO string, fluent-builder-only debug labels) that the core rehydrator
// handles at runtime.
// ============================================================================

const stepOptionsSchema = z
  .object({
    retries: z.number().int().nonnegative().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

// Optional identity/display fields on control-flow entries (mirrors core's
// `StepFlowEntryOptions`). Declared explicitly because zod's default object
// mode strips unknown keys — without these, posted fields would vanish
// silently before reaching core.
const entryDisplayFields = {
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
};
const containerIdentityFields = {
  id: z.string().optional(),
  ...entryDisplayFields,
};

// ----------------------------------------------------------------------------
// Predicate DSL — declarative condition for `conditional` / `loop` entries.
// Mirrors `Predicate` in `@mastra/core/workflows/predicate`; duplicated
// locally for the same peer-floor reason as the graph schema above.
// ----------------------------------------------------------------------------
const literalScalar = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const pathOrLiteral: z.ZodType = z.union([
  z.object({ path: z.string().min(1) }).strict(),
  z.object({ literal: literalScalar }).strict(),
]);
const predicateSchema: z.ZodType = z.lazy(() =>
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
    z.object({ op: z.enum(['and', 'or']), args: z.array(predicateSchema).min(1) }).strict(),
    z.object({ op: z.literal('not'), arg: predicateSchema }).strict(),
  ]),
);

const agentEntrySchema = z.object({
  type: z.literal('agent'),
  id: z.string(),
  agentId: z.string(),
  description: z.string().optional(),
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  options: stepOptionsSchema,
});

const toolEntrySchema = z.object({
  type: z.literal('tool'),
  id: z.string(),
  toolId: z.string(),
  description: z.string().optional(),
  options: stepOptionsSchema,
});

const mappingEntrySchema = z.object({
  type: z.literal('mapping'),
  id: z.string(),
  ...entryDisplayFields,
  mapConfig: z.string(),
});

const workflowEntrySchema = z.object({
  type: z.literal('workflow'),
  id: z.string(),
  workflowId: z.string(),
  description: z.string().optional(),
});

const singleStepEntrySchema = z.discriminatedUnion('type', [
  agentEntrySchema,
  toolEntrySchema,
  mappingEntrySchema,
  workflowEntrySchema,
]);

const foreachInnerStepSchema = z.discriminatedUnion('type', [agentEntrySchema, toolEntrySchema, workflowEntrySchema]);

const graphEntrySchema = z.discriminatedUnion('type', [
  agentEntrySchema,
  toolEntrySchema,
  mappingEntrySchema,
  workflowEntrySchema,
  z.object({
    type: z.literal('parallel'),
    ...containerIdentityFields,
    steps: z.array(singleStepEntrySchema),
  }),
  z.object({
    type: z.literal('foreach'),
    ...containerIdentityFields,
    step: foreachInnerStepSchema,
    opts: z.object({ concurrency: z.number().int().positive() }).optional(),
  }),
  z.object({
    type: z.literal('sleep'),
    id: z.string(),
    ...entryDisplayFields,
    duration: z.number(),
  }),
  z.object({
    type: z.literal('sleepUntil'),
    id: z.string(),
    ...entryDisplayFields,
    date: z.string(),
  }),
  z
    .object({
      // Declarative-only conditional. Inbound dynamic workflows must ship a
      // `predicates` array aligned with `steps`; closure-based branches are not
      // accepted over the wire (they'd be arbitrary JS strings we can't
      // safely rehydrate).
      type: z.literal('conditional'),
      ...containerIdentityFields,
      steps: z.array(singleStepEntrySchema),
      predicates: z.array(predicateSchema),
    })
    .refine(entry => entry.predicates.length === entry.steps.length, {
      message:
        'conditional entries must have exactly one predicate per branch (`predicates` and `steps` must be the same length)',
      path: ['predicates'],
    }),
  z.object({
    // Declarative-only loop. Same rationale as `conditional`.
    type: z.literal('loop'),
    ...containerIdentityFields,
    step: singleStepEntrySchema,
    loopType: z.enum(['dowhile', 'dountil']),
    predicate: predicateSchema,
  }),
]);

// ============================================================================
// Path params
// ============================================================================

export const dynamicWorkflowIdPathParams = z.object({
  dynamicWorkflowId: z.string().describe('Unique identifier for the dynamic workflow definition'),
});

// ============================================================================
// Query params
// ============================================================================

export const listDynamicWorkflowsQuerySchema = z.object({
  status: z
    .enum(['active', 'archived'])
    .optional()
    .describe('Filter dynamic workflows by status (defaults to active when omitted by the handler)'),
  authorId: z.string().optional().describe('Filter dynamic workflows by author identifier'),
});

// ============================================================================
// Body schemas
// ============================================================================

/**
 * One static workflow definition on the wire. Matches the input shape of
 * `mastra.addDynamicWorkflow()`.
 */
export const dynamicWorkflowDefinitionBodySchema = z.object({
  id: z.string().describe('Workflow id — kebab-case, descriptive'),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Schemas are loose object bags by design: different JSON Schema producers
  // emit slightly different shapes and core's `JsonSchema` type is
  // `Record<string, any>`. Using `z.record` here aligns with that shape so
  // no cast is needed at the handler boundary.
  inputSchema: z.record(z.string(), z.unknown()).describe('JSON Schema (Draft 2020-12) for the workflow input'),
  outputSchema: z.record(z.string(), z.unknown()).describe('JSON Schema (Draft 2020-12) for the workflow output'),
  stateSchema: z.record(z.string(), z.unknown()).optional(),
  requestContextSchema: z.record(z.string(), z.unknown()).optional(),
  graph: z
    .array(graphEntrySchema)
    .describe('Static workflow graph — ordered array of serialized step entries with all refs as ids.'),
});

/**
 * Body for `POST /stored/workflows` — upsert a static workflow definition,
 * optionally together with the helper workflows it nests.
 */
export const upsertDynamicWorkflowBodySchema = dynamicWorkflowDefinitionBodySchema.extend({
  // Deliberately a FLAT list rather than a recursive tree: helpers are peers
  // of each other, hydration order is derived from the graphs, and a
  // self-referential Zod schema would not survive OpenAPI generation.
  dependencies: z
    .array(dynamicWorkflowDefinitionBodySchema)
    .optional()
    .describe(
      'Helper workflow definitions this workflow nests. Saved with it as one unit — the whole set is validated together, ' +
        'hydrated in derived dependency order, and rejected together, so a failed save never leaves orphaned helpers behind. ' +
        'Each helper becomes an ordinary dynamic workflow in its own right.',
    ),
});

// ============================================================================
// Response schemas
// ============================================================================

/**
 * Shape returned for any single dynamic workflow row.
 */
export const dynamicWorkflowResponseSchema = z.object({
  id: z.string(),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  inputSchema: z.unknown(),
  outputSchema: z.unknown(),
  stateSchema: z.unknown().optional(),
  requestContextSchema: z.unknown().optional(),
  graph: z.array(z.unknown()),
  status: z.enum(['active', 'archived']),
  source: z.literal('storage'),
  authorId: z.string().optional(),
  createdAt: z.union([z.date(), z.string()]),
  updatedAt: z.union([z.date(), z.string()]),
});

export const listDynamicWorkflowsResponseSchema = z.object({
  workflows: z.array(dynamicWorkflowResponseSchema),
  total: z.number(),
});

export const getDynamicWorkflowResponseSchema = dynamicWorkflowResponseSchema;

export const upsertDynamicWorkflowResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
  dependencyIds: z
    .array(z.string())
    .optional()
    .describe('Ids of the helper workflows saved alongside this one. Present only when dependencies were supplied.'),
});

export const deleteDynamicWorkflowResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
