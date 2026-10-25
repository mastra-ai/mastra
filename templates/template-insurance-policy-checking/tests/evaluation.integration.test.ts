import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, it } from 'vitest';
import { aggregateEvaluation, evaluateCase, metricNames } from '../scripts/evaluation-runner.js';
import { runEvaluationCase } from '../scripts/evaluation-runtime.js';
import { datasetIdentity, evaluationCases } from './evaluation-fixtures.js';
import { reportWire } from './report-provider.js';
import { reportContext, reportRuntime } from './report-runtime.js';

it('failed_evaluation_retains_safe_workflow_failure_and_saved_partial_extraction', async () => {
  const root = await mkdtemp(join(tmpdir(), 'insurance-evaluation-failure-'));
  const test = evaluationCases[1]!;
  const wire = await reportWire(test.documents, 'invalid-structured-target');
  try {
    const actual = await runEvaluationCase(test, root, wire.endpoint);
    expect(actual.state).toBe('failed');
    expect(actual.caseState).toBe('FAILED');
    expect(actual.failure).toMatchObject({ code: 'MODEL_INVALID_OUTPUT', nextAction: expect.any(String) });
    const reopened = await reportRuntime(root, wire.endpoint);
    try {
      const status = await reopened.reconciliationRepository.status(reportContext);
      expect(status.attempts).toHaveLength(1);
      expect(status.analyses).toEqual([]);
      expect(actual.failure).toEqual(status.attempts[0]!.failure);
      const saved = await reopened.cases.client.execute('SELECT data FROM insurance_extractions');
      expect(saved.rows).toHaveLength(1);
      expect(actual.extractions).toEqual(saved.rows.map(row => JSON.parse(String(row.data))));
      expect(actual.extractions[0]!.sourceId).toBe(actual.sources[0]!.sourceId);
      expect(actual.extractions[0]!.terms.length).toBeGreaterThan(0);
    } finally {
      await reopened.close();
    }
    expect(wire.requests).toHaveLength(2);
    const result = aggregateEvaluation(
      evaluationCases.map(c => evaluateCase(c, c.id === test.id ? actual : undefined)),
    );
    expect(result).toMatchObject({ scheduled: 12, completed: 0, failed: 1, unknown: 11 });
    expect(result.metrics.field_extraction).toMatchObject({ denominator: 36, failed: 1, unknown: 11 });
    expect(evaluateCase(test, actual).measurements.field_extraction.numerator).toBeGreaterThan(0);
    expect(result.metrics.report_completeness).toMatchObject({ numerator: 0, denominator: 96 });
    const property = evaluationCases[0]!;
    const grounding = await reportWire(property.documents, 'invalid-grounding-parallel');
    try {
      const failed = await runEvaluationCase(property, join(root, 'grounding'), grounding.endpoint);
      expect(failed).toMatchObject({
        state: 'failed',
        caseState: 'FAILED',
        failure: { code: 'INVALID_COMPARISON_EVIDENCE' },
      });
      expect(failed.failure!.nextAction).toContain('excerpt_not_exact');
      expect(failed.failure!.nextAction).toContain('terms.0.evidence.0.excerpt');
      expect(failed.failure!.nextAction).toContain(failed.sources[0]!.sourceId);
      expect(failed.extractions).toEqual([]);
      expect(grounding.requests).toHaveLength(1);
      const saved = await reportRuntime(join(root, 'grounding'), grounding.endpoint);
      try {
        const status = await saved.reconciliationRepository.status(reportContext);
        expect(status.attempts[0]!.failure).toEqual(failed.failure);
        expect(status.analyses).toEqual([]);
        expect(await saved.reconciliationRepository.extractions(reportContext, status.attempts[0]!.id)).toEqual(
          failed.extractions,
        );
      } finally {
        await saved.close();
      }
      expect(JSON.stringify(failed.failure)).not.toContain('SENTINEL_PRIVATE');
    } finally {
      await grounding.close();
    }
  } finally {
    await wire.close();
    await rm(root, { recursive: true, force: true });
  }
});

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
