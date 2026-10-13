import { z } from 'zod';
import { id } from './primitives.ts';

const eventFields = z
  .object({
    at: z.iso.datetime(),
    startedAt: z.iso.datetime().optional(),
    questionId: id.optional(),
    domain: id.optional(),
    route: z.enum(['auto_draft', 'escalated']).optional(),
    corrected: z.boolean().optional(),
    materialClaims: z.int().nonnegative().optional(),
    supportedClaims: z.int().nonnegative().optional(),
  })
  .strict();
export const domainEventSchema = z
  .discriminatedUnion('kind', [
    eventFields.extend({ kind: z.literal('processing_started') }),
    eventFields.extend({ kind: z.literal('processing_finished') }),
    eventFields.extend({ kind: z.literal('exported') }),
    eventFields.extend({ kind: z.literal('reviewed'), questionId: id }),
    eventFields.extend({ kind: z.literal('first_route'), questionId: id, route: z.enum(['auto_draft', 'escalated']) }),
  ])
  .refine(v => (v.supportedClaims ?? 0) <= (v.materialClaims ?? 0), 'Support cannot exceed claims.');
export type DomainEvent = z.infer<typeof domainEventSchema>;
