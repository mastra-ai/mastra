import { z } from 'zod';

import type { AccountProvisioningProvider } from '../../../contracts/provisioning/account-provisioning.js';
import type { CaseRepository } from '../../../contracts/repositories/case-repository.js';
import type {
  CasePolicySnapshotRepository,
  ComplianceReviewRepository,
  InformationRequestRepository,
  WorkflowResumeCommandRepository,
} from '../../../contracts/repositories/decision-repositories.js';
import type { Clock, ProviderMetricsRecorder } from '../../../contracts/technical/primitives.js';
import type { Actor, ExecutionContext } from '../../../domain/context.js';
import { policyReferenceSchema } from '../../../domain/context.js';
import { accountProvisioningResultSchema } from '../../../domain/provisioning.js';
import {
  caseIdSchema,
  evidenceIdSchema,
  reviewDecisionIdSchema,
  reviewIdSchema,
  riskAssessmentIdSchema,
  threadIdSchema,
} from '../../../domain/identifiers.js';
import type { ComplianceReviewService } from '../../../services/compliance-review.js';
import type { CompletenessAssessmentService } from '../../../services/completeness-assessment.js';
import type { EvidenceAggregationService } from '../../../services/evidence-aggregation.js';
import type { MissingInformationService } from '../../../services/missing-information.js';
import type { RiskAssessmentService } from '../../../services/risk-assessment.js';
import type {
  AddressVerificationTool,
  IdentityVerificationTool,
  PepScreeningTool,
  SanctionsScreeningTool,
} from '../../tools/verification-checks.js';
import {
  kycApplicationWorkflowInputSchema,
  type KycApplicationWorkflow,
  type KycWorkflowRequestContext,
} from '../kyc-application-intake.js';

export const durableKycWorkflowInputSchema = z.intersection(
  kycApplicationWorkflowInputSchema,
  z.object({ studioThreadKey: threadIdSchema }),
);

export const durableKycWorkflowStateSchema = z
  .object({
    caseId: caseIdSchema.nullable().default(null),
    policy: policyReferenceSchema.nullable().default(null),
    informationRound: z.number().int().nonnegative().default(0),
    currentAction: z.enum(['NONE', 'MISSING_INFORMATION', 'COMPLIANCE_REVIEW']).default('NONE'),
    currentActionId: z.string().min(1).max(128).nullable().default(null),
    reviewLevel: z.enum(['NONE', 'INITIAL', 'SENIOR']).default('NONE'),
  })
  .strict();

export const riskRouteSchema = z.enum([
  'AUTO_REVIEW',
  'REJECT_RECOMMENDED',
  'ESCALATE_RECOMMENDED',
  'INSUFFICIENT_INFORMATION',
]);

export const durableKycWorkflowOutputSchema = z
  .object({
    caseId: caseIdSchema,
    status: z.enum(['ACTIVE', 'REJECTED', 'PROVISIONING_FAILED']),
    decision: z.enum(['APPROVE', 'REJECT']),
    riskAssessmentId: riskAssessmentIdSchema,
    riskLevel: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    riskRoute: riskRouteSchema,
    reviewId: reviewIdSchema,
    decisionId: reviewDecisionIdSchema,
    account: accountProvisioningResultSchema.nullable(),
    evidenceIds: z.array(evidenceIdSchema).min(1),
    automaticSteps: z.array(z.string().min(1)),
    message: z.string().min(1).max(500),
  })
  .strict();

export type DurableKycWorkflowDependencies = Readonly<{
  initialWorkflow: KycApplicationWorkflow;
  cases: CaseRepository;
  snapshots: CasePolicySnapshotRepository;
  informationRequests: InformationRequestRepository;
  reviews: ComplianceReviewRepository;
  resumeCommands: WorkflowResumeCommandRepository;
  completeness: CompletenessAssessmentService;
  evidence: EvidenceAggregationService;
  missingInformation: MissingInformationService;
  riskAssessment: RiskAssessmentService;
  complianceReview: ComplianceReviewService;
  provisioning: AccountProvisioningProvider;
  providerMetrics: ProviderMetricsRecorder;
  clock: Clock;
  timeoutMs: number;
  identityVerification: IdentityVerificationTool;
  addressVerification: AddressVerificationTool;
  sanctionsScreening: SanctionsScreeningTool;
  pepScreening: PepScreeningTool;
}>;

export const contextFrom = (value: KycWorkflowRequestContext): ExecutionContext => ({
  tenantId: value.tenantId,
  jurisdiction: value.jurisdiction,
  piiMode: value.piiMode,
  policy: value.policy,
  locale: value.locale,
  correlationId: value.correlationId,
  actor: value.actor,
});

export const reviewerFor = (threadId: string, level: 'INITIAL' | 'SENIOR'): Actor => ({
  type: 'reviewer',
  id: threadId.startsWith('api-')
    ? level === 'SENIOR'
      ? 'demo-senior-reviewer'
      : 'demo-reviewer'
    : level === 'SENIOR'
      ? 'studio-senior-reviewer'
      : 'studio-reviewer',
  roles: level === 'SENIOR' ? ['senior-reviewer'] : ['reviewer', 'senior-reviewer'],
});

export const systemActor = Object.freeze({ type: 'system' as const, id: 'kyc-workflow', roles: [] });

export const riskRouteReason = (route: z.infer<typeof riskRouteSchema>) =>
  route === 'INSUFFICIENT_INFORMATION'
    ? 'RISK_POLICY_INSUFFICIENT_INFORMATION'
    : route === 'ESCALATE_RECOMMENDED'
      ? 'RISK_POLICY_ESCALATE_RECOMMENDED'
      : route === 'REJECT_RECOMMENDED'
        ? 'RISK_POLICY_REJECT_RECOMMENDED'
        : 'RISK_POLICY_AUTO_REVIEW';
