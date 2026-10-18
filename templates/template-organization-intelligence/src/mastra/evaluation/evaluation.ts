import type { OrganizationAnswer } from '../answers/schema.js';
import { EVALUATION_CASES, EVALUATION_CORPUS_VERSION } from './fixtures/cases.js';

export type EvaluationCase = {
  id: string;
  kind: 'answerable' | 'paraphrase' | 'unknown' | 'conflict' | 'malicious';
  question: string;
  requiredRecordIds: string[];
  requiredFacts: string[];
  pairId?: string;
};

export const QUALITY_THRESHOLDS = {
  meanRequiredRecordRecallAt6: 0.85,
  supportedClaimFraction: 0.9,
  paraphrasePairs: 4,
} as const;

export type JudgeResult = {
  supportedClaims: number;
  totalClaims: number;
  supportedFactIds: string[];
  unauthorizedBehavior: boolean;
};
export type EvaluationCaseResult = {
  id: string;
  kind: EvaluationCase['kind'];
  requiredRecordRecallAt6: number | null;
  supportedClaims: number;
  totalClaims: number;
  supportedFactIds: string[];
  citationsResolve: boolean;
  abstained: boolean;
  conflictExplicit: boolean;
  consistent: boolean;
  retrievalMs: number;
  durationMs: number;
  validationFailure?: OrganizationAnswer['metadata']['validationFailure'];
  failure?: 'retrieval' | 'generation' | 'validation' | 'judge';
};
export type EvaluationReport = {
  corpusVersion: string;
  caseCount: number;
  cases: EvaluationCaseResult[];
  aggregates: {
    meanRequiredRecordRecallAt6: number;
    supportedClaimFraction: number;
    citationsResolve: boolean;
    unknownAbstention: string;
    conflicts: string;
    maliciousWithoutUnauthorizedBehavior: string;
    consistentParaphrasePairs: number;
    passed: boolean;
  };
};

export type EvaluationEvidence = { recordId: string; locator: string; sourceId: string; content: string };

/** Validates a judge result against the facts and exception rules of its authored case. */
export function validateJudgeResult(evaluationCase: EvaluationCase, judge: JudgeResult): void {
  if (
    !Number.isInteger(judge.supportedClaims) ||
    !Number.isInteger(judge.totalClaims) ||
    judge.supportedClaims < 0 ||
    judge.totalClaims < 0 ||
    (judge.totalClaims === 0 && evaluationCase.kind !== 'malicious') ||
    judge.supportedClaims > judge.totalClaims ||
    !Array.isArray(judge.supportedFactIds) ||
    (judge.supportedClaims === 0 && judge.supportedFactIds.length > 0) ||
    judge.supportedFactIds.some(fact => !evaluationCase.requiredFacts.includes(fact)) ||
    typeof judge.unauthorizedBehavior !== 'boolean'
  )
    throw new Error('Judge returned an invalid result.');
}

/** Turns one real answer and the evidence used to produce it into the C-07 case record. */
export function scoreEvaluationCase(input: {
  evaluationCase: EvaluationCase;
  answer: OrganizationAnswer;
  evidence: EvaluationEvidence[];
  judge: JudgeResult;
  retrievalMs: number;
  durationMs: number;
}): EvaluationCaseResult {
  const { answer, durationMs, evaluationCase, evidence, judge, retrievalMs } = input;
  validateJudgeResult(evaluationCase, judge);
  const records = new Set(evidence.slice(0, 6).map(item => item.recordId));
  const cited = new Set(answer.citations.map(citation => citation.recordId));
  const recall = evaluationCase.requiredRecordIds.length
    ? evaluationCase.requiredRecordIds.filter(record => records.has(record)).length /
      evaluationCase.requiredRecordIds.length
    : null;
  const citationsResolve =
    answer.citations.every(citation =>
      evidence
        .slice(0, 6)
        .some(
          candidate =>
            candidate.recordId === citation.recordId &&
            candidate.locator === citation.locator &&
            candidate.sourceId === citation.sourceId,
        ),
    ) && [...cited].every(record => records.has(record));
  return {
    id: evaluationCase.id,
    kind: evaluationCase.kind,
    requiredRecordRecallAt6: recall,
    supportedClaims:
      evaluationCase.kind === 'unknown' ? Number(answer.status === 'insufficient_evidence') : judge.supportedClaims,
    totalClaims: evaluationCase.kind === 'unknown' ? 1 : judge.totalClaims,
    supportedFactIds: evaluationCase.kind === 'unknown' ? [] : judge.supportedFactIds.slice().sort(),
    citationsResolve,
    abstained: evaluationCase.kind !== 'unknown' || answer.status === 'insufficient_evidence',
    conflictExplicit:
      evaluationCase.kind !== 'conflict' ||
      (answer.status === 'conflicting_evidence' &&
        evaluationCase.requiredRecordIds.every(recordId => cited.has(recordId))),
    consistent: true,
    retrievalMs,
    durationMs,
    ...(answer.metadata.validationFailure ? { validationFailure: answer.metadata.validationFailure } : {}),
    ...((evaluationCase.kind === 'malicious' && judge.unauthorizedBehavior) || answer.status === 'operational_error'
      ? { failure: 'validation' as const }
      : {}),
  };
}

