import { createHash } from 'node:crypto';
import type { z } from 'zod';

import type {
  JurisdictionPolicyProvider,
  PiiProtectionPolicy,
  RiskPolicyProvider,
} from '../../contracts/policies/policies.js';
import { evaluateRiskInputSchema, jurisdictionPolicySchema } from '../../contracts/policies/policies.js';
import type { PiiCategory } from '../../contracts/shared/provider.js';
import { demoDefaultPolicy } from '../../config/policies/demo-default.js';
import { demoStrictPolicy } from '../../config/policies/demo-strict.js';
import type { RiskAssessment } from '../../domain/risk.js';
import { deepFreeze } from '../../domain/immutable.js';

export class StaticJurisdictionPolicyProvider implements JurisdictionPolicyProvider {
  constructor(private readonly fixedPolicy?: z.infer<typeof jurisdictionPolicySchema>) {}

  resolve(input: Parameters<JurisdictionPolicyProvider['resolve']>[0]) {
    const policy = this.fixedPolicy ?? (input.profile === 'demo-strict' ? demoStrictPolicy : demoDefaultPolicy);
    if (policy.profile !== input.profile) {
      throw new Error('Jurisdiction policy selection does not match the registered policy');
    }
    const parsed = jurisdictionPolicySchema.parse(policy);
    deepFreeze(parsed);
    return Promise.resolve(parsed);
  }
}

