import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';

import { applyKycEvalReviewHarness } from './kyc-eval-review-harness.js';

export const kycEvalDatasetIdSchema = z.enum([
  'document-extraction',
  'document-quality',
  'policy-cases',
  'screening-cases',
  'escalation-cases',
  'consistency-cases',
  'workflow-trajectories',
]);
export const kycEvalDecisionSchema = z.enum([
  'ACTIVE',
  'REJECTED',
  'ESCALATED',
  'MISSING_INFORMATION',
  'COMPLIANCE_REVIEW',
]);
export const kycEvalCriticalFieldSchema = z.enum(['fullName', 'dateOfBirth', 'documentNumber', 'expirationDate']);
export const kycEvalNormalizedFieldSchema = z.enum([
  ...kycEvalCriticalFieldSchema.options,
  'nationality',
  'residentialAddress',
]);
const digestSchema = z.string().regex(/^[a-f0-9]{64}$/u);
export const kycEvalNormalizedFieldDigestsSchema = z.record(kycEvalNormalizedFieldSchema, digestSchema);
export const kycEvalEvidenceTypeSchema = z.enum([
  'document',
  'identity',
  'address',
  'sanctions',
  'pep',
  'provider-status',
  'risk',
]);
export const kycEvalEvidenceRecordSchema = z
  .object({
    type: kycEvalEvidenceTypeSchema,
    sourceId: z.string().regex(/^[a-z0-9-]+$/u),
    sourceVersion: z.string().regex(/^\d+\.\d+\.\d+$/u),
    status: z.string().regex(/^[A-Z_]+$/u),
    reasonCode: z.string().regex(/^[A-Z0-9_]+$/u),
    occurredAt: z.iso.datetime({ offset: true }),
    referenceId: z.string().regex(/^[a-z0-9-]+$/u),
  })
  .strict();

export const kycEvalAutomaticCommandSchema = z.enum([
  'SUBMIT_APPLICATION',
  'BEGIN_EXTRACTION',
  'REQUEST_INFORMATION',
  'BEGIN_CHECKS',
  'BEGIN_RISK_ASSESSMENT',
  'REQUEST_COMPLIANCE_REVIEW',
]);

export const kycEvalGroundTruthSchema = z
  .object({
    requiredCriticalFields: z.array(kycEvalCriticalFieldSchema).min(1),
    normalizedFieldCount: z.number().int().min(0).max(20),
    expectedNormalizedFieldDigests: kycEvalNormalizedFieldDigestsSchema,
    hardStopRequired: z.boolean(),
    expectedRiskRoute: z.enum([
      'NOT_APPLICABLE',
      'AUTO_REVIEW',
      'REJECT_RECOMMENDED',
      'ESCALATE_RECOMMENDED',
      'INSUFFICIENT_INFORMATION',
    ]),
    policyCompliant: z.literal(true),
    requiredEvidence: z.array(kycEvalEvidenceTypeSchema).min(1),
    reviewAction: z.enum(['APPROVE', 'REJECT', 'ESCALATE', 'NONE']),
    requiresEscalation: z.boolean(),
    decision: kycEvalDecisionSchema,
    trajectory: z.array(z.string().regex(/^[A-Z_]+$/u)).min(2),
  })
  .strict();

export const kycEvalOutputSchema = z
  .object({
    hardStopTriggered: z.boolean(),
    riskRoute: kycEvalGroundTruthSchema.shape.expectedRiskRoute,
    evidenceRecords: z.array(kycEvalEvidenceRecordSchema),
    automaticCommands: z.array(kycEvalAutomaticCommandSchema).min(3),
    trajectory: z.array(z.string().regex(/^[A-Z_]+$/u)),
    normalizedFieldDigests: kycEvalNormalizedFieldDigestsSchema,
  })
  .strict();

export type KycEvalGroundTruth = z.infer<typeof kycEvalGroundTruthSchema>;
export type KycEvalOutput = z.infer<typeof kycEvalOutputSchema>;
export type KycEvalDatasetId = z.infer<typeof kycEvalDatasetIdSchema>;

const groundTruth = (value: unknown): KycEvalGroundTruth => kycEvalGroundTruthSchema.parse(value);
const output = (value: unknown): KycEvalOutput => kycEvalOutputSchema.parse(value);
const scenarioId = (input: { scenarioId: string } | undefined): string => {
  if (input === undefined) throw new Error('KYC eval scorer requires scenario input');
  return input.scenarioId;
};
const harnessResult = (scenarioId: string, actual: KycEvalOutput, expected: KycEvalGroundTruth) => {
  try {
    return applyKycEvalReviewHarness({
      scenarioId,
      automaticCommands: actual.automaticCommands,
      reviewAction: expected.reviewAction,
    });
  } catch {
    return null;
  }
};

