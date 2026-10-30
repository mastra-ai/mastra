import { describe, expect, it } from 'vitest';

import type { StoredBoardInput, StoredPhaseInput } from '../storage/domains/boards/base.js';
import { BoardDefinitionError, defineBoard } from './define-board.js';
import type { BoardPhaseDefinition } from './define-board.js';
import { reviewBoard } from './review.js';
import { boardDefinitionOf, compileStoredBoard, storedBoardInputSchema } from './stored-board.js';
import { workBoard } from './work.js';

const GO = {
  operator: 'AND' as const,
  conditions: [{ field: 'item.labels', operator: 'contains' as const, value: 'go' }],
};

describe('boardDefinitionOf', () => {
  it.each([
    ['Work', workBoard],
    ['Review', reviewBoard],
  ])('describes the built-in %s board as a valid stored definition with the same phases', (_name, board) => {
    const definition = boardDefinitionOf(board);

    expect(storedBoardInputSchema.safeParse(definition).error?.issues).toBeUndefined();
    expect(definition).toMatchObject({ key: board.id, name: board.name });
    expect(definition.phases[0]!.key).toBe(board.initialPhase);
    expect(definition.phases.map(phase => phase.key).sort()).toEqual(Object.keys(board.phases).sort());
    for (const phase of definition.phases) {
      const code = board.phases[phase.key]!;
      expect({
        key: phase.key,
        name: phase.name,
        kind: phase.kind,
        nextPhases: phase.nextPhases,
        agentEnterWhen: phase.agentEnterWhen,
      }).toEqual({
        key: phase.key,
        name: code.name,
        kind: code.kind,
        nextPhases: [...code.nextPhases],
        agentEnterWhen: code.agentEnterWhen,
      });
      if (code.kind === 'working') expect(code.runner).toMatchObject(phase.runner!);
    }
  });

  it('lets a stored copy of a board with outcomes move cards only where its stored next phases allow', () => {
    const board = defineBoard({
      id: 'outcomes',
      name: 'Outcomes',
      initialPhase: 'inbox',
      phases: {
        inbox: { name: 'Inbox', kind: 'resting', nextPhases: ['doing'] },
        doing: {
          name: 'Doing',
          kind: 'working',
          runner: { context: 'work' },
          outcomes: { shipped: 'done', dropped: 'canceled' },
        },
        done: { name: 'Done', kind: 'terminal' },
        canceled: { name: 'Canceled', kind: 'terminal' },
      },
    });
    const definition = boardDefinitionOf(board);
    expect(definition.phases.find(phase => phase.key === 'doing')!.nextPhases).toEqual(['done', 'canceled']);
    expect(compileStoredBoard(definition).allowsTransition('doing', 'canceled')).toBe(true);

    const edited = compileStoredBoard({
      ...definition,
      phases: definition.phases.map(phase => (phase.key === 'doing' ? { ...phase, nextPhases: ['done'] } : phase)),
    });

    expect(edited.allowsTransition('doing', 'done')).toBe(true);
    expect(edited.allowsTransition('doing', 'canceled')).toBe(false);
    expect(edited.phases.doing!.outcomes).toBeUndefined();
    expect(edited.transitions.doing!.map(transition => transition.to)).toEqual(['done']);
  });

  it('places the initial phase first and writes every phase’s next phases out', () => {
    const board = defineBoard({
      id: 'late-start',
      name: 'Late start',
      initialPhase: 'inbox',
      phases: {
        doing: { name: 'Doing', kind: 'working', runner: { context: 'work' }, nextPhases: ['done'] },
        inbox: { name: 'Inbox', kind: 'resting', nextPhases: ['doing'] },
        done: { name: 'Done', kind: 'terminal' },
      },
    });

    const definition = boardDefinitionOf(board);

    expect(definition.phases.map(phase => [phase.key, phase.nextPhases])).toEqual([
      ['inbox', ['doing']],
      ['doing', ['done']],
      ['done', []],
    ]);
    const stored = compileStoredBoard(definition);
    expect(stored.initialPhase).toBe('inbox');
    expect(stored.allowsTransition('done', 'inbox')).toBe(false);
    expect(stored.roleForPhase('doing')).toBe('work');
  });
});

