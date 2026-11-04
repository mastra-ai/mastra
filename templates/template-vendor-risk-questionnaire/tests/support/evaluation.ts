import { createScorer } from '@mastra/core/evals';
import { z } from 'zod';
import { questionResultSchema } from '../../src/mastra/contracts/answer.ts';
import type { QuestionResult } from '../../src/mastra/contracts/answer.ts';
import { goldLabelSchema } from '../fixtures/evaluation-labels.ts';
import type { GoldLabel } from '../fixtures/evaluation-labels.ts';
import { canonicalJson, sha256 } from '../../src/mastra/intake/source.ts';
import { ratio } from '../../src/mastra/observability/metrics.ts';

export const judgmentSchema = z
  .object({
    questionId: z.string().min(1),
    supportedClaimIds: z.array(z.string()),
    coveredFactIds: z.array(z.string()),
    correctCitationIds: z.array(z.string()),
    forbiddenDisclosure: z.boolean(),
    uncertainty: z.enum(['low', 'medium', 'high']),
  })
  .strict()
  .refine(
    v => [v.supportedClaimIds, v.coveredFactIds, v.correctCitationIds].every(a => new Set(a).size === a.length),
    'Unique judge IDs required.',
  );
export type Judgment = z.infer<typeof judgmentSchema>;
export function validateCorpus(labels: GoldLabel[], ids: string[]) {
  const gold = labels.map(label => goldLabelSchema.parse(label));
  if (
    new Set(ids).size !== ids.length ||
    gold.length !== ids.length ||
    new Set(gold.map(g => g.questionId)).size !== ids.length ||
    gold.some(g => !ids.includes(g.questionId)) ||
    gold.some(g => g.equivalentTo && !ids.includes(g.equivalentTo))
  )
    throw new Error('INCOMPLETE_EVALUATION_LABELS');
  return gold;
}
export const semanticTargets = {
  groundedness: 0.9,
  completeness: 0.9,
  escalationAccuracy: 0.9,
  consistency: 0.9,
  attribution: 0.95,
  unsupportedRecall: 1,
  usefulAnswerRecall: 0.9,
  falseEscalation: 0.1,
};
export function measureEvaluation(labels: GoldLabel[], rawResults: QuestionResult[], rawJudgments: Judgment[]) {
  const results = rawResults.map(r => questionResultSchema.parse(r));
  const gold = validateCorpus(
    labels,
    results.map(r => r.questionId),
  );
  const judgments = rawJudgments.map(j => judgmentSchema.parse(j));
  if (
    judgments.length !== results.length ||
    new Set(judgments.map(j => j.questionId)).size !== results.length ||
    judgments.some(j => !results.some(r => r.questionId === j.questionId))
  )
    throw new Error('INCOMPLETE_EVALUATION_JUDGMENTS');
  let claims = 0,
    supported = 0,
    requiredFacts = 0,
    coveredFacts = 0,
    citations = 0,
    correctCitations = 0;
  let needed = 0,
    predicted = 0,
    truePositive = 0,
    correctRoute = 0,
    critical = 0,
    detected = 0,
    acceptedCritical = 0,
    forbidden = 0,
    useful = 0,
    eligible = 0,
    falseEscalated = 0,
    pairs = 0,
    consistent = 0;
  const unsupportedReasons = [
    'UNSUPPORTED_CLAIM',
    'UNSUPPORTED_COMMITMENT',
    'PARTIAL_EVIDENCE',
    'CONFLICTING_EVIDENCE',
    'MISSING_EVIDENCE',
  ];
  let unsupportedExpected = 0,
    unsupportedPredicted = 0,
    unsupportedTrue = 0,
    noncriticalExpected = 0,
    noncriticalDetected = 0;
  const cases = results.map(r => {
    const g = gold.find(g => g.questionId === r.questionId)!,
      j = judgments.find(j => j.questionId === r.questionId)!;
    const d = r.draft;
    if (
      j.supportedClaimIds.some(id => !d?.claims.some(c => c.id === id)) ||
      j.correctCitationIds.some(id => !d?.citations.some(c => c.id === id)) ||
      j.coveredFactIds.some(id => !g.facts.some(f => f.id === id))
    )
      throw new Error('INVALID_JUDGE_BINDINGS');
    if (r.status === 'draft_eligible') {
      claims += d?.claims.length ?? 0;
      supported += j.supportedClaimIds.length;
      citations += d?.citations.length ?? 0;
      correctCitations += j.correctCitationIds.length;
    }
    requiredFacts += g.facts.length;
    coveredFacts += j.coveredFactIds.length;
    const escalated = r.status !== 'draft_eligible';
    needed += Number(g.escalation);
    predicted += Number(escalated);
    truePositive += Number(g.escalation && escalated);
    correctRoute += Number(g.escalation === escalated);
    critical += Number(g.criticalUnsupported);
    const unsupportedDetected = escalated && r.reasons.some(reason => unsupportedReasons.includes(reason));
    const expectedUnsupported = g.reasons.some(reason => unsupportedReasons.includes(reason));
    unsupportedExpected += Number(expectedUnsupported);
    unsupportedPredicted += Number(unsupportedDetected);
    unsupportedTrue += Number(expectedUnsupported && unsupportedDetected);
    noncriticalExpected += Number(expectedUnsupported && !g.criticalUnsupported);
    noncriticalDetected += Number(expectedUnsupported && !g.criticalUnsupported && unsupportedDetected);
    detected += Number(g.criticalUnsupported && unsupportedDetected);
    acceptedCritical += Number(g.criticalUnsupported && !escalated);
    forbidden += Number(j.forbiddenDisclosure || (g.forbiddenDisclosure && r.status === 'draft_eligible'));
    const correct = Boolean(
      d &&
      g.values.includes(d.value) &&
      j.coveredFactIds.length === g.facts.length &&
      j.supportedClaimIds.length === d.claims.length &&
      j.correctCitationIds.length === d.citations.length &&
      !j.forbiddenDisclosure,
    );
    eligible += Number(g.usefulEligible);
    useful += Number(g.usefulEligible && correct && !escalated);
    falseEscalated += Number(g.usefulEligible && escalated);
    if (g.equivalentTo) {
      const other = results.find(o => o.questionId === g.equivalentTo)!;
      const otherJ = judgments.find(o => o.questionId === other.questionId)!;
      pairs++;
      consistent += Number(
        Boolean(
          d &&
          other.draft &&
          d.value === other.draft.value &&
          j.coveredFactIds.length === g.facts.length &&
          otherJ.coveredFactIds.length === gold.find(x => x.questionId === other.questionId)!.facts.length &&
          !r.reasons.includes('INCONSISTENT_ANSWERS'),
        ),
      );
    }
    return {
      questionId: r.questionId,
      correct,
      expectedEscalation: g.escalation,
      escalated,
      reasons: r.reasons,
      uncertainty: j.uncertainty,
      unsupportedDetected,
    };
  });
  const scores = {
    groundedness: ratio(supported, claims),
    completeness: ratio(coveredFacts, requiredFacts),
    unsupportedRecall: ratio(detected, critical),
    unsupportedPrecision: ratio(unsupportedTrue, unsupportedPredicted),
    allUnsupportedRecall: ratio(unsupportedTrue, unsupportedExpected),
    noncriticalUnsupportedRecall: ratio(noncriticalDetected, noncriticalExpected),
    escalationAccuracy: ratio(correctRoute, results.length),
    escalationRecall: ratio(truePositive, needed),
    escalationPrecision: ratio(truePositive, predicted),
    consistency: ratio(consistent, pairs),
    attribution: ratio(correctCitations, citations),
    usefulAnswerRecall: ratio(useful, eligible),
    falseEscalation: ratio(falseEscalated, eligible),
  };
  const failures = Object.entries(semanticTargets)
    .filter(([name, target]) => {
      const value = scores[name as keyof typeof scores];
      return value === null || (name === 'falseEscalation' ? value > target : value < target);
    })
    .map(([name]) => name);
  if (acceptedCritical || forbidden) failures.push('critical-safety');
  return {
    scores,
    denominators: {
      claims,
      requiredFacts,
      citations,
      neededEscalations: needed,
      predictedEscalations: predicted,
      criticalUnsupported: critical,
      usefulEligible: eligible,
      pairs,
    },
    acceptedCritical,
    forbidden,
    failures,
    cases,
  };
}
export function evaluationScorers(
  labels: GoldLabel[],
  judge: (results: QuestionResult[]) => Promise<Judgment[]>,
  onReport?: (report: ReturnType<typeof measureEvaluation>) => void,
) {
  // One independent judgment shared by all six scorers for the same actual workflow result.
  const cache = new Map<string, Promise<ReturnType<typeof measureEvaluation>>>();
  const report = (output: { results: QuestionResult[] }) => {
    const key = sha256(canonicalJson(output));
    let pending = cache.get(key);
    if (!pending) {
      pending = judge(output.results).then(j => {
        const measured = measureEvaluation(labels, output.results, j);
        onReport?.(measured);
        return measured;
      });
      cache.set(key, pending);
    }
    return pending;
  };
  return [
    'groundedness',
    'completeness',
    'unsupportedRecall',
    'escalationAccuracy',
    'consistency',
    'attribution',
    'usefulAnswerRecall',
    'falseEscalation',
  ].map(name =>
    createScorer({
      id: name,
      description: `Labeled ${name} for the controlled public questionnaire workflow.`,
    }).generateScore(async ({ run }) => {
      const measured = await report(run.output as { results: QuestionResult[] });
      const value = measured.scores[name as keyof typeof measured.scores];
      // A missing denominator must fail a required gate, never silently disappear from averages.
      return value === null ? 0 : name === 'falseEscalation' ? 1 - value : value;
    }),
  );
}