export const criticalExtractionFieldsScorer = createScorer<
  { scenarioId: string },
  KycEvalOutput,
  'critical-extraction-fields'
>({
  id: 'critical-extraction-fields',
  description: 'Requires every critical extraction field digest and any hard stop to be exact.',
}).generateScore(({ run }) => {
  const expected = groundTruth(run.groundTruth);
  const actual = output(run.output);
  const fieldsPass = expected.requiredCriticalFields.every(
    field => actual.normalizedFieldDigests[field] === expected.expectedNormalizedFieldDigests[field],
  );
  return fieldsPass && actual.hardStopTriggered === expected.hardStopRequired ? 1 : 0;
});

export const normalizedExtractionScorer = createScorer<{ scenarioId: string }, KycEvalOutput, 'normalized-extraction'>({
  id: 'normalized-extraction',
  description: 'Scores field-separated normalized digests and penalizes omissions or hallucinations.',
}).generateScore(({ run }) => {
  const expected = groundTruth(run.groundTruth);
  const actual = output(run.output);
  const matches = kycEvalNormalizedFieldSchema.options.filter(
    field => actual.normalizedFieldDigests[field] === expected.expectedNormalizedFieldDigests[field],
  ).length;
  return matches / kycEvalNormalizedFieldSchema.options.length;
});

export const policyAdherenceScorer = createScorer<{ scenarioId: string }, KycEvalOutput, 'policy-adherence'>({
  id: 'policy-adherence',
  description: 'Checks the runtime completeness and deterministic risk-policy route.',
}).generateScore(({ run }) => {
  const expected = groundTruth(run.groundTruth);
  const actual = output(run.output);
  return actual.riskRoute === expected.expectedRiskRoute && actual.hardStopTriggered === expected.hardStopRequired
    ? 1
    : 0;
});

export const evidenceCompletenessScorer = createScorer<{ scenarioId: string }, KycEvalOutput, 'evidence-completeness'>({
  id: 'evidence-completeness',
  description: 'Requires complete structured PII-safe evidence records for every expected family.',
}).generateScore(({ run }) => {
  const expected = groundTruth(run.groundTruth);
  const actual = output(run.output);
  return expected.requiredEvidence.every(type => actual.evidenceRecords.some(record => record.type === type)) ? 1 : 0;
});

export const escalationScorer = createScorer<{ scenarioId: string }, KycEvalOutput, 'escalation-classification'>({
  id: 'escalation-classification',
  description: 'Makes escalation false negatives visible for aggregate recall and precision.',
}).generateScore(({ run }) => {
  const expected = groundTruth(run.groundTruth);
  const actual = output(run.output);
  return harnessResult(scenarioId(run.input), actual, expected)?.escalated === expected.requiresEscalation ? 1 : 0;
});

export const decisionConsistencyScorer = createScorer<{ scenarioId: string }, KycEvalOutput, 'decision-consistency'>({
  id: 'decision-consistency',
  description: 'Requires the deterministic state-machine outcome to match.',
}).generateScore(({ run }) => {
  const expected = groundTruth(run.groundTruth);
  const actual = output(run.output);
  return harnessResult(scenarioId(run.input), actual, expected)?.decision === expected.decision ? 1 : 0;
});

export const requiredTrajectoryScorer = createScorer<{ scenarioId: string }, KycEvalOutput, 'required-trajectory'>({
  id: 'required-trajectory',
  description: 'Requires the complete ordered state trajectory.',
}).generateScore(({ run }) => {
  const expected = groundTruth(run.groundTruth).trajectory;
  const candidate = output(run.output);
  const actual = harnessResult(scenarioId(run.input), candidate, groundTruth(run.groundTruth))?.trajectory;
  return actual?.length === expected.length && actual.every((item, index) => item === expected[index]) ? 1 : 0;
});

export const kycScorers = Object.freeze({
  criticalExtractionFields: criticalExtractionFieldsScorer,
  normalizedExtraction: normalizedExtractionScorer,
  policyAdherence: policyAdherenceScorer,
  evidenceCompleteness: evidenceCompletenessScorer,
  escalationClassification: escalationScorer,
  decisionConsistency: decisionConsistencyScorer,
  requiredTrajectory: requiredTrajectoryScorer,
});

export const kycDatasetScorers = {
  'document-extraction': [criticalExtractionFieldsScorer, normalizedExtractionScorer],
  'document-quality': [policyAdherenceScorer, evidenceCompletenessScorer],
  'policy-cases': [policyAdherenceScorer, decisionConsistencyScorer],
  'screening-cases': [escalationScorer, evidenceCompletenessScorer],
  'escalation-cases': [escalationScorer],
  'consistency-cases': [decisionConsistencyScorer],
  'workflow-trajectories': [requiredTrajectoryScorer, policyAdherenceScorer],
} as const;
