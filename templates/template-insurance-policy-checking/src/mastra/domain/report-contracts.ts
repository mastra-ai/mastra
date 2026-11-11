import { z } from 'zod';
import type { OperationContext } from './case-contracts.js';
import { canonicalJson, hashBytes, identitySchema, outputArtifactSchema, roleSchema } from './case-contracts.js';
import type { Failure } from './operation-errors.js';
import { failureSchema } from './operation-errors.js';
import type { Analysis } from './reconciliation-contracts.js';
import { comparisonSchema } from './reconciliation-contracts.js';
import { completeScope, verifyEvidence } from './reconciliation-engine.js';
import { reviewEventSchema } from './review-contracts.js';
export const analyticalStatusSchema = z.enum(['INCONCLUSIVE', 'REVIEW_REQUIRED', 'NO_DISCREPANCIES_DETECTED']);
const count = z.number().int().nonnegative();
export const reportSnapshotSchema = z
  .object({
    schemaVersion: z.literal('report-1').describe('Version of the persisted contract used to interpret this snapshot.'),
    templateVersion: z
      .literal('policy-check-1')
      .describe('Report template version used to render this immutable snapshot.'),
    id: z.uuid().describe('Stable identifier of this persisted entity.'),
    version: z.number().int().positive().describe('Immutable version of this source or report.'),
    caseId: z.uuid().describe('Identifier of the case selected in this conversation.'),
    analysisId: z.uuid().describe('Identifier of the persisted evidence-backed analysis.'),
    inputHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .describe('SHA-256 checksum binding the analysis to its frozen input.'),
    workflowRunId: z.string().min(1).describe('Native Mastra workflow run bound to this analysis or report.'),
    createdAt: z.iso.datetime().describe('UTC timestamp when this immutable record was created.'),
    identity: identitySchema.describe('Broker-declared policy identity, with unknown fields preserved as null.'),
    intent: z
      .enum(['document_comparison', 'agreed_terms_checking'])
      .describe('Document comparison or checking against explicitly accepted agreed terms.'),
    referenceId: z
      .uuid()
      .describe('Captured source chosen as the comparison reference; selection alone does not establish acceptance.'),
    targetId: z.uuid().describe('Distinct captured source whose terms are being checked.'),
    profile: z
      .object({
        id: z.string().min(1).describe('Stable identifier of this persisted entity.'),
        version: z.string().min(1).describe('Immutable version of this source or report.'),
        name: z.string().min(1).describe('Documented entity name or registered profile name.'),
      })
      .strict()
      .describe('Insurance profile and version frozen for this analysis.'),
    status: analyticalStatusSchema.describe('Analytical or provider status represented by this contract.'),
    reviewStatus: z
      .literal('AWAITING_REVIEW')
      .describe('Persisted broker review state, separate from the analytical conclusion.'),
    revisionNote: z.string().min(1).optional().describe('Broker-requested change recorded with this report revision.'),
    reviewHistory: z
      .array(reviewEventSchema)
      .optional()
      .describe('Prior finding dispositions retained with their original report provenance.'),
    counts: z
      .object({
        checked: count.describe(
          'Findings checked against at least two complete source scopes with sufficient term evidence.',
        ),
        matches: count.describe('Number of findings with matching typed terms.'),
        discrepancies: count.describe('Number of observed discrepancies requiring broker review.'),
        authorized: count.describe('Number of findings explained by verified authorized changes.'),
        unresolved: count.describe('Number of findings with missing evidence or unresolved review questions.'),
      })
      .strict()
      .describe('Summary counts derived from this exact finding set.'),
    comparisons: z.array(comparisonSchema).describe('Evidence-backed findings for the selected reference and target.'),
    limitations: z
      .array(z.string().min(1))
      .describe('Known limits on extraction, review scope or interpretation; an empty array means none recorded.'),
    rules: z
      .array(
        z
          .object({
            profileId: z.string().describe('Registered insurance profile identifier to freeze with the analysis.'),
            version: z.string().describe('Immutable version of this source or report.'),
            ruleId: z.string().describe('Identifier of the configured profile rule.'),
            observation: z.string().describe('Evidence-based statement of the observed result.'),
          })
          .strict(),
      )
      .describe('Profile-rule observations kept separate from contractual evidence.'),
    sources: z
      .array(
        z
          .object({
            sourceId: z.uuid().describe('Immutable captured source identifier; copy it exactly from the source.'),
            version: z.string().min(1).describe('Immutable version of this source or report.'),
            hash: z
              .string()
              .regex(/^[a-f0-9]{64}$/)
              .describe('SHA-256 checksum of the immutable content, encoded as 64 lowercase hexadecimal characters.'),
            displayName: z.string().min(1).describe('Human-readable source or artifact filename.'),
            role: roleSchema.describe('Declared document role; unknown until the broker identifies it.'),
            kind: z.enum(['pdf', 'records']).describe('Discriminator identifying PDF content or structured records.'),
            capturedAt: z.iso.datetime().describe('UTC timestamp when the immutable source was captured.'),
            pageCount: z
              .number()
              .int()
              .positive()
              .nullable()
              .describe('Physical PDF page count; null for structured records.'),
            limitations: z
              .array(z.string())
              .describe(
                'Known limits on extraction, review scope or interpretation; an empty array means none recorded.',
              ),
            complete: z
              .boolean()
              .describe('Whether the stated review scope is complete; limitations still prevent overall assurance.'),
            recordLocators: z
              .array(
                z
                  .object({
                    recordId: z.string().min(1).describe('Captured record identifier; null or absent for a PDF page.'),
                    field: z
                      .string()
                      .min(1)
                      .describe('Captured field name within the identified record; null or absent for a PDF page.'),
                  })
                  .strict(),
              )
              .describe('Captured record/field locators; empty for PDF sources.'),
          })
          .strict(),
      )
      .min(2)
      .describe('Immutable sources captured for this case.'),
  })
  .strict()
  .superRefine((r, c) => {
    if (
      r.reviewHistory?.some(
        e => e.caseId !== r.caseId || !e.disposition || !r.comparisons.some(f => f.id === e.disposition!.findingId),
      )
    )
      c.addIssue({
        code: 'custom',
        message: 'Historical dispositions must identify retained findings and their originating report.',
      });
    const expected = reportCounts(r.comparisons);
    if (canonicalJson(r.counts) !== canonicalJson(expected))
      c.addIssue({ code: 'custom', message: 'Report counts must match the exact finding set.' });
    if (
      r.status !==
      reportStatus(
        r.comparisons,
        r.sources.some(s => !s.complete),
        r.rules.length,
      )
    )
      c.addIssue({
        code: 'custom',
        message: 'Report status must preserve incomplete evidence and outstanding judgments.',
      });
    const sources = new Map(r.sources.map(source => [source.sourceId, source]));
    if (
      sources.size !== r.sources.length ||
      new Set(r.comparisons.map(f => f.id)).size !== r.comparisons.length ||
      !sources.has(r.referenceId) ||
      !sources.has(r.targetId) ||
      r.referenceId === r.targetId
    )
      c.addIssue({ code: 'custom', message: 'Report references must be unique and bound to captured sources.' });
    if (
      r.sources.some(s =>
        s.kind === 'records' ? s.pageCount !== null : s.pageCount === null || s.recordLocators.length > 0,
      )
    )
      c.addIssue({ code: 'custom', message: 'Source pagination must match its evidence kind.' });
    for (const finding of r.comparisons) {
      if (new Set(finding.searched.map(s => s.sourceId)).size !== finding.searched.length)
        c.addIssue({ code: 'custom', message: 'Searched scopes must be unique.' });
      for (const scope of finding.searched) {
        const source = sources.get(scope.sourceId);
        if (
          !source ||
          new Set(scope.pages).size !== scope.pages.length ||
          new Set(scope.records.map(item => JSON.stringify([item.recordId, item.field]))).size !==
            scope.records.length ||
          scope.pages.some(page => source.kind !== 'pdf' || page > (source.pageCount ?? 0)) ||
          scope.records.some(
            item =>
              source.kind !== 'records' ||
              !source.recordLocators.some(saved => saved.recordId === item.recordId && saved.field === item.field),
          ) ||
          (scope.complete &&
            (!source.complete ||
              (source.kind === 'pdf'
                ? scope.pages.length !== source.pageCount
                : scope.records.length !== source.recordLocators.length)))
        )
          c.addIssue({ code: 'custom', message: 'Searched scope must resolve against captured sources.' });
      }
    }
    for (const finding of r.comparisons)
      for (const e of [
        ...finding.evidence,
        ...(finding.baseline?.evidence ?? []),
        ...(finding.actual?.evidence ?? []),
        ...finding.appliedChanges.flatMap(change => change.evidence),
      ]) {
        const s = sources.get(e.sourceId);
        if (
          !s ||
          s.hash !== e.hash ||
          s.version !== e.version ||
          (s.kind === 'pdf'
            ? e.physicalPage === null || e.physicalPage > (s.pageCount ?? 0)
            : e.physicalPage !== null ||
              !s.recordLocators.some(item => item.recordId === e.recordId && item.field === e.field))
        )
          c.addIssue({ code: 'custom', message: 'Report evidence must remain bound to its immutable source.' });
      }
  });
