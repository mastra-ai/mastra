import { z } from 'zod';
import { id, hash } from './primitives.ts';
import { evidenceLocatorSchema } from './evidence-locator.ts';

export const evidenceExcerptSchema = z
  .object({
    id: z.string().min(1).max(240),
    documentId: id,
    version: z.string().min(1).max(80),
    sourceSha256: hash,
    citationLabel: z.string().min(1).max(300),
    kind: z.enum(['policy', 'operational_record', 'attestation']),
    disclosure: z.enum(['shareable', 'review_required', 'restricted']),
    locator: evidenceLocatorSchema,
    text: z.string().min(1).max(4000),
  })
  .strict()
  .refine(v => v.documentId === v.locator.sourceId && v.sourceSha256 === v.locator.sourceSha256);
