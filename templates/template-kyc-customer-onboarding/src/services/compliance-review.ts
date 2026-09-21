import type { NotificationProvider } from '../contracts/communications/notifications.js';
import { durableJurisdictionPolicySchema } from '../contracts/policies/policies.js';
import type {
  CasePolicySnapshotRepository,
  ComplianceReviewRepository,
  RiskAssessmentRepository,
  WorkflowResumeCommandRepository,
} from '../contracts/repositories/decision-repositories.js';
import type { Clock } from '../contracts/technical/primitives.js';
import { actorSchema, type Actor } from '../domain/context.js';
import { DomainInvariantError } from '../domain/errors.js';
import { workflowResumeCommandSchema } from '../domain/hitl.js';
import { complianceReviewSchema, reviewDecisionRecordSchema, type ComplianceReview } from '../domain/review.js';
import { reviewerFeedbackSchema } from '../domain/review.js';
import { createStableIdentifier, fingerprintValue } from './stable-identifiers.js';

type ReviewDecisionInput = Readonly<{
  tenantId: string;
  reviewId: string;
  reviewer: Actor;
  decision: 'APPROVE' | 'REJECT' | 'ESCALATE';
  reasonCode: 'REVIEW_APPROVED' | 'REVIEW_REJECTED' | 'REVIEW_ESCALATED';
  safeNote: string | null;
  feedback?:
    | Readonly<{
        extractionUseful: boolean | null;
        screeningUseful: boolean | null;
        riskUseful: boolean | null;
        evidenceUseful: boolean | null;
        falsePositiveEscalation?: boolean | null | undefined;
        curatedForDataset?: boolean | undefined;
        note: string | null;
      }>
    | undefined;
}>;

export class ComplianceReviewService {
  constructor(
    private readonly snapshots: CasePolicySnapshotRepository,
    private readonly risks: RiskAssessmentRepository,
    private readonly reviews: ComplianceReviewRepository,
    private readonly commands: WorkflowResumeCommandRepository,
    private readonly notifications: NotificationProvider,
    private readonly clock: Clock,
  ) {}

  decisionCapabilities(review: ComplianceReview) {
    const capabilities = [
      { decision: 'APPROVE', reasonCode: 'REVIEW_APPROVED' },
      { decision: 'REJECT', reasonCode: 'REVIEW_REJECTED' },
      { decision: 'ESCALATE', reasonCode: 'REVIEW_ESCALATED' },
    ] as const;
    return capabilities.filter(
      ({ decision }) =>
        !(review.level === 'SENIOR' && decision === 'ESCALATE') &&
        !(
          review.level === 'INITIAL' &&
          decision === 'APPROVE' &&
          (review.riskRoute === 'INSUFFICIENT_INFORMATION' || review.riskRoute === 'ESCALATE_RECOMMENDED')
        ),
    );
  }