describe('boards authored through the API', () => {
  const phases = (overrides: Partial<StoredPhaseInput> = {}): StoredPhaseInput[] => [
    { key: 'inbox', name: 'Inbox', kind: 'resting' },
    { key: 'doing', name: 'Doing', kind: 'working', runner: { context: 'work' }, ...overrides },
    { key: 'done', name: 'Done', kind: 'terminal' },
  ];

  it('let unset next phases mean every other phase, `[]` none, and none from a terminal phase', () => {
    const board = compileStoredBoard({ key: 'bugs', name: 'Bugs', phases: phases({ nextPhases: [] }) });

    expect([...board.phases.inbox!.nextPhases]).toEqual(['doing', 'done']);
    expect(board.allowsTransition('inbox', 'done')).toBe(true);
    expect(board.allowsTransition('doing', 'done')).toBe(false);
    expect([...board.phases.done!.nextPhases]).toEqual([]);
    expect(board.allowsTransition('done', 'inbox')).toBe(false);
    expect(board.initialPhase).toBe('inbox');
  });

  it('accept a valid board', () => {
    const input = { key: 'bugs', name: 'Bugs', description: null, phases: phases({ nextPhases: null }) };
    expect(storedBoardInputSchema.parse(input)).toEqual(input);
  });

  it('refuse duplicate phase keys, empty boards and unknown fields', () => {
    const duplicate = storedBoardInputSchema.safeParse({
      key: 'bugs',
      name: 'Bugs',
      phases: [...phases(), { key: 'done', name: 'Again', kind: 'terminal' }],
    });
    expect(duplicate.error?.issues.map(issue => issue.message)).toEqual([
      'Board "bugs" declares phase "done" more than once.',
    ]);
    expect(storedBoardInputSchema.safeParse({ key: 'bugs', name: 'Bugs', phases: [] }).success).toBe(false);
    expect(
      storedBoardInputSchema.safeParse({
        key: 'bugs',
        name: 'Bugs',
        phases: phases({ runner: { agentId: 'x' } as never }),
      }).success,
    ).toBe(false);
  });

  // Each stored board below breaks one `defineBoard()` rule. The schema must refuse it with the
  // message `defineBoard()` gives for the same board written in code.
  const long = 'x'.repeat(129);
  const rejected: Array<[string, StoredBoardInput]> = [
    ['an invalid board key', { key: 'bad key!', name: 'Bugs', phases: phases() }],
    ['a board name that is too long', { key: 'bugs', name: long, phases: phases() }],
    ['an empty board name', { key: 'bugs', name: '', phases: phases() }],
    ['a description that is too long', { key: 'bugs', name: 'Bugs', description: 'x'.repeat(2001), phases: phases() }],
    [
      'an invalid phase key',
      { key: 'bugs', name: 'Bugs', phases: [{ key: 'in box', name: 'Inbox', kind: 'resting' }] },
    ],
    ['a first phase that is not resting', { key: 'bugs', name: 'Bugs', phases: phases().slice(1) }],
    ['a next phase that does not exist', { key: 'bugs', name: 'Bugs', phases: phases({ nextPhases: ['nowhere'] }) }],
    ['an invalid runner context', { key: 'bugs', name: 'Bugs', phases: phases({ runner: { context: 'not valid!' } }) }],
    ['an invalid runner skill', { key: 'bugs', name: 'Bugs', phases: phases({ runner: { skill: 'Not A Skill' } }) }],
    [
      'instructions that are too long',
      { key: 'bugs', name: 'Bugs', phases: phases({ runner: { instructions: 'x'.repeat(1001) } }) },
    ],
    [
      'a runner on a resting phase',
      {
        key: 'bugs',
        name: 'Bugs',
        phases: [{ key: 'inbox', name: 'Inbox', kind: 'resting', runner: { context: 'work' } }],
      },
    ],
    [
      'auto start on a terminal phase',
      {
        key: 'bugs',
        name: 'Bugs',
        phases: [...phases().slice(0, 2), { key: 'done', name: 'Done', kind: 'terminal', autoStart: true }],
      },
    ],
    [
      'autoStartWhen without autoStart',
      {
        key: 'bugs',
        name: 'Bugs',
        phases: phases({ autoStartWhen: GO }),
      },
    ],
    [
      'an exit tool with no next phase',
      { key: 'bugs', name: 'Bugs', phases: phases({ nextPhases: [], exitTool: { id: 'ship' } }) },
    ],
    [
      'the transition tool as exit tool',
      { key: 'bugs', name: 'Bugs', phases: phases({ exitTool: { id: 'factory_transition_work_item' } }) },
    ],
    [
      'autoApproveWhen without autoApprove',
      {
        key: 'bugs',
        name: 'Bugs',
        phases: phases({
          exitTool: { id: 'ship', autoApproveWhen: GO },
        }),
      },
    ],
  ];

  it('keep the phases agents may move cards into when compiled and written back out', () => {
    const input: StoredBoardInput = {
      key: 'bugs',
      name: 'Bugs',
      phases: [
        { key: 'reported', name: 'Reported', kind: 'resting', agentEnterWhen: null },
        { key: 'fixing', name: 'Fixing', kind: 'working', agentEnterWhen: GO },
        { key: 'fixed', name: 'Fixed', kind: 'terminal', agentEnterWhen: false },
      ],
    };
    expect(storedBoardInputSchema.safeParse(input).success).toBe(true);

    const board = compileStoredBoard(input);

    expect(board.phases.reported!.agentEnterWhen).toBeUndefined();
    expect(board.phases.fixing!.agentEnterWhen).toEqual(GO);
    expect(board.phases.fixed!.agentEnterWhen).toBe(false);
    expect(boardDefinitionOf(board).phases.map(phase => phase.agentEnterWhen)).toEqual([undefined, GO, false]);
  });

  it('refuse a malformed agentEnterWhen', () => {
    for (const agentEnterWhen of [
      true,
      { operator: 'AND', conditions: [{ field: 'actor.type', operator: 'exists' }] },
    ]) {
      const result = storedBoardInputSchema.safeParse({
        key: 'bugs',
        name: 'Bugs',
        phases: phases({ agentEnterWhen: agentEnterWhen as never }),
      });
      expect(result.success).toBe(false);
    }
  });

  it('refuse a malformed condition', () => {
    const result = storedBoardInputSchema.safeParse({
      key: 'bugs',
      name: 'Bugs',
      phases: phases({ autoStart: true, autoStartWhen: { operator: 'XOR', conditions: [] } as never }),
    });
    expect(result.success).toBe(false);
  });

  it.each(rejected)('refuse %s with the defineBoard() message', (_case, input) => {
    let expected: string | undefined;
    try {
      defineBoard(asCodeBoard(input));
    } catch (error) {
      expect(error).toBeInstanceOf(BoardDefinitionError);
      expected = (error as Error).message;
    }
    expect(expected).toBeDefined();

    const result = storedBoardInputSchema.safeParse(input);

    expect(result.success).toBe(false);
    expect(result.error!.issues.map(issue => issue.message)).toEqual([expected]);
  });
});

/** The same board written with `defineBoard()`, as an app would in code. */
function asCodeBoard(input: StoredBoardInput) {
  const phases: Record<string, BoardPhaseDefinition<string>> = {};
  for (const phase of input.phases) {
    const nextPhases =
      phase.nextPhases ??
      (phase.kind === 'terminal' ? [] : input.phases.filter(p => p.key !== phase.key).map(p => p.key));
    phases[phase.key] = {
      name: phase.name,
      kind: phase.kind,
      nextPhases,
      ...(phase.description != null ? { description: phase.description } : {}),
      ...(phase.runner ? { runner: phase.runner } : {}),
      ...(phase.autoStart ? { autoStart: phase.autoStart } : {}),
      ...(phase.autoStartWhen ? { autoStartWhen: phase.autoStartWhen } : {}),
      ...(phase.exitTool ? { exitTool: phase.exitTool } : {}),
      ...(phase.agentEnterWhen != null ? { agentEnterWhen: phase.agentEnterWhen } : {}),
    } as BoardPhaseDefinition<string>;
  }
  return {
    id: input.key,
    name: input.name,
    ...(input.description != null ? { description: input.description } : {}),
    initialPhase: input.phases[0]!.key,
    phases,
  };
}