export type ReportSnapshot = z.infer<typeof reportSnapshotSchema>;
/** Count finding outcomes without presenting incomplete searches as fully checked terms. */
export function reportCounts(
  findings: { classification: string; baseline: unknown; actual: unknown; searched: { complete: boolean }[] }[],
) {
  const counts = { checked: 0, matches: 0, discrepancies: 0, authorized: 0, unresolved: 0 };
  for (const finding of findings) {
    if (
      finding.searched.length >= 2 &&
      finding.searched.every(scope => scope.complete) &&
      finding.classification !== 'MISSING_EVIDENCE' &&
      ((finding.baseline && finding.actual) || finding.classification === 'DISCREPANCY')
    )
      counts.checked++;
    switch (finding.classification) {
      case 'MATCH':
        counts.matches++;
        break;
      case 'DISCREPANCY':
        counts.discrepancies++;
        break;
      case 'AUTHORIZED_CHANGE':
        counts.authorized++;
        break;
      case 'MISSING_EVIDENCE':
      case 'REQUIRES_REVIEW':
        counts.unresolved++;
        break;
    }
  }
  return counts;
}
/** Derive the report conclusion while preserving incomplete evidence and unresolved review needs. */
export function reportStatus(findings: { classification: string }[], incomplete: boolean, ruleCount = 0) {
  return !findings.length ||
    incomplete ||
    findings.some(f => ['MISSING_EVIDENCE', 'REQUIRES_REVIEW'].includes(f.classification))
    ? 'INCONCLUSIVE'
    : ruleCount > 0 || findings.some(f => f.classification === 'DISCREPANCY')
      ? 'REVIEW_REQUIRED'
      : 'NO_DISCREPANCIES_DETECTED';
}
/** Verify analysis citations and freeze findings, provenance, and review status into a report version. */
export function buildReport(analysis: Analysis, id: string, version: number, runId: string): ReportSnapshot {
  for (const f of analysis.comparisons)
    for (const e of [
      ...f.evidence,
      ...(f.baseline?.evidence ?? []),
      ...(f.actual?.evidence ?? []),
      ...f.appliedChanges.flatMap(change => change.evidence),
    ])
      verifyEvidence(e, analysis.input.sources);
  const limitations = [
    ...new Set([...analysis.limitations, ...analysis.input.sources.flatMap(source => source.limitations)]),
  ];
  const extractions = new Map(analysis.extractions.map(extraction => [extraction.sourceId, extraction]));
  const sources = analysis.input.sources.map(source => {
    const extraction = extractions.get(source.sourceId);
    return {
      sourceId: source.sourceId,
      version: source.version,
      hash: source.hash,
      displayName: source.displayName,
      role: analysis.input.clarification.roles.find(role => role.sourceId === source.sourceId)?.role ?? source.role,
      kind: source.kind,
      capturedAt: source.provenance.capturedAt,
      pageCount: source.kind === 'pdf' ? source.pages.length : null,
      limitations: source.limitations,
      complete: Boolean(extraction && completeScope(extraction, source)),
      recordLocators:
        source.kind === 'records' ? source.evidence.map(({ recordId, field }) => ({ recordId, field })) : [],
    };
  });
  return reportSnapshotSchema.parse({
    schemaVersion: 'report-1',
    templateVersion: 'policy-check-1',
    id,
    version,
    caseId: analysis.input.caseId,
    analysisId: analysis.id,
    inputHash: analysis.inputHash,
    workflowRunId: runId,
    createdAt: new Date().toISOString(),
    identity: analysis.input.identity,
    intent: analysis.input.clarification.intent,
    referenceId: analysis.input.clarification.referenceId,
    targetId: analysis.input.clarification.targetId,
    profile: {
      id: analysis.input.profile.id,
      version: analysis.input.profile.version,
      name: analysis.input.profile.id === 'generic' ? 'General insurance' : analysis.input.profile.id,
    },
    status: reportStatus(
      analysis.comparisons,
      sources.some(source => !source.complete),
      analysis.rules.length,
    ),
    reviewStatus: 'AWAITING_REVIEW',
    counts: reportCounts(analysis.comparisons),
    comparisons: analysis.comparisons,
    limitations,
    rules: analysis.rules,
    sources,
  });
}
/** Hash the validated report so approval and output requests bind to the same content. */
export const reportHash = (report: ReportSnapshot) => hashBytes(canonicalJson(reportSnapshotSchema.parse(report)));
export const reportRequestSchema = z
  .object({
    caseId: z.uuid().describe('Identifier of the case selected in this conversation.'),
    reportId: z.uuid().optional().describe('Identifier of the exact immutable report version.'),
    retryPublication: z
      .boolean()
      .default(false)
      .describe('Explicitly retry saved publication without another model comparison.'),
  })
  .strict();

