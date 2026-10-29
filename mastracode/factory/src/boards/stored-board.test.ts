import { describe, expect, it } from 'vitest';

import { resolveFactoryStageRules } from '../rules/resolve.js';
import { FACTORY_RULE_SOURCES } from '../rules/types.js';
import type { StoredBoardInput, StoredPhaseInput } from '../storage/domains/boards/base.js';
import { BoardDefinitionError, defineBoard } from './define-board.js';
import type { BoardPhaseDefinition } from './define-board.js';
import { createBoardRegistry } from './registry.js';
import type { InstalledBoard } from './registry.js';
import { reviewBoard } from './review.js';
import { boardSeedHash, compileStoredBoard, seedFromDefinition, storedBoardInputSchema } from './stored-board.js';
import { workBoard } from './work.js';

const GO = {
  operator: 'AND' as const,
  conditions: [{ field: 'item.labels', operator: 'contains' as const, value: 'go' }],
};

/** The `release` board from `rules/custom-board-runtime.test.ts`: deprecated fields, `next`, a policy and handlers. */
const release = defineBoard({
  id: 'release',
  title: 'Release',
  initialPhase: 'queued',
  transitionPolicy: context =>
    context.toStage === 'preparing' && !context.isHumanTransition
      ? { type: 'reject', code: 'approval_required', reason: 'A maintainer must approve.' }
      : undefined,
  tools: { execute_command: { onResult: () => undefined } },
  phases: {
    queued: {
      title: 'Queued',
      kind: 'resting',
      next: 'preparing',
      onEnter: { issue: () => undefined },
    },
    preparing: {
      title: 'Preparing',
      kind: 'working',
      role: 'release-preparer',
      next: 'shipping',
      onEnter: { issue: () => undefined },
    },
    shipping: {
      title: 'Shipping',
      kind: 'working',
      role: 'release-publisher',
      next: 'shipped',
      onEnter: { issue: () => undefined },
    },
    shipped: { title: 'Shipped', kind: 'terminal' },
  },
});

function roundTrip(board: InstalledBoard): InstalledBoard {
  const seed = seedFromDefinition(board, 'builtin');
  return compileStoredBoard(seed.input, seed.behaviors);
}

/** Asserts two compiled boards move cards, run phases and fire rules the same way. */
function expectSameBehavior(actual: InstalledBoard, expected: InstalledBoard) {
  expect(actual.id).toBe(expected.id);
  expect(actual.name).toBe(expected.name);
  expect(actual.description).toBe(expected.description);
  expect(actual.initialPhase).toBe(expected.initialPhase);
  const phases = Object.keys(expected.phases);
  expect(Object.keys(actual.phases).sort()).toEqual([...phases].sort());
  for (const key of phases) {
    const want = expected.phases[key]!;
    const got = actual.phases[key]!;
    expect({ key, name: got.name, description: got.description, kind: got.kind }).toEqual({
      key,
      name: want.name,
      description: want.description,
      kind: want.kind,
    });
    expect([...got.nextPhases].sort()).toEqual([...want.nextPhases].sort());
    expect(actual.phaseKind(key)).toBe(expected.phaseKind(key));
    expect(actual.roleForPhase(key)).toBe(expected.roleForPhase(key));
    expect(actual.startsAutomatically(key)).toBe(expected.startsAutomatically(key));
    if (want.kind === 'working' && got.kind === 'working') {
      expect(got.runner).toEqual(want.runner);
      expect(got.exitTool).toEqual(want.exitTool);
      expect(got.autoStartWhen).toEqual(want.autoStartWhen);
      expect(actual.phaseForRole(want.runner.context)).toBe(expected.phaseForRole(want.runner.context));
    }
    expect(actual.transitions[key]!.map(transition => transition.to).sort(), `transitions from ${key}`).toEqual(
      expected.transitions[key]!.map(transition => transition.to).sort(),
    );
    for (const to of phases) expect(actual.allowsTransition(key, to)).toBe(expected.allowsTransition(key, to));
  }
  expect(actual.transitionPolicy).toBe(expected.transitionPolicy);
  expect(actual.sourceClosed).toEqual(expected.sourceClosed);
  expect(Object.keys(actual.tools).sort()).toEqual(Object.keys(expected.tools).sort());
  for (const [tool, rule] of Object.entries(expected.tools)) expect(actual.tools[tool]!.onResult).toBe(rule.onResult);
  expect(actual.events).toEqual(expected.events);

  const actualRegistry = createBoardRegistry({ boards: [actual], includeDefaultBoards: false });
  const expectedRegistry = createBoardRegistry({ boards: [expected], includeDefaultBoards: false });
  for (const source of FACTORY_RULE_SOURCES) {
    for (const fromStage of phases) {
      for (const toStage of phases) {
        const input = { board: expected.id, source, fromStage, toStage };
        const want = resolveFactoryStageRules(expectedRegistry, input).map(rule => rule.phase);
        const got = resolveFactoryStageRules(actualRegistry, input).map(rule => rule.phase);
        expect(got, `${source} ${fromStage} -> ${toStage}`).toEqual(want);
      }
      const entry = { board: expected.id, source, fromStage, toStage: fromStage, initialEntry: true };
      expect(resolveFactoryStageRules(actualRegistry, entry).length).toBe(
        resolveFactoryStageRules(expectedRegistry, entry).length,
      );
    }
  }
}

