import type { EvalTurn, MastraScorer, RunEvalsResult, ScorerEntry } from '@mastra/core/evals';
import { runEvals } from '@mastra/core/evals';
import { test } from 'vitest';

import type { MastraEvalMeta } from './meta';
import { toEvalMeta } from './meta';

type AnyScorer = MastraScorer<any, any, any, any>;

/**
 * Options accepted by `evalTest`. Mirrors the `runEvals` configuration:
 * target (Agent or Workflow), data items, scorers/gates/thresholds, etc.
 *
 * For the strictest typing (per-target overloads), call `runEvals` directly
 * inside a regular `test()` and use the custom matchers instead.
 */
export type EvalTestOptions = {
  target: any;
  data: Array<
    {
      input?: any;
      inputs?: any[];
      turns?: EvalTurn[];
      groundTruth?: any;
      expectedTrajectory?: any;
    } & Record<string, any>
  >;
  scorers?: ScorerEntry[] | AnyScorer[] | Record<string, any>;
  /** Gates: scorers that must score 1.0 for the run to pass. */
  gates?: AnyScorer[];
  targetOptions?: Record<string, any>;
  onItemComplete?: (params: { item: any; targetResult: any; scorerResults: any }) => void | Promise<void>;
  concurrency?: number;
};

export type EvalTestConfig = {
  /**
   * Test timeout in milliseconds. Defaults to 60s: LLM-backed evals are far
   * slower than Vitest's default 5s timeout.
   */
  timeout?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;

/** Thrown by `evalTest` when the eval run's verdict is `failed`. */
export class EvalFailedError extends Error {
  readonly result: RunEvalsResult;

  constructor(result: RunEvalsResult) {
    super(formatFailure(result));
    this.name = 'EvalFailedError';
    this.result = result;
  }
}

function formatFailure(result: RunEvalsResult): string {
  const lines: string[] = [`Eval run failed (verdict: ${result.verdict}).`];

  const failedGates = (result.gateResults ?? []).filter(g => !g.passed);
  if (failedGates.length > 0) {
    lines.push('Failed gates:');
    for (const gate of failedGates) {
      lines.push(`  ✗ ${gate.id} (score: ${gate.score})`);
    }
  }

  const failedThresholds = (result.thresholdResults ?? []).filter(t => !t.passed);
  if (failedThresholds.length > 0) {
    lines.push('Failed thresholds:');
    for (const t of failedThresholds) {
      lines.push(`  ✗ ${t.id} (average score: ${t.averageScore}, threshold: ${JSON.stringify(t.threshold)})`);
    }
  }

  for (const turn of result.turnResults ?? []) {
    const turnFailedGates = (turn.gateResults ?? []).filter(g => !g.passed);
    const turnFailedThresholds = (turn.thresholdResults ?? []).filter(t => !t.passed);
    if (turnFailedGates.length === 0 && turnFailedThresholds.length === 0) continue;
    lines.push(`Turn ${turn.index}:`);
    for (const gate of turnFailedGates) {
      lines.push(`  ✗ gate ${gate.id} (score: ${gate.score})`);
    }
    for (const t of turnFailedThresholds) {
      lines.push(`  ✗ threshold ${t.id} (average score: ${t.averageScore}, threshold: ${JSON.stringify(t.threshold)})`);
    }
  }

  return lines.join('\n');
}

/**
 * Runs `runEvals`, returns its result and the serializable meta projection,
 * and throws `EvalFailedError` when the verdict is `failed`.
 *
 * This is the runner-agnostic core of `evalTest`, exported for direct use.
 */
export async function runEvalCase(options: EvalTestOptions): Promise<{ result: RunEvalsResult; meta: MastraEvalMeta }> {
  const result = await runEvals(options as Parameters<typeof runEvals>[0]);
  const meta = toEvalMeta(result);
  if (result.verdict === 'failed') {
    throw new EvalFailedError(result);
  }
  return { result, meta };
}

function defineEvalTest(testFn: typeof test | typeof test.skip | typeof test.only) {
  return (name: string, options: EvalTestOptions, config?: EvalTestConfig) => {
    testFn(name, { timeout: config?.timeout ?? DEFAULT_TIMEOUT_MS }, async ({ task }) => {
      let caught: unknown;
      let meta: MastraEvalMeta | undefined;
      try {
        ({ meta } = await runEvalCase(options));
      } catch (error) {
        caught = error;
        if (error instanceof EvalFailedError) {
          meta = toEvalMeta(error.result);
        }
      }
      if (meta) {
        task.meta.mastraEval = meta;
      }
      if (caught) {
        throw caught;
      }
    });
  };
}

/**
 * Declares a Vitest test that runs a `runEvals` evaluation.
 *
 * The test fails when the eval verdict is `failed` (a gate or threshold did
 * not pass), and the run's scores are attached to `task.meta.mastraEval` so
 * `MastraEvalsReporter` can display them in the runner output.
 *
 * @example
 * evalTest('support agent quality', {
 *   target: supportAgent,
 *   data: [{ input: 'How do I reset my password?' }],
 *   scorers: [relevancyScorer],
 *   gates: [noRefusalScorer],
 * });
 */
export const evalTest = Object.assign(defineEvalTest(test), {
  skip: defineEvalTest(test.skip),
  only: defineEvalTest(test.only),
});
