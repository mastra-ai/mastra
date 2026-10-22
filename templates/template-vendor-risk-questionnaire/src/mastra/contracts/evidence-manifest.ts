import { z } from 'zod';
import { id, hash } from './primitives.ts';

export const evidenceDocumentSchema = z
  .object({
    id,
    relativePath: z
      .string()
      .min(1)
      .max(500)
      .refine(v => !v.startsWith('/') && !v.includes('\\') && !v.split('/').some(s => !s || s === '.' || s === '..')),
    format: z.enum(['xlsx', 'pdf', 'csv', 'json', 'markdown']),
    version: z.string().min(1).max(80),
    sha256: hash,
    title: z.string().min(1).max(300),
    citationLabel: z
      .string()
      .min(1)
      .max(300)
      .refine(v => !/[\r\n\u0000]/.test(v)),
    scope: z
      .object({
        organizationId: id,
        products: z.array(id).min(1).max(100),
        environments: z.array(id).min(1).max(100),
        domains: z.array(id).min(1).max(100),
      })
      .strict(),
    kind: z.enum(['policy', 'operational_record', 'attestation']),
    approvalState: z.enum(['approved', 'draft', 'rejected']),
    approvedBy: id.optional(),
    approvedAt: z.iso.datetime().optional(),
    validFrom: z.iso.datetime(),
    validUntil: z.iso.datetime(),
    llmAllowed: z.boolean(),
    disclosure: z.enum(['shareable', 'review_required', 'restricted']),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.validUntil <= v.validFrom) c.addIssue({ code: 'custom', message: 'Invalid validity interval.' });
    if (v.approvalState === 'approved' && (!v.approvedBy || !v.approvedAt))
      c.addIssue({ code: 'custom', message: 'Approval requires trusted operator metadata.' });
  });
export const manifestSchema = z
  .object({ schemaVersion: z.literal(1), organizationId: id, documents: z.array(evidenceDocumentSchema).max(50) })
  .strict()
  .superRefine((v, c) => {
    if (
      new Set(v.documents.map(d => d.id)).size !== v.documents.length ||
      new Set(v.documents.map(d => d.relativePath)).size !== v.documents.length
    )
      c.addIssue({ code: 'custom', message: 'Duplicate evidence IDs or paths.' });
    for (const d of v.documents)
      if (d.scope.organizationId !== v.organizationId)
        c.addIssue({ code: 'custom', message: 'Manifest organization mismatch.' });
  });
export type EvidenceDocument = z.infer<typeof evidenceDocumentSchema>;
export type EvidenceManifest = z.infer<typeof manifestSchema>;