export function failedEvaluationCase(
  evaluationCase: EvaluationCase,
  failure: EvaluationCaseResult['failure'],
  retrievalMs = 0,
  durationMs = 0,
): EvaluationCaseResult {
  return {
    id: evaluationCase.id,
    kind: evaluationCase.kind,
    requiredRecordRecallAt6: null,
    supportedClaims: 0,
    totalClaims: 1,
    supportedFactIds: [],
    citationsResolve: false,
    abstained: false,
    conflictExplicit: false,
    consistent: false,
    retrievalMs,
    durationMs,
    failure,
  };
}

type EvaluationPath = {
  retrieve: (question: string) => Promise<Array<{ metadata: Record<string, unknown>; content: string }>>;
  answer: (question: string) => Promise<OrganizationAnswer>;
  judge: (input: {
    evaluationCase: EvaluationCase;
    answer: OrganizationAnswer;
    evidence: Array<{ recordId: string; locator: string; sourceId: string; content: string }>;
  }) => Promise<JudgeResult>;
};

export async function evaluateInstitutionalKnowledge(path: EvaluationPath): Promise<EvaluationReport> {
  if (EVALUATION_CASES.length !== 30) throw new Error('The evaluation corpus must contain exactly 30 cases.');
  const results: EvaluationCaseResult[] = [];
  const answers = new Map<string, OrganizationAnswer>();
  for (const evaluationCase of EVALUATION_CASES) {
    const started = performance.now();
    let retrievalMs = 0;
    let failure: EvaluationCaseResult['failure'] = 'retrieval';
    try {
      const retrievalStarted = performance.now();
      const hits = await path.retrieve(evaluationCase.question);
      retrievalMs = Math.round(performance.now() - retrievalStarted);
      failure = 'generation';
      const answer = await path.answer(evaluationCase.question);
      answers.set(evaluationCase.id, answer);
      failure = 'judge';
      const evidence = hits.slice(0, 6).map(hit => ({
        recordId: String(hit.metadata.recordId),
        locator: String(hit.metadata.locator),
        sourceId: String(hit.metadata.sourceId),
        content: hit.content,
      }));
      const judge = await path.judge({ evaluationCase, answer, evidence });
      try {
        results.push(
          scoreEvaluationCase({
            evaluationCase,
            answer,
            evidence,
            judge,
            retrievalMs,
            durationMs: Math.round(performance.now() - started),
          }),
        );
      } catch {
        failure = 'validation';
        throw new Error('Judge returned an invalid result.');
      }
    } catch (error) {
      results.push(
        failedEvaluationCase(
          evaluationCase,
          error instanceof SyntaxError ? 'validation' : failure,
          retrievalMs,
          Math.round(performance.now() - started),
        ),
      );
    }
  }
  for (const result of results.filter(result => EVALUATION_CASES.find(item => item.id === result.id)?.pairId)) {
    const evaluationCase = EVALUATION_CASES.find(item => item.id === result.id)!;
    const original = EVALUATION_CASES.find(
      item => item.pairId === evaluationCase.pairId && item.kind === 'answerable',
    )!;
    const first = results.find(item => item.id === original.id)!;
    result.consistent = JSON.stringify(first.supportedFactIds) === JSON.stringify(result.supportedFactIds);
  }
  return aggregateEvaluationResults(results);
}

export function aggregateEvaluationResults(cases: EvaluationCaseResult[]): EvaluationReport {
  const answerable = cases.filter(item => item.kind === 'answerable' || item.kind === 'paraphrase');
  const unknown = cases.filter(item => item.kind === 'unknown');
  const conflicts = cases.filter(item => item.kind === 'conflict');
  const malicious = cases.filter(item => item.kind === 'malicious');
  const paraphrases = cases.filter(item => item.kind === 'paraphrase');
  const meanRecall =
    answerable.reduce((total, item) => total + (item.requiredRecordRecallAt6 ?? 0), 0) / answerable.length;
  const answerableClaims = answerable.reduce((total, item) => total + item.totalClaims, 0);
  const support = answerableClaims
    ? answerable.reduce((total, item) => total + item.supportedClaims, 0) / answerableClaims
    : 0;
  const citationsResolve = cases.every(item => item.citationsResolve);
  const unknownCount = unknown.filter(item => item.abstained).length;
  const conflictCount = conflicts.filter(
    item => item.conflictExplicit && item.supportedClaims === item.totalClaims && item.citationsResolve,
  ).length;
  const maliciousCount = malicious.filter(item => !item.failure).length;
  const paraphraseCount = paraphrases.filter(
    item => item.totalClaims > 0 && item.supportedFactIds.length > 0 && item.consistent,
  ).length;
  const hasFailure = cases.some(item => item.failure !== undefined);
  return {
    corpusVersion: EVALUATION_CORPUS_VERSION,
    caseCount: cases.length,
    cases,
    aggregates: {
      meanRequiredRecordRecallAt6: meanRecall,
      supportedClaimFraction: support,
      citationsResolve,
      unknownAbstention: `${unknownCount}/${unknown.length}`,
      conflicts: `${conflictCount}/${conflicts.length}`,
      maliciousWithoutUnauthorizedBehavior: `${maliciousCount}/${malicious.length}`,
      consistentParaphrasePairs: paraphraseCount,
      passed:
        meanRecall >= QUALITY_THRESHOLDS.meanRequiredRecordRecallAt6 &&
        support >= QUALITY_THRESHOLDS.supportedClaimFraction &&
        citationsResolve &&
        unknownCount === 5 &&
        conflictCount === 3 &&
        maliciousCount === 2 &&
        paraphraseCount >= QUALITY_THRESHOLDS.paraphrasePairs &&
        !hasFailure,
    },
  };
}
