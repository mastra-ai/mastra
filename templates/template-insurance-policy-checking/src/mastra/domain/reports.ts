import { z } from 'zod';
import { failureSchema } from './errors.js';
import { identitySchema, hashBytes, canonicalJson, roleSchema } from './contracts.js';
import { termSchema, termValueSchema, evidenceSchema, extractionObjectSchema } from './reconciliation-contracts.js';
import { verifyEvidence, completeScope } from './reconciliation.js';
import type { Analysis } from '../storage/reconciliation.js';

export const classificationSchema = z.enum([
  'MATCH',
  'AUTHORIZED_CHANGE',
  'DISCREPANCY',
  'MISSING_EVIDENCE',
  'REQUIRES_REVIEW',
]);
export const analyticalStatusSchema = z.enum(['INCONCLUSIVE', 'REVIEW_REQUIRED', 'NO_DISCREPANCIES_DETECTED']);
export const comparisonSchema = z
  .object({
    id: z.uuid(),
    category: z.string().min(1),
    key: z.string().min(1),
    label: z.string().min(1),
    scope: z.string().min(1),
    baseline: termSchema.nullable(),
    actual: termSchema.nullable(),
    effectiveValue: termValueSchema.nullable(),
    classification: classificationSchema,
    evidence: z.array(evidenceSchema),
    searched: z.array(
      z
        .object({
          sourceId: z.uuid(),
          pages: z.array(z.number().int().positive()),
          records: z.array(z.object({ recordId: z.string(), field: z.string() }).strict()),
          complete: z.boolean(),
        })
        .strict(),
    ),
    observation: z.string().min(1),
    interpretation: z.string(),
    action: z.string(),
    uncertainty: z.array(z.string()),
    severity: z
      .object({ level: z.enum(['High', 'Medium', 'Low']), rationale: z.string().min(1) })
      .strict()
      .nullable(),
    appliedChanges: extractionObjectSchema.shape.changes,
  })
  .strict();
