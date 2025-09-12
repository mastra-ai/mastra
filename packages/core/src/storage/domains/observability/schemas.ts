import z from 'zod';
import { AISpanType } from '../../../ai-tracing/types';

export const AISpanCreateSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().nullable().default(null),
  name: z.string(),
  scope: z.record(z.any()).nullable().default(null),
  spanType: z.nativeEnum(AISpanType),
  attributes: z.record(z.any()).nullable().default(null),
  metadata: z.record(z.any()).nullable().default(null),
  links: z.any().nullable().default(null),
  startedAt: z.date(),
  endedAt: z.date().nullable().default(null),
  createdAt: z.date(),
  updatedAt: z.date().nullable().default(null),
  input: z.any().nullable().default(null),
  output: z.any().nullable().default(null),
  error: z.any().nullable().default(null),
  isEvent: z.boolean(),
});

export const AISpanUpdateSchema = AISpanCreateSchema.omit({
  spanId: true,
  traceId: true,
  createdAt: true,
}).partial();
