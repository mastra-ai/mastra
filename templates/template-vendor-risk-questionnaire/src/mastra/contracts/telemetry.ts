import { z } from 'zod';
import { id } from './primitives.ts';

export const domainEventSchema = z
  .object({
    kind: z.enum(['processing_started', 'processing_finished', 'first_route', 'reviewed', 'exported']),
    at: z.iso.datetime(),
    startedAt: z.iso.datetime().optional(),
    questionId: id.optional(),
    domain: id.optional(),
    route: z.enum(['auto_draft', 'escalated']).optional(),
    corrected: z.boolean().optional(),
    materialClaims: z.int().nonnegative().optional(),
    supportedClaims: z.int().nonnegative().optional(),
  })
  .strict()
  .refine(v => (v.supportedClaims ?? 0) <= (v.materialClaims ?? 0), 'Support cannot exceed claims.');
export type DomainEvent = z.infer<typeof domainEventSchema>;