describe('stored boards compiled with their code behaviors', () => {
  it('behave exactly like the built-in Work board', () => {
    const stored = roundTrip(workBoard);

    expectSameBehavior(stored, workBoard);
    // Handlers Work declares in code attach unchanged, not as copies.
    expect(stored.rules.triage!.issue!.onEnter).toBe(workBoard.rules.triage!.issue!.onEnter);
    expect(stored.rules.done!.issue!.onEnter).toBe(workBoard.rules.done!.issue!.onEnter);
  });

  it('behave exactly like the built-in Review board', () => {
    expectSameBehavior(roundTrip(reviewBoard), reviewBoard);
  });

  it('behave exactly like an app board written with deprecated fields and `next`', () => {
    expectSameBehavior(roundTrip(release), release);
  });

  it('drop only the handlers of a phase removed from the stored board', () => {
    const seed = seedFromDefinition(workBoard, 'builtin');
    const input: StoredBoardInput = {
      ...seed.input,
      phases: seed.input.phases
        .filter(phase => phase.key !== 'review')
        .map(phase => ({ ...phase, nextPhases: phase.nextPhases!.filter(key => key !== 'review') })),
    };

    const stored = compileStoredBoard(input, seed.behaviors);

    expect(stored.rules.review).toBeUndefined();
    expect(stored.rules.planning!.issue!.onEnter).toBe(workBoard.rules.planning!.issue!.onEnter);
    expect(stored.rules.execute!.issue!.onEnter).toBe(workBoard.rules.execute!.issue!.onEnter);
    expect(stored.transitionPolicy).toBe(workBoard.transitionPolicy);
  });

  it('run only the stored runner of a phase added to a seeded board', () => {
    const seed = seedFromDefinition(workBoard, 'builtin');
    const added: StoredPhaseInput = {
      key: 'qa',
      name: 'QA',
      kind: 'working',
      runner: { skill: 'qa-check', context: 'work' },
      nextPhases: ['done'],
    };

    const stored = compileStoredBoard({ ...seed.input, phases: [...seed.input.phases, added] }, seed.behaviors);

    for (const source of FACTORY_RULE_SOURCES) expect(stored.rules.qa![source]!.onEnter).toBeTypeOf('function');
    expect(stored.rules.qa!.issue!.onExit).toBeUndefined();
  });

  it('refuse an edit that leaves a code behavior pointing at a removed phase', () => {
    const seed = seedFromDefinition(workBoard, 'builtin');
    const input: StoredBoardInput = {
      ...seed.input,
      phases: seed.input.phases
        .filter(phase => phase.key !== 'canceled')
        .map(phase => ({ ...phase, nextPhases: phase.nextPhases!.filter(key => key !== 'canceled') })),
    };

    expect(() => compileStoredBoard(input, seed.behaviors)).toThrow(BoardDefinitionError);
    expect(() => compileStoredBoard(input, seed.behaviors)).toThrow(/sourceClosed.canceled "canceled"/);
    expect(() => compileStoredBoard(input)).not.toThrow();
  });
});

