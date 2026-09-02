import { describe, it, expect, vi } from 'vitest';
import { createScorer } from '../../../evals/base';
import { notScorable } from '../../../evals/not-scorable';
import { runScorersForItem } from '../scorer';

describe('runScorersForItem not scorable', () => {
  it('reports a not-scorable scorer result without a score or an error', async () => {
    const generateScore = vi.fn(() => 1);
    const scorer = createScorer({ id: 'refund-judge', description: 'judges refund handling' })
      .preprocess(() => notScorable('refund tool never called'))
      .generateScore(generateScore);

    const results = await runScorersForItem(
      [scorer],
      { input: 'hello' },
      'hi there',
      null,
      'run-1',
      'agent',
      'agent-1',
      'item-1',
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );

    expect(generateScore).not.toHaveBeenCalled();
    expect(results).toEqual([
      expect.objectContaining({
        scorerId: 'refund-judge',
        score: null,
        reason: null,
        error: null,
        notScorable: { reason: 'refund tool never called' },
      }),
    ]);
  });
});