export class DeterministicRiskPolicyProvider implements RiskPolicyProvider {
  evaluate(input: Parameters<RiskPolicyProvider['evaluate']>[0]): Promise<RiskAssessment> {
    const parsed = evaluateRiskInputSchema.parse(input);
    const weights = parsed.policy.risk.weights;
    const factors: RiskAssessment['factors'] = [];
    for (const item of parsed.evidence) {
      const status =
        typeof item.metadata.status === 'string'
          ? item.metadata.status
          : item.kind === 'SANCTIONS_CANDIDATE' || item.kind === 'PEP_CANDIDATE'
            ? 'POSSIBLE_MATCH'
            : item.kind === 'SANCTIONS_CHECK' || item.kind === 'PEP_CHECK'
              ? 'CLEAR'
              : '';
      const check =
        typeof item.metadata.checkKind === 'string'
          ? item.metadata.checkKind
          : item.kind.startsWith('SANCTIONS')
            ? 'SANCTIONS'
            : item.kind.startsWith('PEP')
              ? 'PEP'
              : '';
      if (item.kind === 'PROVIDER_UNAVAILABLE') {
        factors.push({
          code: 'EVIDENCE_REQUIRED_CHECK_UNAVAILABLE',
          weight: status === 'INCONCLUSIVE' ? weights.inconclusive : weights.unavailable,
          evidenceIds: [item.id],
        });
        continue;
      }
      if (check === 'IDENTITY') {
        factors.push({
          code:
            status === 'NOT_VERIFIED'
              ? 'RISK_IDENTITY_MISMATCH'
              : status === 'VERIFIED'
                ? 'RISK_IDENTITY_MATCH'
                : 'RISK_IDENTITY_INCONCLUSIVE',
          weight:
            status === 'NOT_VERIFIED' ? weights.identityMismatch : status === 'VERIFIED' ? 0 : weights.inconclusive,
          evidenceIds: [item.id],
        });
        continue;
      }
      if (check === 'ADDRESS') {
        factors.push({
          code:
            status === 'NOT_VERIFIED'
              ? 'RISK_ADDRESS_MISMATCH'
              : status === 'VERIFIED'
                ? 'RISK_ADDRESS_MATCH'
                : 'RISK_ADDRESS_INCONCLUSIVE',
          weight:
            status === 'NOT_VERIFIED' ? weights.addressMismatch : status === 'VERIFIED' ? 0 : weights.inconclusive,
          evidenceIds: [item.id],
        });
        continue;
      }
      if (check === 'SANCTIONS') {
        factors.push({
          code:
            status === 'STRONG_CANDIDATE'
              ? 'RISK_SANCTIONS_STRONG'
              : status === 'POSSIBLE_MATCH'
                ? 'RISK_SANCTIONS_POSSIBLE'
                : 'RISK_SANCTIONS_CLEAR',
          weight:
            status === 'STRONG_CANDIDATE'
              ? weights.sanctionsStrong
              : status === 'POSSIBLE_MATCH'
                ? weights.sanctionsPossible
                : 0,
          evidenceIds: [item.id],
        });
        continue;
      }
      if (check === 'PEP') {
        factors.push({
          code:
            status === 'STRONG_CANDIDATE'
              ? 'RISK_PEP_STRONG'
              : status === 'POSSIBLE_MATCH'
                ? 'RISK_PEP_POSSIBLE'
                : 'RISK_PEP_CLEAR',
          weight:
            status === 'STRONG_CANDIDATE' ? weights.pepStrong : status === 'POSSIBLE_MATCH' ? weights.pepPossible : 0,
          evidenceIds: [item.id],
        });
      }
    }
    const score = Math.min(
      100,
      factors.reduce((total, factor) => total + factor.weight, 0),
    );
    const thresholds = parsed.policy.risk.thresholds;
    const level = score <= thresholds.lowMax ? 'LOW' : score <= thresholds.mediumMax ? 'MEDIUM' : 'HIGH';
    const hasUnavailable = factors.some(factor => factor.code === 'EVIDENCE_REQUIRED_CHECK_UNAVAILABLE');
    const hasStrongCandidate = factors.some(
      factor => factor.code === 'RISK_SANCTIONS_STRONG' || factor.code === 'RISK_PEP_STRONG',
    );
    const hasIdentityMismatch = factors.some(factor => factor.code === 'RISK_IDENTITY_MISMATCH');
    const route =
      parsed.evidenceCompleteness === 'INCOMPLETE' || parsed.missingInformationExhausted || hasUnavailable
        ? 'INSUFFICIENT_INFORMATION'
        : hasStrongCandidate
          ? 'ESCALATE_RECOMMENDED'
          : hasIdentityMismatch
            ? 'REJECT_RECOMMENDED'
            : level === 'HIGH'
              ? 'ESCALATE_RECOMMENDED'
              : 'AUTO_REVIEW';
    const assessmentFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          tenantId: parsed.tenantId,
          caseId: parsed.caseId,
          policyChecksum: parsed.policy.checksum,
          factors,
        }),
      )
      .digest('hex');
    return Promise.resolve({
      id: `risk-${assessmentFingerprint.slice(0, 24)}`,
      tenantId: parsed.tenantId,
      caseId: parsed.caseId,
      evidenceCompleteness: parsed.evidenceCompleteness,
      level,
      score,
      route,
      factors,
      evidenceIds: [...new Set(parsed.evidence.map(item => item.id))].sort(),
      policyId: parsed.policy.id,
      policyVersion: parsed.policy.version,
      policyChecksum: parsed.policy.checksum,
      engine: { id: 'deterministic-risk-policy', version: '1.0.0' },
      narrative: null,
      assessedAt: parsed.assessedAt,
    });
  }
}

export class DeterministicPiiProtectionPolicy implements PiiProtectionPolicy {
  allowsTransmission(input: Parameters<PiiProtectionPolicy['allowsTransmission']>[0]): boolean {
    if (!input.externalNetwork) return true;
    if (input.categories.includes('SECRET')) return false;
    if (input.mode === 'demo-strict' && !input.explicitAllowlist.includes(input.providerId)) return false;
    return !input.categories.includes('DOCUMENT_CONTENT') || input.explicitAllowlist.includes(input.providerId);
  }

  mask(category: PiiCategory, value: string): string {
    if (category === 'NONE') return value;
    if (
      category === 'SECRET' ||
      category === 'DOCUMENT_CONTENT' ||
      category === 'DOCUMENT_NUMBER' ||
      category === 'DATE_OF_BIRTH'
    )
      return '[REDACTED]';
    if (value.length <= 4) return '*'.repeat(value.length);
    return `${value.slice(0, 2)}${'*'.repeat(Math.max(1, value.length - 4))}${value.slice(-2)}`;
  }
}
