import { z } from 'zod';
import { id, hash } from './primitives.ts';
import { evidenceLocatorSchema } from './evidence-locator.ts';

export const evidenceCitationSchema = z
  .object({
    id,
    documentId: id,
    version: z.string().min(1).max(80),
    sourceSha256: hash,
    locator: evidenceLocatorSchema,
    supportingExcerpt: z.string().min(1).max(4000),
  })
  .strict()
  .refine(v => v.locator.sourceId === v.documentId && v.locator.sourceSha256 === v.sourceSha256);
export type EvidenceCitation = z.infer<typeof evidenceCitationSchema>;
