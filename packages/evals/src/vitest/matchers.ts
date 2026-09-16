import type { EvalVerdict, RunEvalsResult } from '@mastra/core/evals';
import { expect } from 'vitest';

/**
 * Custom Vitest matchers operating on a `RunEvalsResult` (the return value of
 * `runEvals`). Registered via `registerEvalMatchers()` or by adding
 * `@mastra/evals/vitest/setup` to `setupFiles`.
 */
export interface EvalMatchers<R = unknown> {
  /** Asserts the run's verdict (`passed`, `scored`, or `failed`). */
  toHaveVerdict(verdict: EvalVerdict): R;
  /** Asserts the average score of a scorer is strictly above `min`. Supports dot-paths for categorized configs (e.g. `agent.my-scorer`). */
  toHaveScoreAbove(scorerName: string, min: number): R;
  /** Asserts the average score of a scorer is strictly below `max`. Supports dot-paths for categorized configs (e.g. `agent.my-scorer`). */
  toHaveScoreBelow(scorerName: string, max: number): R;
  /** Asserts that all gates passed (fails when no gates were configured). */
  toPassGates(): R;
  /** Asserts that all scorer thresholds passed (fails when no thresholds were configured). */
  toPassThresholds(): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends EvalMatchers<T> {}
  interface AsymmetricMatchersContaining extends EvalMatchers {}
}

function isRunEvalsResult(value: unknown): value is RunEvalsResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'scores' in value &&
    'summary' in value &&
    typeof (value as RunEvalsResult).scores === 'object' &&
    (value as RunEvalsResult).scores !== null
  );
}

function invalidReceived(matcherName: string, received: unknown) {
  return {
    pass: false,
    message: () =>
      `${matcherName} expected a RunEvalsResult (the return value of runEvals), received: ${JSON.stringify(received)}`,
  };
}

function lookupScore(scores: Record<string, any>, scorerName: string): number | undefined {
  const direct = scorerName.split('.').reduce<any>((acc, key) => (acc == null ? undefined : acc[key]), scores);
  return typeof direct === 'number' ? direct : undefined;
}

function availableScorers(scores: Record<string, any>, prefix = ''): string[] {
  const names: string[] = [];
  for (const [key, value] of Object.entries(scores)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'number') {
      names.push(path);
    } else if (value && typeof value === 'object') {
      names.push(...availableScorers(value, path));
    }
  }
  return names;
}

export const evalMatchers = {
  toHaveVerdict(received: unknown, verdict: EvalVerdict) {
    if (!isRunEvalsResult(received)) return invalidReceived('toHaveVerdict', received);
    const actual = received.verdict;
    return {
      pass: actual === verdict,
      message: () =>
        actual === verdict
          ? `expected verdict not to be "${verdict}"`
          : `expected verdict "${verdict}", got ${actual === undefined ? 'no verdict (no gates or thresholds configured)' : `"${actual}"`}`,
    };
  },

  toHaveScoreAbove(received: unknown, scorerName: string, min: number) {
    if (!isRunEvalsResult(received)) return invalidReceived('toHaveScoreAbove', received);
    const score = lookupScore(received.scores, scorerName);
    if (score === undefined) {
      return {
        pass: false,
        message: () =>
          `scorer "${scorerName}" not found in result. Available scorers: ${availableScorers(received.scores).join(', ') || '(none)'}`,
      };
    }
    return {
      pass: score > min,
      message: () =>
        score > min
          ? `expected score of "${scorerName}" (${score}) not to be above ${min}`
          : `expected score of "${scorerName}" (${score}) to be above ${min}`,
    };
  },

  toHaveScoreBelow(received: unknown, scorerName: string, max: number) {
    if (!isRunEvalsResult(received)) return invalidReceived('toHaveScoreBelow', received);
    const score = lookupScore(received.scores, scorerName);
    if (score === undefined) {
      return {
        pass: false,
        message: () =>
          `scorer "${scorerName}" not found in result. Available scorers: ${availableScorers(received.scores).join(', ') || '(none)'}`,
      };
    }
    return {
      pass: score < max,
      message: () =>
        score < max
          ? `expected score of "${scorerName}" (${score}) not to be below ${max}`
          : `expected score of "${scorerName}" (${score}) to be below ${max}`,
    };
  },

  toPassGates(received: unknown) {
    if (!isRunEvalsResult(received)) return invalidReceived('toPassGates', received);
    const gates = [
      ...(received.gateResults ?? []),
      ...(received.turnResults ?? []).flatMap(
        turn => turn.gateResults?.map(g => ({ ...g, id: `turn ${turn.index} ${g.id}` })) ?? [],
      ),
    ];
    if (gates.length === 0) {
      return {
        pass: false,
        message: () => `no gates were configured on this eval run`,
      };
    }
    const failed = gates.filter(g => !g.passed);
    return {
      pass: failed.length === 0,
      message: () =>
        failed.length === 0
          ? `expected at least one gate to fail, but all ${gates.length} passed`
          : `expected all gates to pass, but ${failed.length} failed:\n${failed.map(g => `  ✗ ${g.id} (score: ${g.score})`).join('\n')}`,
    };
  },

  toPassThresholds(received: unknown) {
    if (!isRunEvalsResult(received)) return invalidReceived('toPassThresholds', received);
    const thresholds = [
      ...(received.thresholdResults ?? []),
      ...(received.turnResults ?? []).flatMap(
        turn => turn.thresholdResults?.map(t => ({ ...t, id: `turn ${turn.index} ${t.id}` })) ?? [],
      ),
    ];
    if (thresholds.length === 0) {
      return {
        pass: false,
        message: () => `no scorer thresholds were configured on this eval run`,
      };
    }
    const failed = thresholds.filter(t => !t.passed);
    return {
      pass: failed.length === 0,
      message: () =>
        failed.length === 0
          ? `expected at least one threshold to fail, but all ${thresholds.length} passed`
          : `expected all thresholds to pass, but ${failed.length} failed:\n${failed
              .map(t => `  ✗ ${t.id} (average score: ${t.averageScore}, threshold: ${JSON.stringify(t.threshold)})`)
              .join('\n')}`,
    };
  },
};

/** Registers the Mastra eval matchers on Vitest's `expect`. */
export function registerEvalMatchers() {
  expect.extend(evalMatchers);
}