  async open(
    input: Readonly<{
      tenantId: string;
      caseId: string;
      workflowId: string;
      workflowRunId: string;
      workflowStepId: string;
      threadId: string;
      level: 'INITIAL' | 'SENIOR';
      priorReviewId: string | null;
      authorizedReviewer: Actor;
      idempotencyKey: string;
    }>,
  ) {
    const snapshot = await this.snapshots.get({ tenantId: input.tenantId, caseId: input.caseId });
    const policy = durableJurisdictionPolicySchema.parse(snapshot.policy);
    const risk = await this.risks.getLatest({ tenantId: input.tenantId, caseId: input.caseId });
    if (risk.policyChecksum !== policy.checksum) {
      throw new DomainInvariantError('Risk assessment does not match the pinned review policy');
    }
    const reviewer = actorSchema.parse(input.authorizedReviewer);
    const requiredRole = input.level === 'SENIOR' ? policy.seniorReviewerRole : policy.requiredReviewerRole;
    if (!reviewer.roles.includes(requiredRole)) {
      throw new DomainInvariantError('Authorized reviewer does not hold the required role');
    }
    if ((input.level === 'INITIAL') !== (input.priorReviewId === null)) {
      throw new DomainInvariantError('Review level and parent binding are inconsistent');
    }
    if (input.priorReviewId !== null) {
      const priorDecision = await this.reviews.getDecision({
        tenantId: input.tenantId,
        reviewId: input.priorReviewId,
      });
      if (priorDecision.decision !== 'ESCALATE' || priorDecision.reviewerId === reviewer.id) {
        throw new DomainInvariantError('Senior review requires a distinct reviewer after escalation');
      }
    }
    const createdAt = this.clock.now().toISOString();
    const expiresAt = new Date(
      this.clock.now().getTime() + policy.missingInformation.resumeTtlHours * 60 * 60 * 1000,
    ).toISOString();
    const reviewKey = `${input.idempotencyKey}:${input.level}:${input.priorReviewId ?? 'initial'}`;
    const reviewId = createStableIdentifier('review', input.tenantId, reviewKey);
    const decisionId = createStableIdentifier('review-decision', input.tenantId, reviewId);
    const commandId = createStableIdentifier('resume-command', input.tenantId, reviewId);
    const routeReason =
      risk.route === 'INSUFFICIENT_INFORMATION'
        ? 'RISK_POLICY_INSUFFICIENT_INFORMATION'
        : risk.route === 'ESCALATE_RECOMMENDED'
          ? 'RISK_POLICY_ESCALATE_RECOMMENDED'
          : risk.route === 'REJECT_RECOMMENDED'
            ? 'RISK_POLICY_REJECT_RECOMMENDED'
            : 'RISK_POLICY_AUTO_REVIEW';
    const evidenceIds = risk.evidenceIds;
    const review = complianceReviewSchema.parse({
      id: reviewId,
      tenantId: input.tenantId,
      caseId: input.caseId,
      workflowRunId: input.workflowRunId,
      workflowStepId: input.workflowStepId,
      threadId: input.threadId,
      level: input.level,
      priorReviewId: input.priorReviewId,
      riskAssessmentId: risk.id,
      requiredRole,
      status: 'PENDING',
      caseReference: `KYC-${input.caseId.slice(-12)}`,
      riskLevel: risk.level,
      riskRoute: risk.route,
      reasonCodes: [...new Set([...risk.factors.map(factor => factor.code), routeReason])],
      policy: { id: policy.id, version: policy.version, checksum: policy.checksum },
      evidenceIds,
      expiresAt,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    });
    const requestFingerprint = fingerprintValue({
      tenantId: input.tenantId,
      caseId: input.caseId,
      reviewId,
      decisionId,
      reviewerId: reviewer.id,
      requiredRole,
      policy: review.policy,
    });
    const command = workflowResumeCommandSchema.parse({
      id: commandId,
      tenantId: input.tenantId,
      caseId: input.caseId,
      workflowId: input.workflowId,
      workflowRunId: input.workflowRunId,
      workflowStepId: input.workflowStepId,
      threadId: input.threadId,
      actionType: 'COMPLIANCE_REVIEW',
      targetId: reviewId,
      authorizedActorId: reviewer.id,
      requiredRole,
      requestFingerprint,
      payloadFingerprint: null,
      idempotencyKey: `${reviewKey}:resume-command`,
      resumePayloadId: decisionId,
      status: 'PENDING',
      expiresAt,
      executionStartedAt: null,
      consumedAt: null,
      resultReference: null,
      completedOutcome: null,
      resultFingerprint: null,
      createdAt,
      updatedAt: createdAt,
      version: 1,
    });
    const persistedReview = await this.reviews.create({
      review,
      idempotencyKey: `${reviewKey}:review`,
    });
    const persistedCommand = await this.commands.create({ command });
    const notificationId = createStableIdentifier('notification', input.tenantId, reviewId);
    const safeMessage = `Compliance review is required for case ${review.caseReference}.`;
    const actionPath = 'Continue this Studio task to record the compliance decision.';
    await this.notifications.send(
      {
        notification: {
          id: notificationId,
          tenantId: input.tenantId,
          caseId: input.caseId,
          type: 'REVIEW_REQUIRED',
          safeMessage,
          actionPath,
          createdAt: persistedReview.createdAt,
        },
        idempotencyKey: `${reviewKey}:notification`,
      },
      {
        execution: {
          tenantId: input.tenantId,
          jurisdiction: policy.jurisdiction,
          piiMode: policy.profile,
          policy: review.policy,
          locale: 'en-US',
          correlationId: `review-${reviewId}`,
          actor: reviewer,
        },
        deadlineAt: persistedReview.expiresAt,
        attempt: 1,
        idempotencyKey: reviewKey,
      },
    );
    return { review: persistedReview, command: persistedCommand };
  }

