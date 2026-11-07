import { describe, expect, it } from 'vitest';

import { FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryRuleItemContext, FactoryRuleSource, FactoryStageRuleContext } from '../rules/types.js';
import type { StoredBoardInput, StoredPhaseInput } from '../storage/domains/boards/base.js';
import { createFactoryStorageForTests, createProviderWorkItemForTests } from '../storage/test-utils.js';
import { BoardDefinitionError, codeBoardOf, declarationOf, defineBoard } from './define-board.js';
import type { BoardPhaseDefinition } from './define-board.js';
import { workLaneForRole, workStageCarries } from './legacy-plan-role.js';
import { startsInAutoPhase } from './phase-automation.js';
import { createBoardRegistry } from './registry.js';
import type { InstalledBoard } from './registry.js';
import {
  boardDefinitionOf,
  codeBehaviourConflicts,
  compileStoredBoard,
  mergeCodeBehaviour,
  storedBoardInputSchema,
} from './stored-board.js';
import { workBoard } from './work.js';

const GO = {
  operator: 'AND' as const,
  conditions: [{ field: 'item.labels', operator: 'contains' as const, value: 'go' }],
};

describe('boardDefinitionOf', () => {
  it.each([['Work', workBoard]])(
    'describes the built-in %s board as a valid stored definition with the same phases',
    (_name, board) => {
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
    },
  );

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
    // An approved plan moves the card to Building in code, and a merged pull request closes its card.
    expect(
      conflicts(
        editWork('planning', phase => ({ ...phase, nextPhases: phase.nextPhases?.filter(next => next !== 'execute') })),
      ),
    ).toEqual(['Phase "planning": Factory\'s code moves cards from it to "execute"; keep it in nextPhases.']);
    expect(
      conflicts(
        editWork('pr-review', phase => ({ ...phase, nextPhases: ['intake', 'planning', 'execute', 'canceled'] })),
      ),
    ).toEqual(['Phase "pr-review": Factory\'s code moves cards from it to "done"; keep it in nextPhases.']);
    // An exit tool would hold back the moves Building's code makes.
    expect(conflicts(editWork('execute', phase => ({ ...phase, exitTool: { id: 'submit_plan' } })))).toEqual([
      'Phase "execute" code handlers move cards on without an exit tool; leave exitTool unset.',
    ]);

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
              ? { ...phase, autoStart: true, nextPhases: ['intake', 'planning', 'execute', 'done', 'canceled', 'docs'] }
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
    expect(board.allowsTransition('pr-review', 'docs')).toBe(true);
  });

  it('refuses to compile a conflicting edit against its code board', () => {
    expect(() =>
      compileStoredBoard(
        editWork('triage', phase => ({ ...phase, runner: { context: 'work' } })),
        workBoard,
      ),
    ).toThrow(BoardDefinitionError);
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

describe('serving a stored row that fell out of step with code', () => {
  it('serves a row that keeps its code shape exactly as the strict compile does', async () => {
    const row = editWork('triage', phase => ({
      ...phase,
      runner: { ...phase.runner, instructions: 'Shipyard: check the changelog.' },
    }));

    const { board, problems } = mergeCodeBehaviour(row, workBoard);
    const strict = compileStoredBoard(row, workBoard);

    expect(problems).toEqual([]);
    expect(boardDefinitionOf(board)).toEqual(boardDefinitionOf(strict));
    expect(board.transitions).toEqual(strict.transitions);
    expect(Object.keys(board.rules)).toEqual(Object.keys(strict.rules));
    expect(board.tools.submit_plan?.onResult).toBe(workBoard.tools.submit_plan?.onResult);
    expect(board.events).toEqual(strict.events);
    expect(board.sourceClosed).toEqual(strict.sourceClosed);
    expect(codeBoardOf(board)).toBe(workBoard);
    // #28876: the row's runner instructions reach Work's triage handler.
    const triage = await board.rules.triage?.issue?.onEnter?.(entering(board, 'triage', 'issue'));
    expect(triage).toMatchObject({ type: 'invokeSkill', role: 'triage', skillName: 'factory-triage' });
    expect(triage?.type === 'invokeSkill' && triage.arguments).toContain('Shipyard: check the changelog.');
  });

  it("serves a row missing a phase newer code declares, keeping the tool rules that hold Planning's approval", async () => {
    const declaration = declarationOf(workBoard)!;
    const newer = defineBoard({
      ...declaration,
      phases: {
        ...declaration.phases,
        testing: {
          name: 'Testing',
          kind: 'working',
          runner: { context: 'work' },
          nextPhases: ['done'],
          onEnter: { issue: () => undefined },
        },
      },
    } as Parameters<typeof defineBoard>[0]);
    const row = boardDefinitionOf(workBoard);

    expect(() => compileStoredBoard(row, newer)).toThrow(BoardDefinitionError);
    const { board, problems } = mergeCodeBehaviour(row, newer);

    expect(problems).toEqual([
      'Phase "testing" isn\'t on stored board "work", so its code behaviour doesn\'t run.',
      `Board "work" keeps its code tool rules (${Object.keys(workBoard.tools).join(', ')}), but can't move cards where they lead: phase "testing" isn't stored.`,
    ]);
    // The exit-tool approval guard keys off these rules: without them, a rule or agent could move
    // a card from Planning into Building without an approved plan.
    expect(board.tools.submit_plan?.onResult).toBe(workBoard.tools.submit_plan?.onResult);
    expect(board.phases).not.toHaveProperty('testing');
    expect(board.sourceClosed).toEqual({ completed: 'done', canceled: 'canceled' });
    const plan = await board.rules.planning?.issue?.onEnter?.(entering(board, 'planning', 'issue'));
    expect(plan).toMatchObject({ type: 'invokeSkill', role: 'work', skillName: 'factory-plan' });
    expect(codeBoardOf(board)).toBe(newer);
  });

  it('keeps a plan on a row missing a newer code phase waiting for approval', async () => {
    const declaration = declarationOf(workBoard)!;
    const newer = defineBoard({
      ...declaration,
      phases: {
        ...declaration.phases,
        testing: { name: 'Testing', kind: 'working', runner: { context: 'work' }, onEnter: { issue: () => undefined } },
      },
    } as Parameters<typeof defineBoard>[0]);
    const { board } = mergeCodeBehaviour(boardDefinitionOf(workBoard), newer);
    const storage = (await createFactoryStorageForTests()).workItems;
    const factoryProjectId = '11111111-2222-4333-8444-555555555555';
    const { item } = await storage.upsert({
      orgId: 'org-1',
      userId: 'user-1',
      factoryProjectId,
      input: { title: 'Fix the bug', stages: ['planning'], sessions: {}, metadata: {} },
    });
    const service = new FactoryTransitionService({
      configVersion: 'stale-row',
      storage,
      boards: createBoardRegistry({ boards: [board], includeDefaultBoards: false }),
    });

    const moved = await service.transition({
      orgId: 'org-1',
      factoryProjectId,
      workItemId: item.id,
      board: 'work',
      stage: 'execute',
      expectedRevision: item.revision,
      actor: { type: 'agent', bindingId: 'agent', role: 'work' },
      ingress: { type: 'agent', identity: 'agent-execute' },
      cause: 'test',
    });

    expect(moved).toMatchObject({ status: 'rejected', code: 'approval_required' });
    expect((await storage.get({ orgId: 'org-1', id: item.id }))?.stages).toEqual(['planning']);
  });

  it('serves a phase whose runner context changed without its code handlers, and keeps the other phases', async () => {
    const row = editWork('triage', phase => ({ ...phase, runner: { context: 'work' } }));

    const { board, problems } = mergeCodeBehaviour(row, workBoard);

    expect(problems).toEqual([
      'Phase "triage" runs without its code behaviour: Phase "triage" runs its code handlers in the "triage" context; keep runner.context.',
    ]);
    expect(board.rules.triage).toBeUndefined();
    expect(board.roleForPhase('triage')).toBe('work');
    const plan = await board.rules.planning?.issue?.onEnter?.(entering(board, 'planning', 'issue'));
    expect(plan).toMatchObject({ type: 'invokeSkill', role: 'work', skillName: 'factory-plan' });
    expect(board.tools.submit_plan?.onResult).toBe(workBoard.tools.submit_plan?.onResult);
  });

  it("serves a board whose Done is no longer terminal without sourceClosed, and keeps Work's other behaviour", async () => {
    const row = editWork('done', phase => ({ ...phase, kind: 'resting', nextPhases: ['pr-review'] }));

    const { board, problems } = mergeCodeBehaviour(row, workBoard);

    expect(problems).toEqual([
      'Phase "done" runs without its code behaviour: Phase "done" must stay terminal; its code behaviour depends on it.',
      'Board "work" doesn\'t move cards when their source closes: phase "done" isn\'t terminal.',
    ]);
    expect(board.phaseKind('done')).toBe('resting');
    expect(board.rules.done).toBeUndefined();
    expect(board.sourceClosed).toBeUndefined();
    const plan = await board.rules.planning?.issue?.onEnter?.(entering(board, 'planning', 'issue'));
    expect(plan).toMatchObject({ type: 'invokeSkill', role: 'work', skillName: 'factory-plan' });
    expect(board.tools.submit_plan?.onResult).toBe(workBoard.tools.submit_plan?.onResult);
    expect(codeBoardOf(board)).toBe(workBoard);
  });

  it('reports a move Factory code makes that the row no longer allows, and serves the row as stored', () => {
    const row = editWork('planning', phase => ({
      ...phase,
      nextPhases: workBoard.phases.planning.nextPhases.filter(next => next !== 'execute'),
    }));

    const { board, problems } = mergeCodeBehaviour(row, workBoard);

    expect(problems).toEqual([
      'Board "work" doesn\'t let phase "planning" move cards to "execute", so Factory\'s code can\'t make that move.',
    ]);
    expect(board.allowsTransition('planning', 'execute')).toBe(false);
    expect(board.rules.planning?.issue?.onEnter).toBeTypeOf('function');
  });

  describe('an app board with outcomes and exit handlers', () => {
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
    const withShipping = (edit: (phase: StoredPhaseInput) => StoredPhaseInput): StoredBoardInput => ({
      key: 'release',
      name: 'Release',
      phases: [
        { key: 'queued', name: 'Queued', kind: 'resting', nextPhases: ['shipping'] },
        edit({
          key: 'shipping',
          name: 'Shipping',
          kind: 'working',
          runner: { skill: 'ship-release', context: 'release' },
          nextPhases: ['archived'],
        }),
        { key: 'archived', name: 'Archived', kind: 'terminal' },
      ],
    });

    it("drops an outcome whose target the row no longer has, and keeps the phase's handlers", async () => {
      exited.length = 0;
      const { board, problems } = mergeCodeBehaviour(
        withShipping(phase => phase),
        app,
      );

      expect(problems).toEqual([
        'Phase "shipping" runs without its code outcome "shipped": phase "live" isn\'t stored.',
      ]);
      expect(board.transitions.shipping).toEqual([{ outcome: null, to: 'archived' }]);
      await board.rules.shipping?.manual?.onExit?.(entering(board, 'shipping', 'manual', { source: 'manual' }));
      expect(exited).toEqual(['shipping']);
      expect(codeBoardOf(board)).toBe(app);
    });

    it("drops an outcome whose move the row doesn't allow, instead of allowing it again", () => {
      const row = withShipping(phase => phase);
      row.phases.push({ key: 'live', name: 'Live', kind: 'terminal' });

      const { board, problems } = mergeCodeBehaviour(row, app);

      expect(problems).toEqual([
        'Phase "shipping" runs without its code outcome "shipped": the board doesn\'t let it move cards to "live".',
      ]);
      expect(board.allowsTransition('shipping', 'live')).toBe(false);
      expect(board.transitions.shipping).toEqual([{ outcome: null, to: 'archived' }]);
    });

    it('serves the phase without its handlers or outcomes once its skill changed', () => {
      const { board, problems } = mergeCodeBehaviour(
        withShipping(phase => ({ ...phase, runner: { skill: 'ship-it-fast', context: 'release' } })),
        app,
      );

      expect(problems).toEqual([
        'Phase "shipping" runs without its code behaviour: Phase "shipping" code handlers run with skill "ship-release"; keep runner.skill.',
      ]);
      expect(board.phases.shipping).not.toHaveProperty('onExit');
      expect(board.phases.shipping).not.toHaveProperty('outcomes');
      expect(board.rules.shipping?.manual?.onExit).toBeUndefined();
    });
  });
});

describe('the reviewer seat on an edited Work board', () => {
  const card = (board: string, stage: string) => ({
    board,
    externalSource: null,
    stages: [stage],
    title: 'Fix the crash',
    metadata: {},
    workItem: null,
  });
  const review = {
    type: 'invokeSkill',
    idempotencyKey: 'review-1',
    role: 'review',
    skillName: 'factory-self-review',
  } as const;

  it("starts self-review on its own once Work's Review phase starts on its own", () => {
    const edited = compileStoredBoard(
      editWork('review', phase => ({ ...phase, autoStart: true })),
      workBoard,
    );
    expect(
      startsInAutoPhase(
        createBoardRegistry({ boards: [edited], includeDefaultBoards: false }),
        card('work', 'review'),
        review,
      ),
    ).toBe(true);
    // The default Review phase still waits for a person.
    expect(startsInAutoPhase(createBoardRegistry(), card('work', 'review'), review)).toBe(false);
  });

  it('does not treat a stored board phase keyed pr-review as the reviewer seat', () => {
    const bugs = compileStoredBoard({
      key: 'bugs',
      name: 'Bugs',
      phases: [
        { key: 'reported', name: 'Reported', kind: 'resting' },
        { key: 'pr-review', name: 'PR review', kind: 'working', runner: { context: 'work' }, autoStart: true },
        { key: 'fixed', name: 'Fixed', kind: 'terminal' },
      ],
    });
    expect(
      startsInAutoPhase(
        createBoardRegistry({ boards: [bugs], includeDefaultBoards: false }),
        card('bugs', 'pr-review'),
        review,
      ),
    ).toBe(false);
  });
});