describe('seedFromDefinition', () => {
  it('refuses a board that was copied instead of passed as defineBoard() returned it', () => {
    const copy = { ...release } as InstalledBoard;

    expect(() => seedFromDefinition(copy, 'app')).toThrow(BoardDefinitionError);
    expect(() => seedFromDefinition(copy, 'app')).toThrow(
      'Board "release" was not built by defineBoard(); pass the board defineBoard() returned, not a copy.',
    );
  });

  it('lets an edit to a stored runner replace the skill the code board started', async () => {
    const board = defineBoard({
      id: 'runner-edit',
      name: 'Runner edit',
      initialPhase: 'inbox',
      phases: {
        inbox: { name: 'Inbox', kind: 'resting', nextPhases: ['doing'] },
        doing: {
          name: 'Doing',
          kind: 'working',
          runner: { skill: 'old-skill', instructions: 'Old text.' },
          nextPhases: ['done'],
        },
        done: { name: 'Done', kind: 'terminal' },
      },
    });
    const seed = seedFromDefinition(board, 'app');
    const edited: StoredBoardInput = {
      ...seed.input,
      phases: seed.input.phases.map(phase =>
        phase.key === 'doing' ? { ...phase, runner: { skill: 'new-skill', instructions: 'New text.' } } : phase,
      ),
    };

    const action = await compileStoredBoard(edited, seed.behaviors).rules.doing?.issue?.onEnter?.({
      ingress: { id: 'ingress-1' },
      item: { title: 'A card' },
      fromStage: 'inbox',
      stage: 'doing',
    } as never);

    expect(JSON.stringify(action)).toContain('new-skill');
    expect(JSON.stringify(action)).toContain('New text.');
    expect(JSON.stringify(action)).not.toContain('old-skill');
  });

  it('places the initial phase first and stores every phase’s next phases explicitly', () => {
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

    const seed = seedFromDefinition(board, 'app');

    expect(seed.input.phases.map(phase => [phase.key, phase.nextPhases])).toEqual([
      ['inbox', ['doing']],
      ['doing', ['done']],
      ['done', []],
    ]);
    const stored = compileStoredBoard(seed.input, seed.behaviors);
    expect(stored.initialPhase).toBe('inbox');
    expect(stored.allowsTransition('done', 'inbox')).toBe(false);
    expect(stored.roleForPhase('doing')).toBe('work');
  });

  it('hashes only the storable definition, independent of key order', () => {
    const one = seedFromDefinition(release, 'app');
    const reordered = reverseKeys(one.input) as StoredBoardInput;
    const sameDataOtherHandlers = defineBoard({
      id: 'release',
      name: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { name: 'Queued', kind: 'resting', nextPhases: ['preparing'] },
        preparing: {
          name: 'Preparing',
          kind: 'working',
          runner: { context: 'release-preparer' },
          nextPhases: ['shipping'],
          onEnter: { manual: () => undefined },
        },
        shipping: {
          name: 'Shipping',
          kind: 'working',
          runner: { context: 'release-publisher' },
          nextPhases: ['shipped'],
        },
        shipped: { name: 'Shipped', kind: 'terminal' },
      },
    });
    const renamed = {
      ...one.input,
      phases: one.input.phases.map(p => (p.key === 'shipped' ? { ...p, name: 'Out' } : p)),
    };

    expect(boardSeedHash(reordered)).toBe(one.hash);
    expect(seedFromDefinition(sameDataOtherHandlers, 'app').hash).toBe(one.hash);
    expect(boardSeedHash(renamed)).not.toBe(one.hash);
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

function reverseKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reverseKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, entry]) => [key, reverseKeys(entry)]),
  );
}

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
