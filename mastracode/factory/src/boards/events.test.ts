import { describe, expect, it, vi } from 'vitest';
import { composeEventRule, recordExplicitRuleOverrides, selectEventRule } from '../rules/event-rules.js';
import { BoardDefinitionError, defineBoard } from './define-board.js';
import { createBoardRegistry } from './registry.js';
import { boardEventHandlers, eventBoardId, rulePhaseContext } from './semantics.js';
import { createTestBoard } from './test-utils.js';

const phases = {
  queued: { title: 'Queued', kind: 'resting', outcomes: { ship: 'shipping', drop: 'dropped' } },
  shipping: { title: 'Shipping', kind: 'working', role: 'release', next: 'shipped' },
  shipped: { title: 'Shipped', kind: 'terminal' },
  dropped: { title: 'Dropped', kind: 'terminal' },
} as const;

function board(events?: unknown) {
  return defineBoard({ id: 'release', title: 'Release', initialPhase: 'queued', phases, events: events as never });
}

describe('defineBoard events', () => {
  it('defaults to an empty frozen map', () => {
    expect(board().events).toEqual({});
    expect(Object.isFrozen(board().events)).toBe(true);
  });

  it('keeps declared handlers and null, frozen per integration', () => {
    const merged = () => undefined;
    const events = board({ github: { pullRequestMerged: merged, pullRequestUpdated: null } }).events;
    expect(events.github?.pullRequestMerged).toBe(merged);
    expect(events.github?.pullRequestUpdated).toBeNull();
    expect(Object.isFrozen(events.github)).toBe(true);
  });

  it.each([
    [[], 'Board events must be a plain object.'],
    [{ slack: {} }, 'Board events name unknown integration "slack".'],
    [{ github: [] }, 'Board events for "github" must be a plain object.'],
    [{ linear: { pullRequestMerged: null } }, 'Board events for "linear" name unknown event "pullRequestMerged".'],
    [{ jira: { issueClosed: 'done' } }, 'Board event handler "jira.issueClosed" must be a function or null.'],
  ])('rejects %j', (events, message) => {
    expect(() => board(events)).toThrow(new BoardDefinitionError(message));
  });
});

describe('selectEventRule', () => {
  const base = vi.fn(() => ({ type: 'notify', idempotencyKey: 'base' }) as never);

  it('uses the default when the board says nothing', () => {
    const rules = recordExplicitRuleOverrides(Object.freeze({ issueClosed: base }), undefined);
    expect(selectEventRule(rules, undefined, 'issueClosed')).toBe(base);
    expect(selectEventRule(rules, {}, 'issueClosed')).toBe(base);
  });

  it('switches the default off for a board that declares null', () => {
    const rules = recordExplicitRuleOverrides(Object.freeze({ issueClosed: base }), undefined);
    expect(selectEventRule(rules, { issueClosed: null }, 'issueClosed')).toBeNull();
  });

  it('keeps a handler the deployment set explicitly on the integration ahead of the board', () => {
    const explicit = () => undefined;
    const rules = recordExplicitRuleOverrides(Object.freeze({ issueClosed: explicit }), { issueClosed: explicit });
    expect(selectEventRule(rules, { issueClosed: null }, 'issueClosed')).toBe(explicit);
    const disabled = recordExplicitRuleOverrides(Object.freeze({ issueClosed: null }), { issueClosed: null });
    expect(selectEventRule(disabled, { issueClosed: () => undefined }, 'issueClosed')).toBeNull();
  });

  it('falls through to the default when the board handler returns no decision', async () => {
    const decision = { type: 'notify', idempotencyKey: 'board' } as never;
    const sync = composeEventRule<object>(() => undefined, base)!;
    expect(sync({})).toEqual({ type: 'notify', idempotencyKey: 'base' });
    expect(composeEventRule<object>(() => decision, base)!({})).toBe(decision);
    await expect(composeEventRule<object>(async () => undefined, base)!({})).resolves.toEqual({
      type: 'notify',
      idempotencyKey: 'base',
    });
    const thenable = { then: (resolve: (value: undefined) => void) => resolve(undefined) };
    await expect(composeEventRule<object>(() => thenable as never, base)!({})).resolves.toEqual({
      type: 'notify',
      idempotencyKey: 'base',
    });
    const handler = () => decision;
    expect(composeEventRule<object>(handler, null)).toBe(handler);
  });
});

describe('board event lookup', () => {
  const merged = () => undefined;
  const boards = createBoardRegistry({ boards: [board({ github: { pullRequestMerged: merged } })] });

  it('resolves the bound board handlers, never for unbound or uninstalled boards', () => {
    expect(boardEventHandlers(boards, 'release', 'github')?.pullRequestMerged).toBe(merged);
    expect(boardEventHandlers(boards, 'release', 'linear')).toBeUndefined();
    expect(boardEventHandlers(boards, 'ghost', 'github')).toBeUndefined();
    expect(boardEventHandlers(boards, undefined, 'github')).toBeUndefined();
  });

  it('answers with no board for card-less and pull-request intake evaluations', () => {
    expect(eventBoardId({ board: 'release' })).toBeUndefined();
    expect(eventBoardId({ item: {}, board: 'release', pullRequestIntake: true })).toBeUndefined();
    expect(eventBoardId({ item: {}, board: 'release' })).toBe('release');
  });
});

describe('rulePhaseContext', () => {
  const boards = createBoardRegistry({ boards: [createTestBoard()] });
  const item = (stages: string[], boardId: string | null = 'release') => ({
    board: boardId,
    externalSource: null,
    stages,
  });

  it('describes the card phase as its board declares it', () => {
    expect(rulePhaseContext(boards, item(['queued']))).toEqual({
      id: 'queued',
      kind: 'resting',
      outcomes: ['ship', 'skip'],
    });
    expect(rulePhaseContext(boards, item(['shipping']))).toEqual({
      id: 'shipping',
      kind: 'working',
      role: 'release',
      outcomes: [],
    });
    expect(rulePhaseContext(boards, item(['execute'], null))).toMatchObject({ kind: 'working', role: 'work' });
  });

  it('fails closed for multi-stage rows, undeclared phases, and uninstalled boards', () => {
    expect(rulePhaseContext(boards, item(['queued', 'shipping']))).toBeUndefined();
    expect(rulePhaseContext(boards, item(['nowhere']))).toBeUndefined();
    expect(rulePhaseContext(boards, item(['queued'], 'ghost'))).toBeUndefined();
  });
});
