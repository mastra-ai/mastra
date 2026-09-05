import { z } from 'zod';

export const mastraSpanTypeSchema = z.enum([
  'agent_run',
  'scorer_run',
  'scorer_step',
  'generic',
  'model_generation',
  'model_step',
  'model_inference',
  'model_chunk',
  'mcp_tool_call',
  'processor_run',
  'tool_call',
  'client_tool_call',
  'provider_tool_call',
  'workflow_run',
  'workflow_step',
  'workflow_conditional',
  'workflow_conditional_eval',
  'workflow_parallel',
  'workflow_loop',
  'workflow_sleep',
  'workflow_wait_event',
  'memory_operation',
  'workspace_action',
  'rag_ingestion',
  'rag_embedding',
  'rag_vector_operation',
  'rag_action',
  'graph_action',
  'mapping',
  'skill_resolution',
]);

const isoTimestamp = z.string().datetime({ offset: true });
const hexTraceId = z.string().regex(/^[0-9a-f]{32}$/, 'must be a lowercase 32-character hexadecimal trace ID');
const hexSpanId = z.string().regex(/^[0-9a-f]{16}$/, 'must be a lowercase 16-character hexadecimal span ID');

/** The public wire shape accepted by the existing MOBS collector. */
export const collectorSpanSchema = z
  .object({
    traceId: hexTraceId,
    spanId: hexSpanId,
    parentSpanId: hexSpanId.nullable(),
    name: z.string().trim().min(1),
    spanType: mastraSpanTypeSchema,
    attributes: z.record(z.string(), z.unknown()).optional(),
    metadata: z.record(z.string(), z.unknown()),
    tags: z.array(z.string()).optional(),
    input: z.unknown().optional(),
    output: z.unknown().optional(),
    error: z
      .object({
        message: z.string(),
        name: z.string().optional(),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .nullable()
      .optional(),
    startedAt: isoTimestamp,
    endedAt: isoTimestamp,
    isEvent: z.boolean(),
  })
  .strict();

export const collectorPublishBodySchema = z
  .object({
    spans: z.array(collectorSpanSchema),
  })
  .strict();

export const collectorPublishResponseSchema = z.object({
  ok: z.literal(true),
  data: z.object({ spanCount: z.number().int().nonnegative() }),
  warnings: z
    .array(
      z.object({
        code: z.string(),
        message: z.string(),
        count: z.number().int().nonnegative().optional(),
      }),
    )
    .optional(),
});

export type CollectorSpan = z.infer<typeof collectorSpanSchema>;
export type CollectorPublishResponse = z.infer<typeof collectorPublishResponseSchema>;
