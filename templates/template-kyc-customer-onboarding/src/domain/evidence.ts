import { z } from 'zod';

import { caseIdSchema, evidenceIdSchema, providerIdSchema, tenantIdSchema, timestampSchema } from './identifiers.js';

export const evidenceKindSchema = z.enum([
  'APPLICATION',
  'DOCUMENT_EXTRACTION',
  'IDENTITY_CHECK',
  'ADDRESS_CHECK',
  'SANCTIONS_CHECK',
  'PEP_CHECK',
  'SANCTIONS_CANDIDATE',
  'PEP_CANDIDATE',
  'PROVIDER_UNAVAILABLE',
  'REVIEWER_DECISION',
]);

export const evidenceItemSchema = z
  .object({
    id: evidenceIdSchema,
    tenantId: tenantIdSchema,
    caseId: caseIdSchema,
    kind: evidenceKindSchema,
    sourceId: providerIdSchema,
    sourceVersion: z.string().min(1).max(64),
    reasonCode: z.string().min(1).max(100),
    reasonCodes: z.array(z.string().min(1).max(100)).optional(),
    summary: z.string().min(1).max(500),
    occurredAt: timestampSchema,
    metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
  })
  .strict();

export type EvidenceKind = z.infer<typeof evidenceKindSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
