import { z } from 'zod/v4';

// ============================================================================
// Serialized graph — discriminated union mirroring core's SerializedStepFlowEntry.
// Duplicated locally rather than imported from @mastra/core/workflows because
// this file's peer-dependency floor predates that export. Structurally
// compatible with `Mastra.addStoredWorkflow`'s input; the handler casts to
// bridge the Zod-inferred optional-vs-required drift on `foreach.opts`.
// ============================================================================

const stepOptionsSchema = z
  .object({
    retries: z.number().int().nonnegative().optional(),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .optional();

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
  outputSchema: z.unknown().optional(),
  options: stepOptionsSchema,
});

const toolEntrySchema = z.object({
  type: z.literal('tool'),
  id: z.string(),
  toolId: z.string(),
  options: stepOptionsSchema,
});

const mappingEntrySchema = z.object({
  type: z.literal('mapping'),
  id: z.string(),
  mapConfig: z.string(),
});

const workflowEntrySchema = z.object({
  type: z.literal('workflow'),
  id: z.string(),
  workflowId: z.string(),
  options: stepOptionsSchema,
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
    steps: z.array(singleStepEntrySchema),
  }),
  z.object({
    type: z.literal('foreach'),
    step: foreachInnerStepSchema,
    opts: z.object({ concurrency: z.number().int().positive() }).optional(),
  }),
  z.object({
    type: z.literal('sleep'),
    id: z.string(),
    duration: z.number(),
  }),
  z.object({
    type: z.literal('sleepUntil'),
    id: z.string(),
    date: z.string(),
  }),
  z.object({
    // Declarative-only conditional. Inbound stored workflows must ship a
    // `predicates` array aligned with `steps`; closure-based branches are not
    // accepted over the wire (they'd be arbitrary JS strings we can't
    // safely rehydrate).
    type: z.literal('conditional'),
    steps: z.array(singleStepEntrySchema),
    predicates: z.array(predicateSchema),
  }),
  z.object({
    // Declarative-only loop. Same rationale as `conditional`.
    type: z.literal('loop'),
    step: singleStepEntrySchema,
    loopType: z.enum(['dowhile', 'dountil']),
    predicate: predicateSchema,
  }),
]);

// ============================================================================
// Path params
// ============================================================================

export const storedWorkflowIdPathParams = z.object({
  storedWorkflowId: z.string().describe('Unique identifier for the stored workflow definition'),
});

// ============================================================================
// Query params
// ============================================================================

export const listStoredWorkflowsQuerySchema = z.object({
  status: z
    .enum(['active', 'archived'])
    .optional()
    .describe('Filter stored workflows by status (defaults to active when omitted by the handler)'),
  authorId: z.string().optional().describe('Filter stored workflows by author identifier'),
});

// ============================================================================
// Body schemas
// ============================================================================

/**
 * Body for `POST /stored/workflows` — upsert a static workflow definition.
 * Matches the input shape of `mastra.addStoredWorkflow()`.
 */
export const upsertStoredWorkflowBodySchema = z.object({
  id: z.string().describe('Workflow id — kebab-case, descriptive'),
  description: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Schemas + graph are loose by design: the agent constructs them and this
  // is the same shape `mastra.addStoredWorkflow` expects.
  inputSchema: z.unknown().describe('JSON Schema (Draft 2020-12) for the workflow input'),
  outputSchema: z.unknown().describe('JSON Schema (Draft 2020-12) for the workflow output'),
  stateSchema: z.unknown().optional(),
  requestContextSchema: z.unknown().optional(),
  graph: z
    .array(graphEntrySchema)
    .describe('Static workflow graph — ordered array of serialized step entries with all refs as ids.'),
});

// ============================================================================
// Response schemas
// ============================================================================

/**
 * Shape returned for any single stored workflow row.
 */
export const storedWorkflowResponseSchema = z.object({
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

export const listStoredWorkflowsResponseSchema = z.object({
  workflows: z.array(storedWorkflowResponseSchema),
  total: z.number(),
});

export const getStoredWorkflowResponseSchema = storedWorkflowResponseSchema;

export const upsertStoredWorkflowResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string(),
});

export const deleteStoredWorkflowResponseSchema = z.object({
  success: z.literal(true),
  message: z.string(),
});
