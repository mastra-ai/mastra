import { z } from 'zod';

/**
 * Schema for spans received from CloudExporter.
 * This matches the MastraCloudSpanRecord format from @mastra/observability.
 */
export const cloudSpanRecordSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().nullable(),
  name: z.string(),
  spanType: z.string(),
  attributes: z.record(z.unknown()).nullable(),
  metadata: z.record(z.unknown()).nullable(),
  startedAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable(),
  input: z.unknown().nullable(),
  output: z.unknown().nullable(),
  error: z.unknown().nullable(),
  isEvent: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date().nullable(),
});

export type CloudSpanRecord = z.infer<typeof cloudSpanRecordSchema>;

/**
 * Request body schema for POST /spans/publish.
 */
export const publishSpansBodySchema = z.object({
  spans: z.array(cloudSpanRecordSchema),
});

export type PublishSpansBody = z.infer<typeof publishSpansBodySchema>;

/**
 * Response schema for POST /spans/publish.
 */
export const publishSpansResponseSchema = z.object({
  success: z.boolean(),
  received: z.number(),
  message: z.string().optional(),
});

export type PublishSpansResponse = z.infer<typeof publishSpansResponseSchema>;
