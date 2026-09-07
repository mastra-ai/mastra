import { describe, expect, it } from 'vitest';

import { defineBoard } from './define-board.js';
import { boardTransitionPolicyResultSchema, immutablePolicySnapshot } from './transition-policy.js';
import type { BoardTransitionPolicy } from './transition-policy.js';

describe('board transition policy contract', () => {
  it('copies and deeply freezes nested data and normalizes dates', () => {
    const original = {
      actor: { type: 'human' },
      metadata: { labels: ['bug'] },
      acceptedAt: new Date('2026-09-05T00:00:00Z'),
    };
    const snapshot = immutablePolicySnapshot(original);
    expect(snapshot.acceptedAt).toBe('2026-09-05T00:00:00.000Z');
    expect(Reflect.set(snapshot.actor, 'type', 'system')).toBe(false);
    expect(Reflect.set(snapshot.metadata.labels, '0', 'feature')).toBe(false);
    original.metadata.labels.push('changed');
    original.acceptedAt.setTime(0);
    expect(snapshot.metadata.labels).toEqual(['bug']);
    expect(snapshot.acceptedAt).toBe('2026-09-05T00:00:00.000Z');
  });

  it('preserves independent policy handlers on immutable definitions', () => {
    const transitionPolicy: BoardTransitionPolicy = context =>
      context.isHumanTransition
        ? { type: 'allow' }
        : { type: 'reject', code: 'approval_required', reason: 'A person must approve.' };
    const config = {
      id: 'release',
      title: 'Release',
      initialPhase: 'approval',
      phases: { approval: { title: 'Approval', next: 'shipped' }, shipped: { title: 'Shipped' } },
      transitionPolicy,
    } as const;
    const board = defineBoard(config);
    expect(board.transitionPolicy).toBe(transitionPolicy);
    expect(Object.isFrozen(board)).toBe(true);
    expect(defineBoard({ ...config, transitionPolicy: undefined }).transitionPolicy).toBeUndefined();
    expect(board.allowsTransition('approval', 'shipped')).toBe(true);
  });

  it.each([null, false, {}, 'allow'])('rejects non-function policy %j', transitionPolicy => {
    expect(() =>
      defineBoard({
        id: 'invalid',
        title: 'Invalid',
        initialPhase: 'queued',
        phases: { queued: { title: 'Queued' } },
        // @ts-expect-error Exercise the JavaScript definition boundary.
        transitionPolicy,
      }),
    ).toThrow('transitionPolicy must be a function');
  });

  it.each([
    undefined,
    { type: 'allow' },
    { type: 'allow', accept: true, triageType: 'bug' },
    { type: 'reject', code: 'approval_required', reason: 'Approval required.' },
  ])('accepts valid result %j', result => {
    expect(boardTransitionPolicyResultSchema.safeParse(result).success).toBe(true);
  });

  it.each([
    null,
    [],
    { type: 'allow', accept: false },
    { type: 'allow', triageType: 'release' },
    { type: 'reject', code: 'approval_required', reason: '' },
    { type: 'reject', code: 'unknown', reason: 'No' },
    { type: 'reject', code: 'forbidden', reason: 'No', accept: true },
    { type: 'allow', autonomy: 'arm' },
    { type: 'invokeSkill', skillName: 'factory-triage' },
  ])('rejects malformed result %j', result => {
    expect(boardTransitionPolicyResultSchema.safeParse(result).success).toBe(false);
  });
});
