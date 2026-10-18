import { it, expect } from 'vitest';
import { expectEvals } from '@mastra/evals/vitest';
import { runEvals } from '@mastra/core/evals';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { controlledEvaluation } from '../support/evaluation-fixture.ts';
import { evaluationScorers, measureEvaluation, validateCorpus, semanticTargets } from '../support/evaluation.ts';
import { demoGoldLabels, goldLabelSchema } from '../fixtures/evaluation-labels.ts';
import { demoQuestions } from '../fixtures/corpus.ts';
import { temporaryDirectory, cleanupDirectory } from '../fixtures/support.ts';
import { openProcessingStore } from '../../src/mastra/persistence/processing.ts';

it('measures_all_six_semantic_dimensions_and_useful_answer_recall', async () => {
  const root = await temporaryDirectory();
  try {
    expect(
      validateCorpus(
        demoGoldLabels,
        demoQuestions.map((_, i) => `VRQ-${String(i + 1).padStart(3, '0')}`),
      ),
    ).toHaveLength(24);
    expect(() =>
      validateCorpus(
        demoGoldLabels.slice(1),
        demoGoldLabels.map(g => g.questionId),
      ),
    ).toThrow();
    expect(goldLabelSchema.safeParse({ ...demoGoldLabels[0], facts: [] }).success).toBe(false);
    for (const mode of ['correct', 'unknown', 'wrong'] as const) {
      const dir = resolve(root, mode);
      await mkdir(dir);
      const f = await controlledEvaluation(dir, mode);
      const scorers = evaluationScorers(f.labels, f.judge).map(scorer => ({
        scorer,
        threshold: scorer.id === 'falseEscalation' ? 0.9 : semanticTargets[scorer.id as keyof typeof semanticTargets],
      }));
      const config = { target: f.target, data: [{ input: f.input }], scorers, concurrency: 1 };
      const outcome = mode === 'correct' ? await expectEvals(config).toPass() : await runEvals(config);
      expect(outcome.summary.totalItems).toBe(1);
      // Mastra labels a completed run with failing scorer thresholds as `scored`;
      // `failed` is reserved for failing gate scorers. Assert the actual thresholds too.
      expect(outcome).toHaveVerdict(mode === 'correct' ? 'passed' : 'scored');
      expect(outcome.thresholdResults).toHaveLength(8);
      if (mode === 'correct') expect(outcome).toPassThresholds();
      else {
        expect(outcome).not.toPassThresholds();
        const failed = outcome.thresholdResults!.filter(t => !t.passed).map(t => t.id);
        expect(failed).toContain(mode === 'unknown' ? 'usefulAnswerRecall' : 'groundedness');
        if (mode === 'unknown') expect(failed).toContain('falseEscalation');
      }
      const store = await openProcessingStore(f.url);
      const status = (await store.status(f.runId))!;
      store.close();
      const report = measureEvaluation(f.labels, status.results, await f.judge(status.results));
      expect(report.cases).toHaveLength(9);
      if (mode === 'correct') {
        expect(report.failures).toEqual([]);
        expect(report.scores.usefulAnswerRecall).toBe(1);
        expect(report.scores.unsupportedRecall).toBe(1);
      }
      if (mode === 'unknown') {
        expect(report.scores.groundedness).toBeNull();
        expect(report.scores.usefulAnswerRecall).toBe(0);
        expect(report.scores.falseEscalation).toBe(1);
        expect(report.failures).toContain('usefulAnswerRecall');
      }
      if (mode === 'wrong') {
        expect(report.scores.groundedness).toBeLessThan(0.9);
        expect(report.failures).toContain('groundedness');
      }
      expect(() => measureEvaluation(f.labels, status.results, [])).toThrow('INCOMPLETE_EVALUATION_JUDGMENTS');
      expect(f.provider.calls.some(c => JSON.stringify(c.call.prompt).includes('usefulEligible'))).toBe(false);
    }
  } finally {
    await cleanupDirectory(root);
  }
}, 120000);
