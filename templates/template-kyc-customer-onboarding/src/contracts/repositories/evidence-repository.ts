import { z } from 'zod';

import { evidenceItemSchema } from '../../domain/evidence.js';
import { caseIdSchema, evidenceIdSchema, idempotencyKeySchema, tenantIdSchema } from '../../domain/identifiers.js';

export const appendEvidenceInputSchema = z
  .object({ evidence: evidenceItemSchema, idempotencyKey: idempotencyKeySchema })
  .strict();
export const getEvidenceInputSchema = z.object({ tenantId: tenantIdSchema, evidenceId: evidenceIdSchema }).strict();
export const listEvidenceInputSchema = z.object({ tenantId: tenantIdSchema, caseId: caseIdSchema }).strict();

export interface EvidenceRepository {
  append(input: z.infer<typeof appendEvidenceInputSchema>): Promise<z.infer<typeof evidenceItemSchema>>;
  get(input: z.infer<typeof getEvidenceInputSchema>): Promise<z.infer<typeof evidenceItemSchema>>;
  list(input: z.infer<typeof listEvidenceInputSchema>): Promise<z.infer<typeof evidenceItemSchema>[]>;
}
