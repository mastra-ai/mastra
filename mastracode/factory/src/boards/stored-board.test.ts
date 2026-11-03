import { describe, expect, it } from 'vitest';

import type { FactoryRuleItemContext, FactoryRuleSource, FactoryStageRuleContext } from '../rules/types.js';
import type { StoredBoardInput, StoredPhaseInput } from '../storage/domains/boards/base.js';
import { createProviderWorkItemForTests } from '../storage/test-utils.js';
import { BoardDefinitionError, codeBoardOf, defineBoard } from './define-board.js';
import type { BoardPhaseDefinition } from './define-board.js';
import { workLaneForRole, workStageCarries } from './legacy-plan-role.js';
import type { InstalledBoard } from './registry.js';
import { reviewBoard } from './review.js';
import {
  boardDefinitionOf,
  codeBehaviourConflicts,
  codeBoardHash,
  compileStoredBoard,
  storedBoardInputSchema,
} from './stored-board.js';
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
      expect({ key: phase.key, name: phase.name, kind: phase.kind, nextPhases: phase.nextPhases }).toEqual({
        key: phase.key,
        name: code.name,
        kind: code.kind,
        nextPhases: [...code.nextPhases],
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

/** A card entering `stage` of `board` from `source`, as a phase's `onEnter` handler sees it. */
function entering(
  board: InstalledBoard,
  stage: string,
  source: FactoryRuleSource,
  item: Partial<FactoryRuleItemContext> = {},
): FactoryStageRuleContext {
  return {
    tenant: { orgId: 'org-1', projectId: 'project-1' },
    actor: { type: 'system', id: 'test' },
    ingress: { type: 'rule', id: 'ingress-1' },
    cause: 'test',
    causalChain: [],
    configVersion: 'test',
    item: {
      id: 'item-1',
      source: 'github-issue',
      sourceKey: 'source-1',
      parentWorkItemId: null,
      title: 'Fix the crash',
      url: 'https://github.com/acme/app/issues/3',
      stages: [stage],
      acceptedAt: null,
      metadata: {},
      workItem: createProviderWorkItemForTests({
        id: 'item-1',
        title: 'Fix the crash',
        source: { integrationId: 'github', type: 'issue', externalId: '3' },
        metadata: { identifier: 'acme/app#3' },
      }),
      ...item,
    },
    board: board.id,
    itemRevision: 1,
    source,
    stage,
    fromStage: board.initialPhase,
    toStage: stage,
  };
}

/** The built-in Work board's stored definition with `edit` applied to one phase. */
function editWork(key: string, edit: (phase: StoredPhaseInput) => StoredPhaseInput): StoredBoardInput {
  const definition = boardDefinitionOf(workBoard);
  return { ...definition, phases: definition.phases.map(phase => (phase.key === key ? edit(phase) : phase)) };
}

const EFFORT_LOW = {
  operator: 'AND' as const,
  conditions: [{ field: 'item.labels', operator: 'contains' as const, value: 'effort:low' }],
};

describe('stored boards with code behaviour', () => {
  it("runs the code board's declared handlers with the stored runner instructions", async () => {
    const edited = compileStoredBoard(
      editWork('triage', phase => ({
        ...phase,
        runner: { ...phase.runner, instructions: 'Shipyard: check the changelog.' },
      })),
      workBoard,
    );

    const decision = await edited.rules.triage?.issue?.onEnter?.(entering(edited, 'triage', 'issue'));
    expect(decision).toMatchObject({ type: 'invokeSkill', role: 'triage', skillName: 'factory-triage' });
    expect(decision?.type === 'invokeSkill' && decision.arguments).toContain('Shipyard: check the changelog.');
    // The code board itself is untouched.
    const code = await workBoard.rules.triage?.issue?.onEnter?.(entering(workBoard, 'triage', 'issue'));
    expect(code?.type === 'invokeSkill' && code.arguments).not.toContain('Shipyard');
  });

  it("keeps the code board's phase handlers, tool rules and source-closed phases", async () => {
    const edited = compileStoredBoard(
      editWork('planning', phase => ({ ...phase, name: 'Plan it' })),
      workBoard,
    );

    expect(edited.phases.planning.name).toBe('Plan it');
    const plan = await edited.rules.planning?.issue?.onEnter?.(entering(edited, 'planning', 'issue'));
    expect(plan).toMatchObject({ type: 'invokeSkill', role: 'work', skillName: 'factory-plan' });
    expect(edited.tools.submit_plan?.onResult).toBe(workBoard.tools.submit_plan?.onResult);
    expect(edited.tools.factory_record_review_verdict?.onResult).toBe(
      workBoard.tools.factory_record_review_verdict?.onResult,
    );
    expect(edited.sourceClosed).toEqual({ completed: 'done', canceled: 'canceled' });
    expect(edited.rules['pr-review']?.pullRequest?.onEnter).toBe(workBoard.rules['pr-review']?.pullRequest?.onEnter);
    expect(codeBoardOf(edited)).toBe(workBoard);
  });

  it('starts runs on their own only for cards the edited start condition matches', () => {
    expect(workBoard.startsAutomatically('planning', { 'item.labels': ['effort:low'] })).toBe(false);
    const edited = compileStoredBoard(
      editWork('planning', phase => ({ ...phase, autoStart: true, autoStartWhen: EFFORT_LOW })),
      workBoard,
    );

    expect(edited.startsAutomatically('planning', { 'item.labels': ['effort:low'] })).toBe(true);
    expect(edited.startsAutomatically('planning', { 'item.labels': [] })).toBe(false);
  });

  it("approves the exit tool on the card's behalf as the edit says", () => {
    const edited = compileStoredBoard(
      editWork('planning', phase => ({
        ...phase,
        exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: EFFORT_LOW },
      })),
      workBoard,
    );

    const planning = edited.phases.planning;
    expect(planning.kind === 'working' && planning.exitTool).toEqual({
      id: 'submit_plan',
      autoApprove: true,
      autoApproveWhen: EFFORT_LOW,
    });
  });

  it('reports every change code behaviour cannot honour', () => {
    const definition = boardDefinitionOf(workBoard);
    const conflicts = (input: StoredBoardInput) => codeBehaviourConflicts(input, workBoard);

    expect(conflicts({ ...definition, phases: definition.phases.filter(phase => phase.key !== 'planning') })).toEqual([
      'Phase "planning" has code behaviour on board "work"; it can\'t be removed.',
    ]);
    expect(conflicts(editWork('done', phase => ({ ...phase, kind: 'resting', nextPhases: ['pr-review'] })))).toEqual([
      'Phase "done" must stay terminal; its code behaviour depends on it.',
    ]);
    const [intake, triage, ...rest] = definition.phases;
    expect(conflicts({ ...definition, phases: [triage!, intake!, ...rest] })[0]).toBe(
      'Cards on board "work" start in "intake"; keep it the first phase.',
    );
    expect(conflicts(editWork('triage', phase => ({ ...phase, runner: { context: 'work' } })))).toEqual([
      'Phase "triage" runs its code handlers in the "triage" context; keep runner.context.',
    ]);
    expect(
      conflicts(editWork('planning', phase => ({ ...phase, runner: { context: 'work', skill: 'my-plan' } }))),
    ).toEqual(['Phase "planning" code handlers choose the skill; leave runner.skill unset.']);
    expect(conflicts(editWork('planning', phase => ({ ...phase, exitTool: { id: 'ship_it' } })))).toEqual([
      'Phase "planning" code behaviour waits for exit tool "submit_plan"; keep exitTool.id.',
    ]);
    expect(conflicts(editWork('planning', phase => ({ ...phase, exitTool: undefined })))).toHaveLength(1);

    const outcomes = defineBoard({
      id: 'outcomes',
      name: 'Outcomes',
      initialPhase: 'inbox',
      phases: {
        inbox: { name: 'Inbox', kind: 'resting', nextPhases: ['doing'] },
        doing: { name: 'Doing', kind: 'working', outcomes: { shipped: 'done' }, nextPhases: ['inbox'] },
        done: { name: 'Done', kind: 'terminal' },
      },
    });
    const outcomesDefinition = boardDefinitionOf(outcomes);
    expect(
      codeBehaviourConflicts(
        {
          ...outcomesDefinition,
          phases: outcomesDefinition.phases.map(phase =>
            phase.key === 'doing' ? { ...phase, nextPhases: ['inbox'] } : phase,
          ),
        },
        outcomes,
      ),
    ).toEqual(['Phase "doing" outcome "shipped" moves cards to "done"; keep it in nextPhases.']);
  });

  it('accepts every edit code behaviour can honour, including a new phase', () => {
    const definition = boardDefinitionOf(workBoard);
    const [intake, ...rest] = definition.phases;
    const edited: StoredBoardInput = {
      ...definition,
      name: 'Shipyard work',
      description: 'How Shipyard ships.',
      phases: [
        { ...intake!, name: 'Inbox', nextPhases: ['triage', 'planning', 'pr-review', 'done', 'canceled', 'docs'] },
        ...rest.reverse().map(phase =>
          phase.key === 'planning'
            ? {
                ...phase,
                description: 'Plan small changes on their own.',
                autoStart: true,
                autoStartWhen: EFFORT_LOW,
                exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: EFFORT_LOW },
                runner: { context: 'work', instructions: 'Keep plans short.' },
              }
            : phase.key === 'pr-review'
              ? { ...phase, autoStart: true, nextPhases: ['done', 'canceled'] }
              : phase,
        ),
        {
          key: 'docs',
          name: 'Docs',
          kind: 'working',
          runner: { skill: 'write-docs', context: 'docs' },
          nextPhases: ['done'],
        },
      ],
    };

    expect(codeBehaviourConflicts(edited, workBoard)).toEqual([]);
    const board = compileStoredBoard(edited, workBoard);
    expect(board.name).toBe('Shipyard work');
    expect(board.roleForPhase('docs')).toBe('docs');
    expect(board.allowsTransition('pr-review', 'intake')).toBe(false);
  });

  it('refuses to compile a conflicting edit against its code board', () => {
    expect(() =>
      compileStoredBoard(
        editWork('triage', phase => ({ ...phase, runner: { context: 'work' } })),
        workBoard,
      ),
    ).toThrow(BoardDefinitionError);
  });

  it('fingerprints a code board by its definition, not by key order', () => {
    const hash = codeBoardHash(workBoard);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(codeBoardHash(compileStoredBoard(boardDefinitionOf(workBoard), workBoard))).toBe(hash);

    const definition = boardDefinitionOf(workBoard);
    const reordered = compileStoredBoard(
      {
        phases: definition.phases.map(phase => Object.fromEntries(Object.entries(phase).reverse()) as StoredPhaseInput),
        name: definition.name,
        key: definition.key,
      },
      workBoard,
    );
    expect(codeBoardHash(reordered)).toBe(hash);

    const renamed = compileStoredBoard(
      editWork('planning', phase => ({ ...phase, name: 'Plan' })),
      workBoard,
    );
    expect(codeBoardHash(renamed)).not.toBe(hash);
  });

  it('merges an app board with outcomes and exit handlers the same way', async () => {
    const exited: string[] = [];
    const app = defineBoard({
      id: 'release',
      name: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { name: 'Queued', kind: 'resting', nextPhases: ['shipping'] },
        shipping: {
          name: 'Shipping',
          kind: 'working',
          runner: { skill: 'ship-release', context: 'release' },
          outcomes: { shipped: 'live' },
          onExit: {
            manual: context => {
              exited.push(context.stage);
              return undefined;
            },
          },
        },
        live: { name: 'Live', kind: 'terminal' },
      },
    });
    const definition = boardDefinitionOf(app);
    const edited = compileStoredBoard(
      {
        ...definition,
        phases: definition.phases.map(phase =>
          phase.key === 'shipping'
            ? { ...phase, runner: { ...phase.runner, instructions: 'Tag it.' }, autoStart: true }
            : phase,
        ),
      },
      app,
    );

    expect(edited.transitions.shipping).toEqual([{ outcome: 'shipped', to: 'live' }]);
    expect(edited.startsAutomatically('shipping')).toBe(true);
    const run = await edited.rules.shipping?.manual?.onEnter?.(
      entering(edited, 'shipping', 'manual', { source: 'manual' }),
    );
    expect(run).toMatchObject({ type: 'invokeSkill', role: 'release', skillName: 'ship-release' });
    expect(run?.type === 'invokeSkill' && run.arguments).toContain('Tag it.');
    await edited.rules.shipping?.manual?.onExit?.(entering(edited, 'shipping', 'manual', { source: 'manual' }));
    expect(exited).toEqual(['shipping']);
    expect(codeBoardOf(edited)).toBe(app);
  });

  it("keeps Work's planning and building lanes apart on an edited Work board", () => {
    const edited = compileStoredBoard(
      editWork('planning', phase => ({
        ...phase,
        name: 'Plan it',
        runner: { context: 'work', instructions: 'Short.' },
      })),
      workBoard,
    );

    for (const stage of Object.keys(workBoard.phases)) {
      for (const [role, skill] of [
        ['work', 'factory-plan'],
        ['work', 'factory-build'],
        ['plan', undefined],
        ['triage', 'factory-triage'],
        ['review', 'factory-self-review'],
      ] as const) {
        expect(workStageCarries(edited, stage, role, skill)).toBe(workStageCarries(workBoard, stage, role, skill));
      }
    }
    expect(workLaneForRole(edited, 'plan')).toBe(workLaneForRole(workBoard, 'plan'));
    expect(workStageCarries(compileStoredBoard(boardDefinitionOf(workBoard)), 'planning', 'work', 'factory-plan')).toBe(
      undefined,
    );
  });
});
