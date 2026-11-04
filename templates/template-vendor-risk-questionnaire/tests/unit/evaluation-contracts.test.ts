import { it, expect } from 'vitest';
import { measureEvaluation } from '../support/evaluation.ts';
import { goldLabelSchema } from '../fixtures/evaluation-labels.ts';
import { questionResultSchema } from '../../src/mastra/contracts/answer.ts';

it('keeps_critical_and_noncritical_unsupported_precision_and_recall_within_unit_interval', () => {
  const labels = ['critical', 'noncritical'].map((questionId, i) =>
    goldLabelSchema.parse({
      questionId,
      facts: [],
      values: ['unknown'],
      usefulEligible: false,
      escalation: true,
      reasons: ['MISSING_EVIDENCE'],
      criticalUnsupported: i === 0,
      forbiddenDisclosure: false,
      equivalentTo: null,
    }),
  );
  const judgments = labels.map(g => ({
    questionId: g.questionId,
    supportedClaimIds: [],
    coveredFactIds: [],
    correctCitationIds: [],
    forbiddenDisclosure: false,
    uncertainty: 'low' as const,
  }));
  for (const reason of ['MISSING_EVIDENCE', 'LOW_CONFIDENCE'] as const) {
    const results = labels.map((g, i) =>
      questionResultSchema.parse({
        questionId: g.questionId,
        order: i,
        draft: null,
        interpretation: null,
        status: 'review_required',
        reasons: [i === 0 ? reason : 'MISSING_EVIDENCE'],
        attempts: 0,
      }),
    );
    const report = measureEvaluation(labels, results, judgments);
    expect(report.scores.unsupportedRecall).toBe(reason === 'MISSING_EVIDENCE' ? 1 : 0);
    expect(report.scores.noncriticalUnsupportedRecall).toBe(1);
    expect(report.scores.unsupportedPrecision).toBe(1);
    for (const value of Object.values(report.scores))
      if (value !== null) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
  }
});
