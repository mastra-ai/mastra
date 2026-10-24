import type { SavedSource } from '../src/mastra/domain/case-contracts.js';
import { canonicalJson } from '../src/mastra/domain/case-contracts.js';
import type { Comparison, Extraction, Term, TermValue } from '../src/mastra/domain/reconciliation-contracts.js';

import type { EvaluationCase, ExpectedFinding } from '../tests/evaluation-fixtures.js';

export const metricNames = [
  'field_extraction',
  'source_page_attribution',
  'clause_alignment',
  'discrepancy_precision',
  'discrepancy_recall',
  'authorized_change_recognition',
  'missing_evidence_detection',
  'false_assurance_rate',
  'severity_consistency',
  'report_completeness',
  'approval_correctness',
] as const;
export type MetricName = (typeof metricNames)[number];
export type EvaluationObservation = {
  /** Persisted lifecycle state of this entity. */
  state: 'completed' | 'failed' | 'unknown';

  /** Persisted case state observed after the evaluation journey. */
  caseState: string | null;

  /** Safe recorded failure; null or absent when no failure is recorded. */
  failure: {
    /** Stable machine-readable failure or validation code. */
    code: string;

    /** Safe user-facing explanation without private provider errors. */
    message: string;

    /** Suggested recovery step for the caller. */
    nextAction?: string;
  } | null;

  /** Evidence-backed findings for the selected reference and target. */
  comparisons: Comparison[];

  /** Verified structured extractions retained for each captured source. */
  extractions: Extraction[];

  /** Immutable sources captured for this case. */
  sources: SavedSource[];

  /** Independent report obligations and whether each was satisfied. */
  reportChecks: {
    /** Named report requirement checked by the evaluator. */
    obligation: string;

    /** Whether the independently checked obligation was satisfied. */
    passed: boolean;
  }[];

  /** Whether the draft awaited explicit broker review before approval. */
  pendingBeforeReview: boolean;

  /** Whether explicit version-bound approval produced the final report. */
  explicitApprovalFinalized: boolean;

  /** Whether any final output appeared without the required explicit approval. */
  unauthorizedFinal: boolean;
};
export type Measurement = {
  /** Number of labeled outcomes satisfying this metric. */
  numerator: number;

  /** Number of eligible labeled outcomes for this metric. */
  denominator: number;

  /** Measured ratio; null when the denominator is zero. */
  value: number | null;

  /** Eligible outcomes missing from the observed result. */
  missing: number;

  /** Scheduled cases that failed before producing a usable result. */
  failed: number;

  /** Scheduled cases without enough evidence to measure this metric. */
  unknown: number;
};
const normalizeIdentity = (value: string) => value.toLowerCase().replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim();
const categoryAliases: Record<string, string[]> = {
  entity: ['entity', 'identity', 'named insured'],
  date: ['date', 'dates', 'policy dates'],
  location: ['location', 'locations', 'premises'],
  limit: ['limit', 'limits', 'coverage limit'],
  deductible: ['deductible', 'deductibles'],
  clause: ['clause', 'clauses', 'coverage clause'],
  'response-assistance': ['response assistance', 'extension', 'extensions'],
};
const scopeAliases: Record<string, string[]> = {
  Policy: ['policy', 'policy wide'],
  Premises: ['premises', 'insured premises'],
  'All premises': ['all premises', 'all insured premises', 'all locations'],
};
const semanticIdentity = (actual: Pick<Term, 'category' | 'scope'>, expected: Pick<Term, 'category' | 'scope'>) =>
  (categoryAliases[expected.category] ?? [normalizeIdentity(expected.category)]).includes(
    normalizeIdentity(actual.category),
  ) && (scopeAliases[expected.scope] ?? [normalizeIdentity(expected.scope)]).includes(normalizeIdentity(actual.scope));
