import { z } from 'zod';
import { id, hash } from './primitives.ts';
import { evidenceDocumentSchema } from './evidence-manifest.ts';
import { evidenceExcerptSchema } from './evidence-excerpt.ts';

export const deniedEvidenceSchema = z
  .object({
    documentId: id,
    citationLabel: z.string().min(1).max(300),
    reason: z.enum(['NOT_APPROVED', 'NOT_VALID', 'WRONG_SCOPE', 'LLM_PROHIBITED', 'HASH_MISMATCH']),
  })
  .strict();
export const evidenceScopeSchema = z
  .object({ organizationId: id, product: id, environment: id, domains: z.array(id).min(1).max(100) })
  .strict();
export const evidenceSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,100}$/),
    digest: hash,
    manifestDigest: hash,
    scope: evidenceScopeSchema,
    asOf: z.iso.datetime(),
    documents: z.array(evidenceDocumentSchema).max(50),
    excerpts: z.array(evidenceExcerptSchema).max(100000),
    denied: z.array(deniedEvidenceSchema).max(50),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      new Set(v.documents.map(d => d.id)).size !== v.documents.length ||
      new Set(v.excerpts.map(e => e.id)).size !== v.excerpts.length
    )
      c.addIssue({ code: 'custom', message: 'Snapshot identities must be unique.' });
    for (const e of v.excerpts) {
      const d = v.documents.find(d => d.id === e.documentId);
      if (
        !d ||
        d.version !== e.version ||
        d.sha256 !== e.sourceSha256 ||
        d.citationLabel !== e.citationLabel ||
        d.kind !== e.kind ||
        d.disclosure !== e.disclosure
      )
        c.addIssue({ code: 'custom', message: 'Excerpt does not bind an eligible source.' });
    }
    for (const d of v.documents)
      if (
        d.approvalState !== 'approved' ||
        !d.llmAllowed ||
        d.validFrom > v.asOf ||
        d.validUntil <= v.asOf ||
        !d.approvedAt ||
        d.approvedAt > v.asOf ||
        d.scope.organizationId !== v.scope.organizationId ||
        !d.scope.products.includes(v.scope.product) ||
        !d.scope.environments.includes(v.scope.environment) ||
        !v.scope.domains.some(domain => d.scope.domains.includes(domain))
      )
        c.addIssue({ code: 'custom', message: 'Snapshot contains ineligible source.' });
  });
