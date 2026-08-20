import { beforeEach, describe, expect, it } from 'vitest';
import {
  getScorerHealth,
  listScorerHealth,
  recordScorerFailure,
  recordScorerSampled,
  recordScorerTriggered,
  recordScoreSaved,
  resetScorerHealth,
} from './health';
import { runScorer } from './hooks';

describe('scorer health registry', () => {
  beforeEach(() => resetScorerHealth());

  it('starts at zero for unknown scorers', () => {
    expect(getScorerHealth('unknown')).toEqual({
      scorerId: 'unknown',
      triggered: 0,
      sampled: 0,
      saved: 0,
      failed: 0,
    });
  });

  it('tracks triggered vs sampled vs saved vs failed independently', () => {
    recordScorerTriggered('relevancy');
    recordScorerTriggered('relevancy');
    recordScorerSampled('relevancy');
    recordScoreSaved('relevancy');

    const health = getScorerHealth('relevancy');
    expect(health.triggered).toBe(2);
    expect(health.sampled).toBe(1);
    expect(health.saved).toBe(1);
    expect(health.failed).toBe(0);
  });

  it('records failures with the last error message and timestamp', () => {
    recordScorerFailure('relevancy', new Error('judge timed out'));

    const health = getScorerHealth('relevancy');
    expect(health.failed).toBe(1);
    expect(health.lastErrorMessage).toBe('judge timed out');
    expect(health.lastErrorAt).toBeTypeOf('number');
  });

  it('exposes an expected-vs-delivered gap (sampled > saved + failed means in flight or lost)', () => {
    recordScorerTriggered('faithfulness');
    recordScorerSampled('faithfulness');
    recordScorerTriggered('faithfulness');
    recordScorerSampled('faithfulness');
    recordScoreSaved('faithfulness');

    const health = getScorerHealth('faithfulness');
    expect(health.sampled - health.saved - health.failed).toBe(1);
  });

  it('counts sampling through runScorer: ratio 0 → triggered but never sampled', () => {
    const baseArgs = {
      runId: 'run-1',
      input: {},
      output: {},
      requestContext: {},
      entity: { id: 'agent-1' },
      structuredOutput: false,
      source: 'LIVE' as const,
      entityType: 'AGENT' as const,
    } as unknown as Parameters<typeof runScorer>[0];

    for (let i = 0; i < 5; i++) {
      runScorer({
        ...baseArgs,
        scorerId: 'sampled-out',
        scorerObject: {
          scorer: { id: 'sampled-out', name: 'Sampled Out' },
          sampling: { type: 'ratio', rate: 0 },
        } as any,
      });
    }
    runScorer({
      ...baseArgs,
      scorerId: 'always-on',
      scorerObject: { scorer: { id: 'always-on', name: 'Always On' } } as any,
    });

    expect(getScorerHealth('sampled-out')).toMatchObject({ triggered: 5, sampled: 0 });
    expect(getScorerHealth('always-on')).toMatchObject({ triggered: 1, sampled: 1 });
  });

  it('lists all scorers and returns copies that do not mutate the registry', () => {
    recordScorerTriggered('a');
    recordScorerTriggered('b');

    const list = listScorerHealth();
    expect(list.map(h => h.scorerId).sort()).toEqual(['a', 'b']);

    list[0]!.triggered = 999;
    expect(getScorerHealth(list[0]!.scorerId).triggered).toBe(1);
  });
});
