import { describe, expect, it } from 'vitest';
import { BoardDefinitionError, defineBoard } from './define-board.js';
import { reviewBoard } from './review.js';

describe('defineBoard', () => {
  it('normalizes linear and outcome transitions', () => {
    const board = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'prepare',
      phases: {
        prepare: { title: 'Prepare', next: 'verify' },
        verify: { title: 'Verify', outcomes: { approved: 'done', rejected: 'prepare' } },
        done: { title: 'Done' },
      },
    });

    expect(board.transitions.prepare).toEqual([{ outcome: null, to: 'verify' }]);
    expect(board.transitions.verify).toEqual([
      { outcome: 'approved', to: 'done' },
      { outcome: 'rejected', to: 'prepare' },
    ]);
    expect(board.rules).toEqual({});
    expect(board.allowsTransition('prepare', 'verify')).toBe(true);
    expect(board.allowsTransition('prepare', 'done')).toBe(false);
    expect(board.allowsTransition('verify', 'verify')).toBe(true);

    expect(Object.isFrozen(board.transitions.prepare[0])).toBe(true);
    expect(Reflect.set(board.transitions.prepare[0]!, 'to', 'done')).toBe(false);
    expect(board.allowsTransition('prepare', 'verify')).toBe(true);
    expect(board.allowsTransition('prepare', 'done')).toBe(false);
  });

  it('clones and freezes the public phase and rule graphs', () => {
    const originalHandler = () => undefined;
    const replacementHandler = () => ({ type: 'notify', message: 'mutated' }) as const;
    const phases = {
      start: {
        title: 'Start',
        outcomes: { approved: 'done' },
        onEnter: { manual: originalHandler },
      },
      done: { title: 'Done' },
    } as const;
    const board = defineBoard({ id: 'immutable', title: 'Immutable', initialPhase: 'start', phases });

    expect(Object.isFrozen(board.phases.start)).toBe(true);
    expect(Object.isFrozen(board.phases.start.outcomes)).toBe(true);
    expect(Object.isFrozen(board.phases.start.onEnter)).toBe(true);
    expect(Object.isFrozen(board.rules.start)).toBe(true);
    expect(Object.isFrozen(board.rules.start?.manual)).toBe(true);

    expect(Reflect.set(phases.start.outcomes, 'approved', 'start')).toBe(true);
    expect(Reflect.set(phases.start.onEnter, 'manual', replacementHandler)).toBe(true);
    expect(board.phases.start.outcomes?.approved).toBe('done');
    expect(board.phases.start.onEnter?.manual).toBe(originalHandler);
    expect(board.rules.start?.manual?.onEnter).toBe(originalHandler);

    expect(Reflect.set(board.phases.start, 'title', 'Mutated')).toBe(false);
    expect(Reflect.set(board.phases.start.outcomes!, 'approved', 'start')).toBe(false);
    expect(Reflect.set(board.rules.start!, 'manual', {})).toBe(false);
    expect(Reflect.set(board.rules.start!.manual!, 'onEnter', replacementHandler)).toBe(false);
  });

  it('rejects definitions whose transitions target missing phases', () => {
    expect(() =>
      defineBoard({
        id: 'broken',
        title: 'Broken',
        initialPhase: 'start',
        phases: {
          start: { title: 'Start', next: 'missing' },
        } as Record<string, { title: string; next: string }>,
      }),
    ).toThrow(new BoardDefinitionError('Phase "start" targets undefined phase "missing".'));
  });

  it('validates an empty string next target instead of dropping it', () => {
    expect(() =>
      defineBoard({
        id: 'broken',
        title: 'Broken',
        initialPhase: 'start',
        phases: {
          start: { title: 'Start', next: '' },
        } as Record<string, { title: string; next: string }>,
      }),
    ).toThrow(new BoardDefinitionError('Phase "start" targets undefined phase "".'));
  });

  it('defines the built-in Review lifecycle', () => {
    expect(reviewBoard.initialPhase).toBe('intake');
    expect(reviewBoard.allowsTransition('intake', 'review')).toBe(true);
    expect(reviewBoard.allowsTransition('review', 'done')).toBe(true);
    expect(reviewBoard.allowsTransition('review', 'canceled')).toBe(true);
    expect(reviewBoard.allowsTransition('review', 'intake')).toBe(true);
    expect(reviewBoard.allowsTransition('done', 'review')).toBe(true);
    expect(reviewBoard.allowsTransition('canceled', 'review')).toBe(true);
    expect(reviewBoard.rules.intake?.pullRequest?.onEnter).toBeTypeOf('function');
    expect(reviewBoard.rules.review?.pullRequest?.onEnter).toBeTypeOf('function');
  });
});
