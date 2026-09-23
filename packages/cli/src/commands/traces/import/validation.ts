import { SpanType } from '@mastra/core/observability';
import { z } from 'zod';
import type { TraceImportSpanType, TraceImportTrace } from './types.js';

const timestampSchema = z.string().datetime({ offset: true });
const spanTypes = new Set<string>(Object.values(SpanType));
const traceIdSchema = z
  .string()
  .regex(/^(?!0{32}$)[0-9a-f]{32}$/, 'Expected a non-zero lowercase 32-character trace ID.');
const spanIdSchema = z
  .string()
  .regex(/^(?!0{16}$)[0-9a-f]{16}$/, 'Expected a non-zero lowercase 16-character span ID.');

const traceImportSpanSchema = z
  .object({
    traceId: traceIdSchema,
    spanId: spanIdSchema,
    parentSpanId: spanIdSchema.nullable(),
    name: z.string().trim().min(1),
    spanType: z
      .string()
      .refine((value): value is TraceImportSpanType => spanTypes.has(value), 'Unknown Mastra span type'),
    startedAt: timestampSchema,
    endedAt: timestampSchema,
    isEvent: z.boolean(),
    attributes: z.record(z.string(), z.json()).optional(),
    metadata: z.record(z.string(), z.json()),
    tags: z.array(z.string()).optional(),
    input: z.json().optional(),
    output: z.json().optional(),
    error: z
      .object({
        message: z.string(),
        name: z.string().optional(),
        details: z.record(z.string(), z.json()).optional(),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

const traceImportTraceSchema = z
  .object({
    sourceTraceId: z.string().min(1),
    spans: z.array(traceImportSpanSchema).min(1),
  })
  .strict()
  .superRefine(({ spans }, context) => {
    const traceId = spans[0]!.traceId;
    const spanIds = new Set<string>();

    for (const span of spans) {
      if (span.traceId !== traceId) {
        context.addIssue({ code: 'custom', message: 'All spans in a prepared trace must share one trace ID.' });
      }
      if (spanIds.has(span.spanId)) {
        context.addIssue({ code: 'custom', message: `Prepared trace contains duplicate span ID ${span.spanId}.` });
      }
      spanIds.add(span.spanId);
      if (Date.parse(span.endedAt) < Date.parse(span.startedAt)) {
        context.addIssue({ code: 'custom', message: `Span ${span.spanId} ends before it starts.` });
      }
    }

    const roots = spans.filter(span => span.parentSpanId === null);
    if (roots.length !== 1) {
      context.addIssue({ code: 'custom', message: 'A prepared trace must contain exactly one root span.' });
      return;
    }

    const children = new Map<string, string[]>();
    for (const span of spans) {
      if (span.parentSpanId === null) continue;
      if (!spanIds.has(span.parentSpanId)) {
        context.addIssue({
          code: 'custom',
          message: `Parent ${span.parentSpanId} for span ${span.spanId} is missing from the prepared trace.`,
        });
        continue;
      }
      const childIds = children.get(span.parentSpanId) ?? [];
      childIds.push(span.spanId);
      children.set(span.parentSpanId, childIds);
    }

    const visited = new Set<string>();
    const pending = [roots[0]!.spanId];
    while (pending.length > 0) {
      const spanId = pending.pop()!;
      if (visited.has(spanId)) continue;
      visited.add(spanId);
      pending.push(...(children.get(spanId) ?? []));
    }
    if (visited.size !== spans.length) {
      context.addIssue({ code: 'custom', message: 'Prepared trace contains a cycle or disconnected spans.' });
    }
  });

/** Validate the provider-neutral trace before it is written or uploaded. */
export function validateTraceImportTrace(value: unknown): TraceImportTrace {
  return traceImportTraceSchema.parse(value) as TraceImportTrace;
}
