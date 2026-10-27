import { describe, expect, it } from 'vitest';

import type { BoardTransitionPolicyContext } from './transition-policy.js';
import { workTransitionPolicy } from './work-transition-policy.js';

function context(
  fromStage: string,
  toStage: string,
  options: { human?: boolean; metadata?: Record<string, unknown> } = {},
): BoardTransitionPolicyContext {
  return {
    actor: options.human ? { type: 'human' } : { type: 'agent', role: 'work' },
    board: 'work',
    fromStage,
    toStage,
    isHumanTransition: options.human ?? false,
    fromPhaseTools: [],
    item: { triageType: 'bug', metadata: options.metadata ?? {} },
  } as unknown as BoardTransitionPolicyContext;
}

describe('work transition policy: self-review', () => {
  const parked = { selfReviewVerdict: 'request changes', selfReviewRounds: 3, selfReviewNeedsHuman: true };

  it('keeps an agent from moving a card that self-review parked for a person', () => {
    expect(workTransitionPolicy(context('intake', 'execute', { metadata: parked }))).toMatchObject({
      type: 'reject',
      code: 'approval_required',
    });
  });

  it('lets a person resume a parked card', () => {
    expect(workTransitionPolicy(context('intake', 'execute', { human: true, metadata: parked }))).toMatchObject({
      type: 'allow',
    });
  });

  it('keeps an agent from closing a card still waiting on self-review', () => {
    expect(workTransitionPolicy(context('review', 'done'))).toMatchObject({ type: 'reject' });
    expect(workTransitionPolicy(context('review', 'done', { human: true }))).toMatchObject({ type: 'allow' });
  });

  it('lets the builder hand a pushed branch to Review', () => {
    expect(workTransitionPolicy(context('execute', 'review'))).toMatchObject({ type: 'allow' });
  });
});

describe('work transition policy: pull request cards', () => {
  const pullRequest = (toStage: string, actor: object) =>
    ({
      ...context('review', toStage),
      actor,
      source: 'pullRequest',
    }) as BoardTransitionPolicyContext;

  it('keeps Done for merges: a review agent cannot move a pull request card there', () => {
    expect(workTransitionPolicy(pullRequest('done', { type: 'agent', id: 'binding-1', role: 'review' }))).toMatchObject(
      {
        type: 'reject',
        reason: expect.stringContaining('Done is reserved for merged pull requests'),
      },
    );
    expect(workTransitionPolicy(pullRequest('done', { type: 'github', id: 'merge' }))?.type).not.toBe('reject');
    expect(workTransitionPolicy(pullRequest('canceled', { type: 'agent', id: 'b', role: 'review' }))?.type).not.toBe(
      'reject',
    );
  });
});