export const reviewCheckpointSchema = z
  .object({
    caseId: z.uuid().describe('Identifier of the case selected in this conversation.'),
    reportId: z.uuid().describe('Identifier of the exact immutable report version.'),
    version: z.number().int().positive().describe('Immutable version of this source or report.'),
    workflowRunId: z.string().min(1).describe('Native Mastra workflow run bound to this analysis or report.'),
    snapshotHash: z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .describe('SHA-256 checksum binding this request to the exact report snapshot.'),
    phase: z
      .enum(['AWAITING_REVIEW', 'PUBLICATION_FAILED'])
      .describe('Whether the workflow awaits review or needs draft publication recovery.'),
    artifactId: z
      .uuid()
      .optional()
      .describe('Reserved artifact identifier, present only for a published review checkpoint.'),
    failure: failureSchema.optional().describe('Safe recorded failure; null or absent when no failure is recorded.'),
  })
  .strict()
  .refine(
    v => (v.phase === 'AWAITING_REVIEW' ? Boolean(v.artifactId) : v.artifactId === undefined),
    'Only published review checkpoints may contain an artifact identifier.',
  );

export type Publication = {
  /** Complete immutable report snapshot consumed by the output provider. */
  snapshot: ReportSnapshot;

  /** SHA-256 checksum of the immutable content, encoded as 64 lowercase hexadecimal characters. */
  hash: string;

  /** UUID identifying one idempotent operation; changed input requires a new identifier. */
  operationId: string;

  /** Reserved artifact identifier, present only for a published review checkpoint. */
  artifactId: string;

  /** Stable identifier of the provider that captured or produced this item. */
  providerId: string;

  /** Trusted operator and conversation bound to this publication. */
  context: OperationContext;

  /** Persisted lifecycle state of this entity. */
  state: 'PREPARED' | 'FAILED' | 'PUBLISHED';

  /** Verified output artifact descriptor, or null before publication. */
  artifact: z.infer<typeof outputArtifactSchema> | null;

  /** Safe recorded failure; null or absent when no failure is recorded. */
  failure: Failure | null;
};