  async validateDecision(input: ReviewDecisionInput) {
    const review = await this.reviews.get({ tenantId: input.tenantId, reviewId: input.reviewId });
    const reviewer = actorSchema.parse(input.reviewer);
    if (!reviewer.roles.includes(review.requiredRole)) {
      throw new DomainInvariantError('Reviewer does not hold the required role');
    }
    if (this.clock.now().toISOString() > review.expiresAt) {
      throw new DomainInvariantError('Compliance review expired');
    }
    const capability = this.decisionCapabilities(review).find(({ decision }) => decision === input.decision);
    if (capability === undefined) {
      if (review.level === 'SENIOR') {
        throw new DomainInvariantError('Senior review cannot be escalated again');
      }
      throw new DomainInvariantError('Initial reviewer lacks authority to approve this route');
    }
    if (review.priorReviewId !== null) {
      const prior = await this.reviews.getDecision({
        tenantId: input.tenantId,
        reviewId: review.priorReviewId,
      });
      if (prior.reviewerId === reviewer.id) {
        throw new DomainInvariantError('Senior reviewer must be distinct from initial reviewer');
      }
    }
    if (input.reasonCode !== capability.reasonCode) {
      throw new DomainInvariantError('Review decision reason does not match the decision');
    }
    return { review, reviewer };
  }

  async decide(input: ReviewDecisionInput & Readonly<{ idempotencyKey: string }>) {
    const { review, reviewer } = await this.validateDecision(input);
    const decision = reviewDecisionRecordSchema.parse({
      id: createStableIdentifier('review-decision', input.tenantId, review.id),
      tenantId: input.tenantId,
      caseId: review.caseId,
      reviewId: review.id,
      decision: input.decision,
      reviewerId: reviewer.id,
      reviewerRoles: reviewer.roles,
      reasonCode: input.reasonCode,
      policy: review.policy,
      safeNote: input.safeNote,
      evidenceIds: review.evidenceIds,
      decidedAt: this.clock.now().toISOString(),
    });
    const feedback = reviewerFeedbackSchema.parse({
      id: createStableIdentifier('review-feedback', input.tenantId, review.id),
      tenantId: input.tenantId,
      caseId: review.caseId,
      reviewId: review.id,
      reviewerId: reviewer.id,
      extractionUseful: input.feedback?.extractionUseful ?? null,
      screeningUseful: input.feedback?.screeningUseful ?? null,
      riskUseful: input.feedback?.riskUseful ?? null,
      evidenceUseful: input.feedback?.evidenceUseful ?? null,
      falsePositiveEscalation: input.feedback?.falsePositiveEscalation ?? null,
      curatedForDataset: input.feedback?.curatedForDataset ?? false,
      note: input.feedback?.note ?? input.safeNote,
      createdAt: decision.decidedAt,
    });
    return this.reviews.decide({
      decision,
      feedback,
      expectedVersion: review.version,
      idempotencyKey: input.idempotencyKey,
    });
  }
}
