import { describe, expect, it } from 'vitest';
import {
  FACTORY_ROLE_STAGES,
  FACTORY_RULE_STAGES,
  isTerminalFactoryRuleStage,
  isWorkingFactoryRuleStage,
} from '../rules/types.js';
import { BoardDefinitionError, defineBoard } from './define-board.js';
import { reviewBoard } from './review.js';
import { workBoard } from './work.js';
import { allowsBuiltInBoardTransition } from './index.js';

describe('defineBoard', () => {
  it('normalizes linear and outcome transitions', () => {
    const board = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'prepare',
      phases: {
        prepare: { title: 'Prepare', kind: 'resting', next: 'verify' },
        verify: {
          title: 'Verify',
          kind: 'working',
          role: 'verifier',
          outcomes: { approved: 'done', rejected: 'prepare' },
        },
        done: { title: 'Done', kind: 'terminal' },
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
        kind: 'resting',
        outcomes: { approved: 'done' },
        onEnter: { manual: originalHandler },
      },
      done: { title: 'Done', kind: 'terminal' },
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
    expect(Reflect.set(board.phases.start, 'kind', 'working')).toBe(false);
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
          start: { title: 'Start', kind: 'resting', next: 'missing' },
        } as Record<string, { title: string; kind: 'resting'; next: string }>,
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
          start: { title: 'Start', kind: 'resting', next: '' },
        } as Record<string, { title: string; kind: 'resting'; next: string }>,
      }),
    ).toThrow(new BoardDefinitionError('Phase "start" targets undefined phase "".'));
  });

  describe('phase semantics', () => {
    const base = { id: 'semantics', title: 'Semantics', initialPhase: 'queued' } as const;
    const looseBoard = (phases: Record<string, unknown>) =>
      defineBoard({ ...base, phases: phases as Record<string, { title: string; kind: 'resting' }> });

    it('exposes declared kinds, roles, and role lookup in declaration order', () => {
      const board = defineBoard({
        ...base,
        phases: {
          queued: { title: 'Queued', kind: 'resting', next: 'shipping' },
          shipping: { title: 'Shipping', kind: 'working', role: 'release', next: 'verifying' },
          verifying: { title: 'Verifying', kind: 'working', role: 'release', next: 'shipped' },
          shipped: { title: 'Shipped', kind: 'terminal' },
        },
      });

      expect(board.phaseKind('queued')).toBe('resting');
      expect(board.phaseKind('shipping')).toBe('working');
      expect(board.phaseKind('shipped')).toBe('terminal');
      expect(board.phaseKind('unknown')).toBeUndefined();
      expect(board.isWorking('shipping')).toBe(true);
      expect(board.isWorking('queued')).toBe(false);
      expect(board.isWorking('unknown')).toBe(false);
      expect(board.isTerminal('shipped')).toBe(true);
      expect(board.isTerminal('shipping')).toBe(false);
      expect(board.isTerminal('unknown')).toBe(false);
      expect(board.roleForPhase('shipping')).toBe('release');
      expect(board.roleForPhase('queued')).toBeUndefined();
      expect(board.roleForPhase('shipped')).toBeUndefined();
      expect(board.phaseForRole('release')).toBe('shipping');
      expect(board.phaseForRole('work')).toBeUndefined();
      expect(board.phases.shipping.role).toBe('release');
      expect('role' in board.phases.queued).toBe(false);
    });

    it('ignores inherited property names', () => {
      const board = defineBoard({
        ...base,
        phases: { queued: { title: 'Queued', kind: 'resting' } },
      });
      expect(board.phaseKind('constructor')).toBeUndefined();
      expect(board.roleForPhase('toString')).toBeUndefined();
      expect(board.phaseForRole('hasOwnProperty')).toBeUndefined();
    });

    it('rejects phases without a kind', () => {
      expect(() => looseBoard({ queued: { title: 'Queued' } })).toThrow(
        new BoardDefinitionError(`Phase "queued" must declare kind 'resting', 'working', or 'terminal'.`),
      );
      expect(() => looseBoard({ queued: { title: 'Queued', kind: 'idle' } })).toThrow(BoardDefinitionError);
    });

    it('rejects working phases without a valid role', () => {
      const cases: unknown[] = [undefined, '', 'has space', 'x'.repeat(33), 42];
      for (const role of cases) {
        expect(() =>
          looseBoard({
            queued: { title: 'Queued', kind: 'resting', next: 'shipping' },
            shipping: { title: 'Shipping', kind: 'working', role },
          }),
        ).toThrow(new BoardDefinitionError('Working phase "shipping" must declare a valid role.'));
      }
    });

    it('rejects roles on resting and terminal phases', () => {
      expect(() => looseBoard({ queued: { title: 'Queued', kind: 'resting', role: 'bot' } })).toThrow(
        new BoardDefinitionError('Phase "queued" is resting and cannot declare a role.'),
      );
      expect(() =>
        looseBoard({
          queued: { title: 'Queued', kind: 'resting', next: 'shipped' },
          shipped: { title: 'Shipped', kind: 'terminal', role: 'bot' },
        }),
      ).toThrow(new BoardDefinitionError('Phase "shipped" is terminal and cannot declare a role.'));
    });

    it('requires the initial phase to be resting', () => {
      expect(() => looseBoard({ queued: { title: 'Queued', kind: 'working', role: 'bot' } })).toThrow(
        new BoardDefinitionError('Initial phase "queued" must be a resting phase.'),
      );
      expect(() => looseBoard({ queued: { title: 'Queued', kind: 'terminal' } })).toThrow(
        new BoardDefinitionError('Initial phase "queued" must be a resting phase.'),
      );
    });
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
    expect(reviewBoard.phaseKind('intake')).toBe('resting');
    expect(reviewBoard.roleForPhase('review')).toBe('review');
    expect(reviewBoard.isTerminal('done')).toBe(true);
    expect(reviewBoard.isTerminal('canceled')).toBe(true);
  });

  it('defines the built-in Work lifecycle and phase behavior', () => {
    expect(workBoard.initialPhase).toBe('intake');
    const phases = ['intake', 'triage', 'planning', 'execute', 'review', 'done', 'canceled'] as const;
    for (const from of phases) {
      for (const to of phases) {
        expect(workBoard.allowsTransition(from, to), `${from} -> ${to}`).toBe(true);
      }
    }
    expect(workBoard.rules.intake?.issue?.onEnter).toBeTypeOf('function');
    expect(workBoard.rules.triage?.linearIssue?.onEnter).toBeTypeOf('function');
    expect(workBoard.rules.planning?.manual?.onEnter).toBeTypeOf('function');
    expect(workBoard.rules.execute?.issue?.onEnter).toBeTypeOf('function');
    expect(workBoard.rules.done?.issue?.onEnter).toBeTypeOf('function');
    expect(workBoard.phaseKind('intake')).toBe('resting');
    expect(workBoard.roleForPhase('triage')).toBe('triage');
    expect(workBoard.roleForPhase('planning')).toBe('plan');
    expect(workBoard.roleForPhase('execute')).toBe('work');
    expect(workBoard.roleForPhase('review')).toBe('work');
    expect(workBoard.phaseForRole('work')).toBe('execute');
    expect(workBoard.isTerminal('done')).toBe(true);
    expect(workBoard.isTerminal('canceled')).toBe(true);
  });

  it('keeps the built-in declarations in agreement with the static stage and role constants', () => {
    // rules/types.ts cannot import boards without a cycle, so this pins the two against each other.
    for (const stage of FACTORY_RULE_STAGES) {
      expect(workBoard.isTerminal(stage), `${stage} terminal`).toBe(isTerminalFactoryRuleStage([stage]));
      expect(workBoard.isWorking(stage), `${stage} working`).toBe(isWorkingFactoryRuleStage(stage));
    }
    for (const [role, stage] of Object.entries(FACTORY_ROLE_STAGES)) {
      const board = role === 'review' ? reviewBoard : workBoard;
      expect(board.phaseForRole(role), `lane for ${role}`).toBe(stage);
      expect(board.roleForPhase(stage), `role for ${stage}`).toBe(role);
    }
    for (const stage of Object.keys(reviewBoard.phases)) {
      expect(reviewBoard.isTerminal(stage)).toBe(isTerminalFactoryRuleStage([stage]));
      expect(reviewBoard.isWorking(stage)).toBe(isWorkingFactoryRuleStage(stage));
    }
  });

  it('rejects inherited property names as Work phases', () => {
    expect(() => allowsBuiltInBoardTransition('work', 'toString', 'done')).not.toThrow();
    expect(allowsBuiltInBoardTransition('work', 'toString', 'done')).toBe(false);
    expect(allowsBuiltInBoardTransition('work', 'intake', 'constructor')).toBe(false);
  });
});
