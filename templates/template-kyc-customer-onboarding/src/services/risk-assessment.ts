import { durableJurisdictionPolicySchema } from '../contracts/policies/policies.js';
import type { RiskPolicyProvider } from '../contracts/policies/policies.js';
import type { RiskAssessmentProvider } from '../contracts/providers/risk-assessment.js';
import type {
  CasePolicySnapshotRepository,
  RiskAssessmentRepository,
} from '../contracts/repositories/decision-repositories.js';
import type { Clock } from '../contracts/technical/primitives.js';
import { riskAssessmentSchema } from '../domain/risk.js';
import type { CompletenessAssessmentService } from './completeness-assessment.js';
import type { EvidenceAggregationService } from './evidence-aggregation.js';

export class RiskAssessmentService {
  constructor(
    private readonly snapshots: CasePolicySnapshotRepository,
    private readonly completeness: CompletenessAssessmentService,
    private readonly evidence: EvidenceAggregationService,
    private readonly deterministicPolicy: RiskPolicyProvider,
    private readonly narrativeProvider: RiskAssessmentProvider,
    private readonly assessments: RiskAssessmentRepository,
    private readonly clock: Clock,
  ) {}

  async assess(
    input: Readonly<{
      tenantId: string;
      caseId: string;
      completedInformationRounds: number;
      idempotencyKey: string;
    }>,
  ) {
    const snapshot = await this.snapshots.get({ tenantId: input.tenantId, caseId: input.caseId });
    const policy = durableJurisdictionPolicySchema.parse(snapshot.policy);
    const completeness = await this.completeness.evaluate({
      tenantId: input.tenantId,
      caseId: input.caseId,
      policy,
      qualityPolicy: {
        id: 'extraction-quality',
        version: '1.0.0',
        minimumFieldConfidence: 0.8,
        enforceMinimumFieldConfidence: policy.profile === 'demo-strict',
        unreadableRoute: 'MISSING_INFORMATION',
      },
      completedRounds: input.completedInformationRounds,
    });
    const bundle = await this.evidence.aggregate({ tenantId: input.tenantId, caseId: input.caseId });
    const assessedAt = this.clock.now().toISOString();
    const deterministic = await this.deterministicPolicy.evaluate({
      tenantId: input.tenantId,
      caseId: input.caseId,
      policy,
      evidence: bundle.evidence,
      evidenceCompleteness: completeness.status === 'COMPLETE' ? 'COMPLETE' : 'INCOMPLETE',
      missingInformationExhausted: completeness.status === 'INSUFFICIENT_INFORMATION',
      assessedAt,
    });
    const narrative = await this.narrativeProvider.explain({
      tenantId: input.tenantId,
      caseId: input.caseId,
      riskAssessmentId: deterministic.id,
      policy: { id: policy.id, version: policy.version, checksum: policy.checksum },
      evidenceFingerprint: bundle.fingerprint,
      signals: deterministic.factors.map(factor => ({
        code: factor.code,
        weight: factor.weight,
      })),
      score: deterministic.score,
      level: deterministic.level,
      route: deterministic.route,
      generatedAt: assessedAt,
    });
    const assessment = riskAssessmentSchema.parse({ ...deterministic, narrative });
    await this.assessments.put({ assessment, idempotencyKey: input.idempotencyKey });
    return { assessment, completeness, evidence: bundle };
  }
}
