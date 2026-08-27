import { describe, expect, it } from 'vitest';

import { erroredJudgeResult, judgeFailureReason } from './judge-failure';

function result(overrides: Partial<ReturnType<typeof erroredJudgeResult>> = {}) {
  return {
    complete: false,
    completionReason: undefined,
    scorers: [],
    totalDuration: 0,
    timedOut: false,
    ...overrides,
  } as ReturnType<typeof erroredJudgeResult>;
}

describe('judgeFailureReason', () => {
  it('reports the reason of a scorer that errored', () => {
    expect(judgeFailureReason(erroredJudgeResult('Cannot connect to API'))).toBe('Cannot connect to API');
  });

  // Regression: on timeout the scorer promise is dropped, so the goal scorer is
  // missing from `scorers` entirely. That silence used to read as score 0 —
  // "not complete, keep going" — the exact opposite of a judge that failed.
  it('treats a missing verdict as a failure', () => {
    expect(judgeFailureReason(result({ timedOut: true }))).toContain('timed out');
    expect(judgeFailureReason(result())).toContain('did not return a verdict');
  });

  it('returns undefined for a real verdict, including a legitimate score of 0', () => {
    const scored = result({
      scorers: [
        { score: 0, passed: false, reason: 'keep working', scorerId: 'goal', scorerName: 'Goal (LLM)', duration: 1 },
      ] as any,
    });
    expect(judgeFailureReason(scored)).toBeUndefined();
  });
});