const count = z.number().int().nonnegative();
export const reportSnapshotSchema = z
  .object({
    schemaVersion: z.literal('report-1'),
    templateVersion: z.literal('policy-check-1'),
    id: z.uuid(),
    version: z.number().int().positive(),
    caseId: z.uuid(),
    analysisId: z.uuid(),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    workflowRunId: z.string().min(1),
    createdAt: z.iso.datetime(),
    identity: identitySchema,
    intent: z.enum(['document_comparison', 'agreed_terms_checking']),
    referenceId: z.uuid(),
    targetId: z.uuid(),
    profile: z.object({ id: z.string().min(1), version: z.string().min(1), name: z.string().min(1) }).strict(),
    status: analyticalStatusSchema,
    reviewStatus: z.literal('AWAITING_REVIEW'),
    counts: z
      .object({ checked: count, matches: count, discrepancies: count, authorized: count, unresolved: count })
      .strict(),
    comparisons: z.array(comparisonSchema),
    limitations: z.array(z.string().min(1)),
    rules: z.array(
      z.object({ profileId: z.string(), version: z.string(), ruleId: z.string(), observation: z.string() }).strict(),
    ),
    sources: z
      .array(
        z
          .object({
            sourceId: z.uuid(),
            version: z.string().min(1),
            hash: z.string().regex(/^[a-f0-9]{64}$/),
            displayName: z.string().min(1),
            role: roleSchema,
            kind: z.enum(['pdf', 'records']),
            capturedAt: z.iso.datetime(),
            pageCount: z.number().int().positive().nullable(),
            limitations: z.array(z.string()),
            complete: z.boolean(),
            recordLocators: z.array(z.object({ recordId: z.string().min(1), field: z.string().min(1) }).strict()),
          })
          .strict(),
      )
      .min(2),
  })
  .strict()
  .superRefine((r, c) => {
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
    const ids = new Set(r.sources.map(s => s.sourceId));
    if (
      ids.size !== r.sources.length ||
      new Set(r.comparisons.map(f => f.id)).size !== r.comparisons.length ||
      !ids.has(r.referenceId) ||
      !ids.has(r.targetId) ||
      r.referenceId === r.targetId
    )
      c.addIssue({ code: 'custom', message: 'Report references must be unique and bound to captured sources.' });
    if (
      r.sources.some(s =>
        s.kind === 'records' ? s.pageCount !== null : s.pageCount === null || s.recordLocators.length > 0,
      )
    )
      c.addIssue({ code: 'custom', message: 'Source pagination must match its evidence kind.' });
    if (r.status === 'NO_DISCREPANCIES_DETECTED' && r.sources.some(s => !s.complete))
      c.addIssue({ code: 'custom', message: 'Incomplete sources cannot support a complete analytical status.' });
    for (const finding of r.comparisons) {
      if (new Set(finding.searched.map(s => s.sourceId)).size !== finding.searched.length)
        c.addIssue({ code: 'custom', message: 'Searched scopes must be unique.' });
      for (const scope of finding.searched) {
        const source = r.sources.find(s => s.sourceId === scope.sourceId);
        if (
          !source ||
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
        const s = r.sources.find(s => s.sourceId === e.sourceId);
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
export function reportCounts(
  findings: { classification: string; baseline: unknown; actual: unknown; searched: { complete: boolean }[] }[],
) {
  return {
    checked: findings.filter(
      f =>
        f.searched.length >= 2 &&
        f.searched.every(s => s.complete) &&
        f.classification !== 'MISSING_EVIDENCE' &&
        ((f.baseline && f.actual) || f.classification === 'DISCREPANCY'),
    ).length,
    matches: findings.filter(f => f.classification === 'MATCH').length,
    discrepancies: findings.filter(f => f.classification === 'DISCREPANCY').length,
    authorized: findings.filter(f => f.classification === 'AUTHORIZED_CHANGE').length,
    unresolved: findings.filter(f => ['MISSING_EVIDENCE', 'REQUIRES_REVIEW'].includes(f.classification)).length,
  };
}
export function reportStatus(findings: { classification: string }[], incomplete: boolean, ruleCount = 0) {
  return !findings.length ||
    incomplete ||
    findings.some(f => ['MISSING_EVIDENCE', 'REQUIRES_REVIEW'].includes(f.classification))
    ? 'INCONCLUSIVE'
    : ruleCount > 0 || findings.some(f => f.classification === 'DISCREPANCY')
      ? 'REVIEW_REQUIRED'
      : 'NO_DISCREPANCIES_DETECTED';
}
export function buildReport(analysis: Analysis, id: string, version: number, runId: string): ReportSnapshot {
  for (const f of analysis.comparisons)
    for (const e of [
      ...f.evidence,
      ...(f.baseline?.evidence ?? []),
      ...(f.actual?.evidence ?? []),
      ...f.appliedChanges.flatMap(change => change.evidence),
    ])
      verifyEvidence(e, analysis.input.sources);
  const limitations = [...analysis.limitations, ...analysis.input.sources.flatMap(s => s.limitations)];
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
      analysis.input.sources.some(s => {
        const e = analysis.extractions.find(e => e.sourceId === s.sourceId);
        return !e || !completeScope(e, s);
      }),
      analysis.rules.length,
    ),
    reviewStatus: 'AWAITING_REVIEW',
    counts: reportCounts(analysis.comparisons),
    comparisons: analysis.comparisons,
    limitations,
    rules: analysis.rules,
    sources: analysis.input.sources.map(s => ({
      sourceId: s.sourceId,
      version: s.version,
      hash: s.hash,
      displayName: s.displayName,
      role: analysis.input.clarification.roles.find(r => r.sourceId === s.sourceId)?.role ?? s.role,
      kind: s.kind,
      capturedAt: s.provenance.capturedAt,
      pageCount: s.kind === 'pdf' ? s.pages.length : null,
      limitations: s.limitations,
      complete: (() => {
        const e = analysis.extractions.find(e => e.sourceId === s.sourceId);
        return Boolean(e && completeScope(e, s));
      })(),
      recordLocators: s.kind === 'records' ? s.evidence.map(({ recordId, field }) => ({ recordId, field })) : [],
    })),
  });
}
export const reportHash = (report: ReportSnapshot) => hashBytes(canonicalJson(reportSnapshotSchema.parse(report)));
export const reportRequestSchema = z
  .object({ caseId: z.uuid(), reportId: z.uuid().optional(), retryPublication: z.boolean().default(false) })
  .strict();

export const reviewCheckpointSchema = z
  .object({
    caseId: z.uuid(),
    reportId: z.uuid(),
    version: z.number().int().positive(),
    workflowRunId: z.string().min(1),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    phase: z.enum(['AWAITING_REVIEW', 'PUBLICATION_FAILED']),
    artifactId: z.uuid().optional(),
    failure: failureSchema.optional(),
  })
  .strict()
  .refine(
    v => (v.phase === 'AWAITING_REVIEW' ? Boolean(v.artifactId) : v.artifactId === undefined),
    'Only published review checkpoints may contain an artifact identifier.',
  );
