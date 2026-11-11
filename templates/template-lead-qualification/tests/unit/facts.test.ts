import { describe, expect, it } from 'vitest';
import { qualificationConfig, snapshotConfiguration } from '../../src/mastra/config/qualification';
import { candidateSchema } from '../../src/mastra/research/contracts';
import type { BranchResult, Candidate } from '../../src/mastra/research/contracts';
import { collectFacts } from '../../src/mastra/research/facts';

const snapshot = snapshotConfiguration(qualificationConfig, '2026-10-20T00:00:00Z');
const day = 86_400_000;
function candidate(attribute: Candidate['attribute'], value: Candidate['value'], id: string, age: number | null) {
  return candidateSchema.parse({
    id,
    attribute,
    value,
    evidenceId: `source-${id}`,
    quote: 'An exact supported source passage.',
    asOf: age === null ? null : new Date(Date.parse(snapshot.assessmentTime) - age * day).toISOString(),
  });
}
function facts(candidates: Candidate[]) {
  const branch: BranchResult = {
    branch: 'firmographics',
    candidates,
    evidence: [],
    rejections: [],
    failures: [],
    analysisComplete: true,
    intentCoverageComplete: false,
    identityAmbiguous: false,
  };
  return collectFacts([branch], snapshot);
}

describe('firmographic evidence freshness', () => {
  it.each([
    ['businessModel', 'b2b_saas', 'other'],
    ['employeeCount', { min: 40, max: 40 }, { min: 1000, max: 1000 }],
    ['headquartersCountry', 'US', 'CN'],
  ] as const)('uses_current_support_without_expired_or_future_%s_claims', (attribute, current, outdated) => {
    const result = facts([
      candidate(attribute, outdated, 'expired', 31),
      candidate(attribute, current, 'current', 1),
      candidate(attribute, outdated, 'future', -1),
    ])[attribute];
    expect(result).toMatchObject({
      disposition: 'accepted',
      freshness: 'current',
      value: current,
      candidateIds: ['current'],
      evidenceIds: ['source-current'],
    });
  });

  it('retains_stale_provenance_when_no_current_claim_remains', () => {
    expect(facts([candidate('employeeCount', { min: 40, max: 40 }, 'expired', 31)]).employeeCount).toMatchObject({
      disposition: 'stale',
      freshness: 'stale',
      value: null,
      candidateIds: ['expired'],
      evidenceIds: ['source-expired'],
    });
    expect(facts([]).employeeCount.disposition).toBe('missing');
  });

  it('accepts_the_freshness_boundary_and_undated_support_without_hiding_current_conflicts', () => {
    expect(
      facts([
        candidate('employeeCount', { min: 40, max: 40 }, 'boundary', 30),
        candidate('employeeCount', { min: 40, max: 40 }, 'undated', null),
      ]).employeeCount,
    ).toMatchObject({ disposition: 'accepted', value: { min: 40, max: 40 } });
    expect(
      facts([
        candidate('employeeCount', { min: 40, max: 40 }, 'current', 1),
        candidate('employeeCount', { min: 1000, max: 1000 }, 'contradiction', 2),
      ]).employeeCount.disposition,
    ).toBe('conflicting');
  });
});