function normalizedValue(value: TermValue | null) {
  if (!value) return null;
  const decimal = (amount: string) => (amount.includes('.') ? amount.replace(/0+$/, '').replace(/\.$/, '') : amount);
  if (value.type === 'money' || value.type === 'number')
    return {
      ...value,
      amount: decimal(value.amount),
      unit: value.unit === 'per occurrence' ? 'each occurrence' : value.unit,
    };
  return value;
}
export function evaluateCase(test: EvaluationCase, actual?: EvaluationObservation) {
  const state = actual?.state ?? 'unknown';
  const actualFindings = actual?.comparisons ?? [];
  const finding = (label: ExpectedFinding) => {
    const candidates = actualFindings.filter(
      f =>
        semanticIdentity(f, label) &&
        f.baseline?.evidence.some(
          e =>
            e.sourceId === actual?.sources[0]?.sourceId &&
            e.physicalPage === label.page &&
            e.excerpt.includes(label.anchor),
        ),
    );
    return candidates.length === 1 ? candidates[0] : undefined;
  };
  const term = (label: EvaluationCase['requiredFields'][number]) => {
    const candidates = actual?.extractions
      .find(e => e.sourceId === actual.sources[label.document]?.sourceId)
      ?.terms.filter(
        t =>
          semanticIdentity(t, label) &&
          t.evidence.some(
            e =>
              e.sourceId === actual.sources[label.document]?.sourceId &&
              e.physicalPage === label.page &&
              e.excerpt.includes(label.excerpt),
          ),
      );
    return candidates?.length === 1 ? candidates[0] : undefined;
  };
  const measurements = {} as Record<MetricName, Measurement>;
  function measure(name: MetricName, hits: number, total: number, missing = state === 'completed' ? 0 : total) {
    measurements[name] = {
      numerator: hits,
      denominator: total,
      value: total ? hits / total : null,
      missing,
      failed: state === 'failed' ? 1 : 0,
      unknown: state === 'unknown' ? 1 : 0,
    };
  }
  const expectedDiscrepancies = test.expected.filter(f => f.classification === 'DISCREPANCY');
  const predictedDiscrepancies = actualFindings.filter(f => f.classification === 'DISCREPANCY');
  const correct = expectedDiscrepancies.filter(f => finding(f)?.classification === 'DISCREPANCY').length;
  measure(
    'field_extraction',
    test.requiredFields.filter(
      f => canonicalJson(normalizedValue(term(f)?.value ?? null)) === canonicalJson(normalizedValue(f.value)),
    ).length,
    test.requiredFields.length,
    test.requiredFields.filter(f => !term(f)).length,
  );
  measure(
    'source_page_attribution',
    test.requiredFields.filter(f => {
      const source = actual?.sources[f.document];
      return (
        source?.kind === 'pdf' &&
        term(f)?.evidence.some(
          e =>
            e.sourceId === source.sourceId &&
            e.version === source.version &&
            e.hash === source.hash &&
            e.physicalPage === f.page &&
            e.excerpt.includes(f.excerpt) &&
            source.pages.find(p => p.physicalPage === f.page)?.text.includes(e.excerpt),
        )
      );
    }).length,
    test.requiredFields.length,
  );
  const clauses = test.expected.filter(f => f.category === 'clause');
  measure(
    'clause_alignment',
    clauses.filter(f => {
      const pair = finding(f);
      return (
        pair?.baseline?.value.type === 'clause' &&
        pair.actual?.value.type === 'clause' &&
        pair.baseline.value.clauseId === (f.key === 'water' ? 'CP-W1' : 'PI-C1') &&
        pair.actual.value.clauseId === pair.baseline.value.clauseId &&
        [0, 1].every(i => {
          const source = actual?.sources[i];
          const side = i === 0 ? pair.baseline : pair.actual;
          return (
            source?.kind === 'pdf' &&
            side?.evidence.some(
              e =>
                e.sourceId === source.sourceId &&
                e.version === source.version &&
                e.hash === source.hash &&
                e.physicalPage === 3 &&
                source.pages[2]?.text.includes(e.excerpt),
            )
          );
        })
      );
    }).length,
    clauses.length,
  );
  measure(
    'discrepancy_precision',
    correct,
    predictedDiscrepancies.length || (state !== 'completed' ? expectedDiscrepancies.length : 0),
  );
  measure('discrepancy_recall', correct, expectedDiscrepancies.length);
  const authorized = test.expected.filter(f => f.category === 'deductible');
  measure(
    'authorized_change_recognition',
    authorized.filter(f => finding(f)?.classification === f.classification).length,
    authorized.length,
  );
  const missing = test.expected.filter(f => ['MISSING_EVIDENCE', 'REQUIRES_REVIEW'].includes(f.classification));
  measure(
    'missing_evidence_detection',
    missing.filter(f => finding(f)?.classification === f.classification).length,
    missing.length,
  );
  const unsafeObligations = test.expected.filter(f => f.classification !== 'MATCH');
  const falseAssurances = unsafeObligations.filter(f => finding(f)?.classification === 'MATCH').length;
  measure('false_assurance_rate', falseAssurances, unsafeObligations.length);
  const severity = test.expected.filter(f => f.severity);
  measure(
    'severity_consistency',
    severity.filter(f => finding(f)?.severity?.level === f.severity && finding(f)?.classification === f.classification)
      .length,
    severity.length,
  );
  const reportObligations = [
    'draft_available',
    'final_available',
    'snapshot_binding',
    'approval_binding',
    'source_manifest',
    'limitations_preserved',
    'rendered_sections',
    'rendered_findings',
  ];
  measure(
    'report_completeness',
    reportObligations.filter(o => actual?.reportChecks.some(c => c.obligation === o && c.passed)).length,
    reportObligations.length,
  );
  measure(
    'approval_correctness',
    actual &&
      !actual.unauthorizedFinal &&
      (test.failureExpected
        ? actual.state === 'failed'
        : actual.pendingBeforeReview && actual.explicitApprovalFinalized)
      ? 1
      : 0,
    1,
  );
  return {
    caseId: test.id,
    group: test.group,
    state,
    caseState: actual?.caseState ?? null,
    failure: actual?.failure ?? null,
    expectedFailure: test.failureExpected,
    counts: {
      falsePositives: predictedDiscrepancies.length - correct,
      falseNegatives: expectedDiscrepancies.length - correct,
      falseAuthorizations: actualFindings.filter(
        f =>
          f.classification === 'AUTHORIZED_CHANGE' &&
          !test.expected.some(e => finding(e) === f && e.classification === 'AUTHORIZED_CHANGE'),
      ).length,
      falseAssurances,
      unauthorizedFinalizations: actual?.unauthorizedFinal ? 1 : 0,
    },
    measurements,
  };
}
export function aggregateEvaluation(results: ReturnType<typeof evaluateCase>[]) {
  const metrics = Object.fromEntries(
    metricNames.map(name => {
      const totals = results.reduce(
        (sum, result) => {
          const m = result.measurements[name];
          return {
            numerator: sum.numerator + m.numerator,
            denominator: sum.denominator + m.denominator,
            missing: sum.missing + m.missing,
            failed: sum.failed + m.failed,
            unknown: sum.unknown + m.unknown,
          };
        },
        { numerator: 0, denominator: 0, missing: 0, failed: 0, unknown: 0 },
      );
      return [name, { ...totals, value: totals.denominator ? totals.numerator / totals.denominator : null }];
    }),
  ) as Record<MetricName, Measurement>;
  return {
    metrics,
    scheduled: results.length,
    completed: results.filter(r => r.state === 'completed').length,
    failed: results.filter(r => r.state === 'failed').length,
    unknown: results.filter(r => r.state === 'unknown').length,
    cases: results,
  };
}
