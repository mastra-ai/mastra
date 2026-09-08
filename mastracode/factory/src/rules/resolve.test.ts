import { describe, expect, it, vi } from 'vitest';
import { createBoardRegistry, defineBoard, reviewBoard, workBoard } from '../boards/index.js';
import { defaultFactoryRules } from './defaults.js';
import { resolveFactoryStageRules, resolveFactoryToolRule } from './resolve.js';

describe('Factory rule resolution', () => {
  const onExit = vi.fn(() => undefined);
  const onEnter = vi.fn(() => undefined);
  const board = defineBoard({
    id: 'release',
    title: 'Release',
    initialPhase: 'queued',
    phases: {
      queued: { title: 'Queued', next: 'shipped', onExit: { issue: onExit }, onEnter: { issue: onEnter } },
      shipped: { title: 'Shipped', onEnter: { issue: onEnter } },
    },
  });
  const boards = createBoardRegistry({ boards: [board], includeDefaultBoards: false });
  const input = { board: 'release', source: 'issue' as const, fromStage: 'queued', toStage: 'shipped' };

  it('resolves custom-only installed phases in exit-before-enter order', () => {
    expect(resolveFactoryStageRules(boards, input)).toEqual([
      { phase: 'exit', handler: onExit },
      { phase: 'enter', handler: onEnter },
    ]);
  });

  it('resolves built-in handlers directly from their installed definitions', () => {
    const defaults = createBoardRegistry();
    expect(
      resolveFactoryStageRules(defaults, { ...input, board: 'work', fromStage: 'intake', toStage: 'triage' }),
    ).toEqual([{ phase: 'enter', handler: workBoard.rules.triage?.issue?.onEnter }]);
    expect(
      resolveFactoryStageRules(defaults, {
        ...input,
        board: 'review',
        source: 'pullRequest',
        fromStage: 'intake',
        toStage: 'review',
      }),
    ).toEqual([{ phase: 'enter', handler: reviewBoard.rules.review?.pullRequest?.onEnter }]);
  });

  it.each(['issue', 'pullRequest', 'linearIssue', 'manual'] as const)('matches the %s source exactly', source => {
    expect(resolveFactoryStageRules(boards, { ...input, source })).toEqual(
      source === 'issue'
        ? [
            { phase: 'exit', handler: onExit },
            { phase: 'enter', handler: onEnter },
          ]
        : [],
    );
  });

  it('skips unchanged stages and runs only entry on reentry or initial entry', () => {
    const same = { ...input, toStage: 'queued' };
    expect(resolveFactoryStageRules(boards, same)).toEqual([]);
    expect(resolveFactoryStageRules(boards, { ...same, reenter: true })).toEqual([
      { phase: 'enter', handler: onEnter },
    ]);
    expect(resolveFactoryStageRules(boards, { ...same, initialEntry: true })).toEqual([
      { phase: 'enter', handler: onEnter },
    ]);
  });

  it('never falls back to uninstalled built-ins or another registry', () => {
    const empty = createBoardRegistry({ includeDefaultBoards: false });
    for (const id of ['release', 'work', 'review', 'missing']) {
      expect(resolveFactoryStageRules(empty, { ...input, board: id, fromStage: 'intake', toStage: 'triage' })).toEqual(
        [],
      );
    }
    const other = createBoardRegistry({
      boards: [
        defineBoard({
          id: 'release',
          title: 'Other release',
          initialPhase: 'queued',
          phases: {
            queued: { title: 'Queued', next: 'shipped' },
            shipped: { title: 'Shipped' },
          },
        }),
      ],
      includeDefaultBoards: false,
    });
    expect(resolveFactoryStageRules(other, input)).toEqual([]);
    expect(resolveFactoryStageRules(boards, input)).toHaveLength(2);
  });

  it('resolves open tool names', () => {
    const onResult = vi.fn(() => undefined);
    const rules = defaultFactoryRules({ version: 'resolve-v3', overrides: { tools: { submit_plan: { onResult } } } });
    expect(resolveFactoryToolRule(rules, 'submit_plan')).toBe(onResult);
    expect(resolveFactoryToolRule(rules, 'unknown_tool')).toBeUndefined();
  });
});
