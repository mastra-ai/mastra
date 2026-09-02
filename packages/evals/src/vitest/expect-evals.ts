import type { RunEvalsConfig, RunEvalsResult } from '@mastra/core/evals';
import { runEvals } from '@mastra/core/evals';

import { toEvalMeta } from './meta';

/**
 * Options accepted by `expectEvals`: exactly the `runEvals` configuration
 * (target, data items, scorers/gates/thresholds, etc.).
 */
export type ExpectEvalsOptions = RunEvalsConfig;

/** A single eval data item, as accepted by `runEvals` in its `data` array. */
export type EvalDataItem = RunEvalsConfig['data'][number];

/**
 * Options accepted by `expectEval`: same as `expectEvals`, but `data` is a single item.
 * Distributes over the config union so each target keeps its own data-item contract
 * (e.g. `turns` stays agent-only).
 */
export type ExpectEvalOptions = RunEvalsConfig extends infer T
  ? T extends RunEvalsConfig
    ? Omit<T, 'data'> & { data: T['data'][number] }
    : never
  : never;

/** Thrown by `expectEval`/`expectEvals` `.toPass()` when the pass rate is not met. */
export class EvalPassRateError extends Error {
  readonly result: RunEvalsResult;

  constructor(message: string, result: RunEvalsResult) {
    super(message);
    this.name = 'EvalPassRateError';
    this.result = result;
  }
}

/** Fluent assertion returned by `expectEval` and `expectEvals`. */
export type EvalScoresAssertion = {
  /**
   * Runs the eval and asserts it passes.
   *
   * - Every gate's pass rate across data items must be `>= minPassRate`
   *   (gates score 1 on pass and 0 on failure, so the averaged gate score
   *   is exactly the fraction of items that passed the gate).
   * - Every scorer threshold must pass (thresholds compare the average
   *   score across items and are not relaxed by `minPassRate`).
   *
   * @param minPassRate Minimum per-gate pass rate in `[0, 1]`. Defaults to 1
   *   (all items must pass every gate).
   * @returns The full `RunEvalsResult` for further assertions.
   */
  toPass(minPassRate?: number): Promise<RunEvalsResult>;
};

async function attachMetaToCurrentTest(result: RunEvalsResult): Promise<void> {
  try {
    const vitest = await import('vitest');
    // Vitest >= 4.1
    const task = (vitest as any).TestRunner?.getCurrentTest?.();
    if (task?.meta) {
      task.meta.mastraEval = toEvalMeta(result);
      return;
    }
    // Vitest 3.x / < 4.1
    const suite = await import('vitest/suite');
    const legacyTask = (suite as any).getCurrentTest?.();
    if (legacyTask?.meta) {
      legacyTask.meta.mastraEval = toEvalMeta(result);
    }
  } catch {
    // Outside a Vitest test context — assertion still works, reporter meta is skipped.
  }
}

function assertPassRate(result: RunEvalsResult, minPassRate: number): void {
  if (!Number.isFinite(minPassRate) || minPassRate < 0 || minPassRate > 1) {
    throw new Error(`toPass(minPassRate): minPassRate must be within [0, 1], got ${minPassRate}`);
  }

  const lines: string[] = [];

  for (const gate of result.gateResults ?? []) {
    if (gate.score < minPassRate) {
      lines.push(`  ✗ gate ${gate.id}: pass rate ${formatRate(gate.score)} < required ${formatRate(minPassRate)}`);
    }
  }

  for (const t of result.thresholdResults ?? []) {
    if (!t.passed) {
      lines.push(`  ✗ threshold ${t.id}: average score ${t.averageScore} (threshold: ${JSON.stringify(t.threshold)})`);
    }
  }

  for (const turn of result.turnResults ?? []) {
    for (const gate of turn.gateResults ?? []) {
      if (gate.score < minPassRate) {
        lines.push(
          `  ✗ turn ${turn.index} gate ${gate.id}: pass rate ${formatRate(gate.score)} < required ${formatRate(minPassRate)}`,
        );
      }
    }
    for (const t of turn.thresholdResults ?? []) {
      if (!t.passed) {
        lines.push(
          `  ✗ turn ${turn.index} threshold ${t.id}: average score ${t.averageScore} (threshold: ${JSON.stringify(t.threshold)})`,
        );
      }
    }
  }

  if (lines.length > 0) {
    throw new EvalPassRateError(
      [`Eval did not pass (required pass rate: ${formatRate(minPassRate)}).`, ...lines].join('\n'),
      result,
    );
  }
}

function formatRate(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}

function makeAssertion(options: ExpectEvalsOptions): EvalScoresAssertion {
  return {
    async toPass(minPassRate = 1): Promise<RunEvalsResult> {
      const result = await runEvals(options as Parameters<typeof runEvals>[0]);
      await attachMetaToCurrentTest(result);
      assertPassRate(result, minPassRate);
      return result;
    },
  };
}

/**
 * Fluent eval assertion over a dataset, for use inside a regular `test()`.
 *
 * Runs `runEvals` with the given options when awaited and asserts the outcome.
 * The run's scores are attached to the current test's meta so
 * `MastraEvalsReporter` displays them in the runner output.
 *
 * Must be awaited — otherwise the test finishes before the eval runs.
 *
 * @example
 * test('capitals agent answers with the expected city', async () => {
 *   await expectEvals({
 *     target: capitalsAgent,
 *     data: [{ input: 'What is the capital of France?', groundTruth: 'Paris' }],
 *     gates: [containsGroundTruth],
 *     scorers: [{ scorer: createKeywordCoverageScorer(), threshold: 0.4 }],
 *   }).toPass(0.8);
 * });
 */
export function expectEvals(options: ExpectEvalsOptions): EvalScoresAssertion {
  return makeAssertion(options);
}

/**
 * Single-item variant of `expectEvals`: `data` is one item instead of an array.
 *
 * Use it with `test.each`/`it.each` for matrix testing when you want one test
 * (and one reporter entry) per data item instead of one per dataset run.
 *
 * @example
 * test.each([
 *   { input: 'What is the capital of France?', groundTruth: 'Paris' },
 *   { input: 'What is the capital of Japan?', groundTruth: 'Tokyo' },
 * ])('capitals agent: $input', async item => {
 *   await expectEval({
 *     target: capitalsAgent,
 *     data: item,
 *     gates: [containsGroundTruth],
 *   }).toPass();
 * });
 */
export function expectEval(options: ExpectEvalOptions): EvalScoresAssertion {
  return makeAssertion({ ...options, data: [options.data] } as ExpectEvalsOptions);
}
