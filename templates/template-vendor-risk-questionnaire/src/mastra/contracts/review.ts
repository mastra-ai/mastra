import { z } from 'zod';
import { id, hash } from './primitives.ts';
import { questionSchema } from './question.ts';
import { draftSchema, questionResultSchema } from './answer.ts';
import { documentPublicationSchema } from './completion.ts';

export const scopedRunId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,100}$/);
const exportText = z
  .string()
  .refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v), 'Unsupported artifact control character.');
export const dispositionSchema = z
  .object({
    questionId: id,
    disposition: z.enum(['release', 'unknown', 'withheld']),
    correction: draftSchema.optional(),
    safeReason: z.string().min(1).max(500),
    releaseDocumentIds: z.array(id).max(50),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      (v.correction &&
        (v.disposition !== 'release' ||
          v.correction.questionId !== v.questionId ||
          v.correction.value === 'unknown')) ||
      (v.disposition !== 'release' && v.releaseDocumentIds.length) ||
      new Set(v.releaseDocumentIds).size !== v.releaseDocumentIds.length
    )
      c.addIssue({ code: 'custom', message: 'Disposition, correction and release scope must agree.' });
  });
export const reviewDecisionSchema = z
  .object({
    decisionId: id,
    runId: scopedRunId,
    organizationId: id,
    expectedRevision: z.int().nonnegative(),
    expectedDigest: hash,
    policyDigest: hash,
    dispositions: z.array(dispositionSchema).min(1).max(100),
    finalApproval: z.boolean(),
  })
  .strict()
  .refine(
    v => new Set(v.dispositions.map(d => d.questionId)).size === v.dispositions.length,
    'Unique dispositions required.',
  );
export const finalAnswerSchema = z
  .object({
    questionId: id,
    order: z.int().nonnegative(),
    question: exportText.min(1).max(4000),
    disposition: z.enum(['release', 'unknown', 'withheld']),
    value: z.enum(['yes', 'no', 'partial', 'not_applicable', 'free_text', 'unknown', 'withheld']),
    text: exportText.max(4000),
    responseOption: exportText.max(200).nullable(),
    limitations: z.array(exportText.max(500)).max(20),
    safeReason: exportText.min(1).max(500),
    citationIds: z.array(id).max(30),
  })
  .strict()
  .refine(
    v =>
      v.disposition === 'release'
        ? !['unknown', 'withheld'].includes(v.value) && v.text.length > 0 && v.citationIds.length > 0
        : v.value === v.disposition &&
          v.text === '' &&
          v.responseOption === null &&
          v.citationIds.length === 0 &&
          v.limitations.length === 0,
    'Gaps cannot carry factual assertions or citations.',
  );
export const publicEvidenceSchema = z
  .object({
    id,
    documentId: id,
    label: exportText.min(1).max(300),
    version: exportText.min(1).max(80),
    sourceSha256: hash,
    locator: exportText.min(1).max(500),
    supportingExcerpt: exportText.min(1).max(4000),
  })
  .strict();
export const projectionSchema = z
  .object({
    schemaVersion: z.literal(1),
    runId: scopedRunId,
    organizationId: id,
    revision: z.int().nonnegative(),
    approvalId: id,
    evidenceDigest: hash,
    policyDigest: hash,
    quality: z.enum(['complete', 'delivered_with_gaps']),
    total: z.int().positive().max(100),
    supported: z.int().nonnegative().max(100),
    answers: z.array(finalAnswerSchema).min(1).max(100),
    evidence: z.array(publicEvidenceSchema).max(3000),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      v.total !== v.answers.length ||
      v.supported !== v.answers.filter(a => a.disposition === 'release').length ||
      v.quality !== (v.supported === v.total ? 'complete' : 'delivered_with_gaps') ||
      new Set(v.answers.map(a => a.questionId)).size !== v.answers.length ||
      new Set(v.evidence.map(e => e.id)).size !== v.evidence.length ||
      v.answers.some((a, i) => i > 0 && a.order <= v.answers[i - 1]!.order) ||
      v.answers.some(a => a.citationIds.some(id => !v.evidence.some(e => e.id === id)))
    )
      c.addIssue({ code: 'custom', message: 'Projection coverage, ordering and evidence bindings must agree.' });
  });
export const reviewStateSchema = z
  .object({
    runId: scopedRunId,
    workflowRunId: scopedRunId,
    organizationId: id,
    revision: z.int().nonnegative(),
    digest: hash,
    intakeDigest: hash,
    evidenceDigest: hash,
    policyDigest: hash,
    questions: z.array(questionSchema).min(1).max(100),
    results: z.array(questionResultSchema).min(1).max(100),
    state: z.enum(['awaiting_review', 'approved', 'exporting', 'exported', 'invalidated']),
    projection: projectionSchema.nullable(),
    manifest: documentPublicationSchema.nullable(),
    stagedManifest: documentPublicationSchema.nullable(),
    claimToken: id.nullable(),
    claimAt: z.iso.datetime().nullable(),
  })
  .strict()
  .superRefine((v, c) => {
    if (
      (v.claimToken === null) !== (v.claimAt === null) ||
      new Set(v.questions.map(q => q.id)).size !== v.questions.length ||
      v.results.length !== v.questions.length ||
      v.results.some((r, i) => r.questionId !== v.questions[i]?.id || r.order !== v.questions[i]?.order) ||
      (['approved', 'exporting', 'exported'].includes(v.state) && !v.projection) ||
      (v.state === 'invalidated' && v.projection) ||
      (v.state === 'exported' && !v.manifest) ||
      (v.projection &&
        (v.projection.runId !== v.runId ||
          v.projection.organizationId !== v.organizationId ||
          v.projection.revision !== v.revision ||
          v.projection.evidenceDigest !== v.evidenceDigest ||
          v.projection.policyDigest !== v.policyDigest ||
          v.projection.answers.some((a, i) => a.questionId !== v.questions[i]?.id))) ||
      [v.manifest, v.stagedManifest].some(
        m => m && (m.runId !== v.runId || m.revision !== v.revision || m.approvalId !== v.projection?.approvalId),
      )
    )
      c.addIssue({
        code: 'custom',
        message: 'Review state must bind exact questions, results, projection and publication.',
      });
  });
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
export type ReviewState = z.infer<typeof reviewStateSchema>;
export type Projection = z.infer<typeof projectionSchema>;
export type ExportManifest = z.infer<typeof documentPublicationSchema>;
