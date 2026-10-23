import { expect, it } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { evaluationCases, datasetIdentity } from './evaluation-cases.js';
import { reportWire } from './report-provider.js';
import { runEvaluationCase } from '../scripts/evaluation-runtime.js';
import { evaluateCase, aggregateEvaluation, metricNames } from '../scripts/evaluation.js';

it('evaluation_exposes_false_assurance_and_metric_denominators', async () => {
  const root = await mkdtemp(join(tmpdir(), 'insurance-evaluation-'));
  const results: ReturnType<typeof evaluateCase>[] = [];
  const reservationEstimates: { caseId: string; inputs: number[] }[] = [];
  try {
    for (const test of evaluationCases) {
      const wire = await reportWire(test.documents, 'normal', test);
      try {
        const observation = await runEvaluationCase(test, join(root, test.id), wire.endpoint);
        results.push(evaluateCase(test, observation));
        expect(observation.state, test.id).toBe(test.failureExpected ? 'failed' : 'completed');
        if (!test.failureExpected) {
          expect(observation.pendingBeforeReview, test.id).toBe(true);
          expect(observation.explicitApprovalFinalized, test.id).toBe(true);
          expect(
            observation.reportChecks.filter(c => !c.passed),
            test.id,
          ).toEqual([]);
          for (const label of test.expected)
            expect(
              observation.comparisons.find(f => f.key === label.key)?.classification,
              test.id + ':' + label.key,
            ).toBe(label.classification);
        }
        expect(observation.unauthorizedFinal, test.id).toBe(false);
        reservationEstimates.push({
          caseId: test.id,
          inputs: wire.encodedInputUnits,
        });
        for (const request of wire.requests) expect(JSON.stringify(request)).not.toContain('data:application/pdf');
      } finally {
        await wire.close();
      }
    }
    const result = aggregateEvaluation(results);
    expect(result.scheduled).toBe(12);
    expect(Object.keys(result.metrics)).toEqual([...metricNames]);
    expect(result.failed).toBe(0);
    expect(result.metrics.field_extraction.denominator).toBe(36);
    expect(result.metrics.report_completeness.denominator).toBe(96);
    expect(result.metrics.report_completeness.numerator).toBe(96);
    expect(result.metrics.false_assurance_rate.numerator).toBe(0);
    expect(result.metrics.approval_correctness.value).toBe(1);
    const missing = evaluateCase(evaluationCases[0]!);
    const failedObservation = {
      state: 'failed' as const,
      caseState: 'FAILED',
      failure: { code: 'MODEL_UNAVAILABLE', message: 'The provider could not complete processing.' },
      comparisons: [],
      extractions: [],
      sources: [],
      reportChecks: [],
      pendingBeforeReview: false,
      explicitApprovalFinalized: false,
      unauthorizedFinal: false,
    };
    expect(evaluateCase(evaluationCases[0]!, failedObservation).measurements.discrepancy_recall).toMatchObject({
      denominator: 2,
      numerator: 0,
      failed: 1,
    });
    expect(missing.measurements.field_extraction).toMatchObject({
      numerator: 0,
      denominator: 3,
      missing: 3,
      unknown: 1,
    });
    // Mutations represent the failures the evaluator must expose, independently of a provider response.
    const base = evaluationCases[0]!;
    const wire = await reportWire(base.documents);
    try {
      const actual = await runEvaluationCase(base, join(root, 'mutation-baseline'), wire.endpoint);
      const partialAssurance = structuredClone(actual);
      partialAssurance.comparisons.find(f => f.key === 'warehouse-b')!.classification = 'MATCH';
      expect(evaluateCase(base, partialAssurance).measurements.false_assurance_rate.numerator).toBe(1);
      const renamed = structuredClone(actual);
      for (const f of renamed.comparisons) f.key = 'alternate-' + f.key;
      for (const extraction of renamed.extractions) for (const t of extraction.terms) t.key = 'alternate-' + t.key;
      expect(evaluateCase(base, renamed).measurements.field_extraction.value).toBe(1);
      expect(evaluateCase(base, renamed).measurements.discrepancy_recall.value).toBe(1);
      const wrongValue = structuredClone(actual);
      const expectedDeductible = wrongValue.extractions[1]!.terms.find(t => t.key === 'property')!;
      if (expectedDeductible.value.type === 'money') expectedDeductible.value.amount = '250000';
      expect(evaluateCase(base, wrongValue).measurements.field_extraction.numerator).toBe(2);
      const wrongIdentity = structuredClone(actual);
      const identityTerm = wrongIdentity.extractions[0]!.terms.find(t => t.key === 'building')!;
      identityTerm.scope = 'Unrelated location';
      identityTerm.category = 'date';
      expect(evaluateCase(base, wrongIdentity).measurements.field_extraction.numerator).toBe(2);
      const forged = structuredClone(actual);
      for (const extraction of forged.extractions)
        for (const t of extraction.terms)
          t.evidence.forEach(e => {
            e.hash = '0'.repeat(64);
            e.version = 'forged';
          });
      expect(evaluateCase(base, forged).measurements.source_page_attribution.value).toBe(0);
      const misaligned = structuredClone(actual);
      misaligned.comparisons.find(f => f.key === 'water')!.actual!.evidence = misaligned.comparisons.find(
        f => f.key === 'water',
      )!.baseline!.evidence;
      expect(evaluateCase(base, misaligned).measurements.clause_alignment.value).toBe(0);
      const unsafe = structuredClone(actual);
      for (const finding of unsafe.comparisons) {
        finding.classification = 'MATCH';
        finding.severity = null;
      }
      const scored = evaluateCase(base, unsafe);
      expect(scored.measurements.false_assurance_rate.value).toBe(1);
      expect(scored.measurements.discrepancy_recall.value).toBe(0);
      expect(scored.measurements.authorized_change_recognition.value).toBe(0);
      unsafe.unauthorizedFinal = true;
      unsafe.reportChecks = [];
      for (const extraction of unsafe.extractions)
        for (const term of extraction.terms) term.evidence.forEach(e => (e.physicalPage = 49));
      const corrupted = evaluateCase(base, unsafe);
      expect(corrupted.measurements.source_page_attribution.value).toBe(0);
      expect(corrupted.measurements.approval_correctness.value).toBe(0);
      expect(corrupted.measurements.report_completeness.value).toBe(0);
      const falsePositive = structuredClone(actual);
      falsePositive.comparisons.find(f => f.key === 'building')!.classification = 'DISCREPANCY';
      expect(evaluateCase(base, falsePositive).measurements.discrepancy_precision.value).toBeLessThan(1);
    } finally {
      await wire.close();
    }
    await mkdir(resolve('.runtime/evaluation'), { recursive: true });
    await writeFile(
      resolve('.runtime/evaluation/controlled.json'),
      JSON.stringify(
        { kind: 'controlled-http-safety-proof', dataset: datasetIdentity, reservationEstimates, ...result },
        null,
        2,
      ),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
