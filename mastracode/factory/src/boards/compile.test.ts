import { describe, expect, it } from 'vitest';

import { compileStoredBoard } from './compile.js';
import { defineBoard } from './define-board.js';
import type { BoardPhaseDefinition, ReadonlyBoardPhaseHandlers } from './define-board.js';
import type { InstalledBoard } from './registry.js';
import { builtInRunners } from './runners.js';
import { workBoardTemplate } from './templates/work.js';
import { exitToolRule } from './work-tool-rules.js';
import { workTransitionPolicy } from './work-transition-policy.js';
import { workBoard } from './work.js';

function runner(id: string) {
  const found = builtInRunners.get(id);
  if (!found) throw new Error(`missing runner ${id}`);
  return found;
}

const enter = (id: string): ReadonlyBoardPhaseHandlers => runner(id).onEnter!;

const all = {
  intake: 'intake',
  triage: 'triage',
  planning: 'planning',
  execute: 'execute',
  review: 'review',
  done: 'done',
  canceled: 'canceled',
} as const;

type Phase = keyof typeof all;

/**
 * The Work board as code defined it before boards were stored: same titles,
 * kinds, roles, all-to-all outcomes, handlers per phase, tool rules,
 * policy and source-closed moves.
 */
const preRefactorWorkBoard = defineBoard<'work', Record<Phase, BoardPhaseDefinition<Phase>>>({
  id: 'work',
  title: 'Work',
  initialPhase: 'intake',
  transitionPolicy: workTransitionPolicy,
  sourceClosed: { completed: 'done', canceled: 'canceled' },
  tools: {
    submit_plan: exitToolRule({ tool: 'submit_plan', phase: 'planning', nextPhase: 'execute' }),
    factory_record_review_verdict: runner('factory-review').tools!.factory_record_review_verdict!,
  },
  phases: {
    intake: { title: 'Intake', kind: 'resting', outcomes: all },
    triage: { title: 'Triage', kind: 'working', role: 'triage', outcomes: all, onEnter: enter('factory-triage') },
    planning: { title: 'Planning', kind: 'working', role: 'plan', outcomes: all, onEnter: enter('factory-plan') },
    execute: { title: 'Building', kind: 'working', role: 'work', outcomes: all, onEnter: enter('factory-build') },
    review: { title: 'Review', kind: 'working', role: 'work', outcomes: all, onEnter: enter('factory-review') },
    done: { title: 'Done', kind: 'terminal', outcomes: all, onEnter: enter('factory-complete') },
    canceled: { title: 'Canceled', kind: 'terminal', outcomes: all },
  },
});

/** Everything the runtime reads from a board, with handlers kept by identity. */
function shape(board: InstalledBoard) {
  return {
    id: board.id,
    title: board.title,
    initialPhase: board.initialPhase,
    phases: Object.fromEntries(
      Object.entries(board.phases).map(([key, phase]) => [
        key,
        { title: phase.title, kind: phase.kind, role: board.roleForPhase(key) },
      ]),
    ),
    transitions: board.transitions,
    rules: board.rules,
    // Exit-tool rules are generated per board, so compare which tools end a phase.
    tools: Object.keys(board.tools).sort(),
    events: board.events,
    sourceClosed: board.sourceClosed,
    transitionPolicy: board.transitionPolicy,
  };
}

describe('compileStoredBoard', () => {
  it('compiles the stored Work template into the same board code used to define', () => {
    const compiled = compileStoredBoard(workBoardTemplate, builtInRunners);
    expect(shape(compiled)).toEqual(shape(preRefactorWorkBoard));
    expect(shape(workBoard)).toEqual(shape(preRefactorWorkBoard));
    expect(compiled.rules.triage?.issue?.onEnter).toBe(preRefactorWorkBoard.rules.triage?.issue?.onEnter);
    expect(compiled.rules.review?.manual?.onEnter).toBe(preRefactorWorkBoard.rules.review?.manual?.onEnter);
    expect(compiled.transitionPolicy).toBe(workTransitionPolicy);
  });

  it('notices when the template drifts from the code board', () => {
    const renamed = {
      ...workBoardTemplate,
      phases: workBoardTemplate.phases.map(phase => (phase.key === 'execute' ? { ...phase, key: 'build' } : phase)),
    };
    expect(shape(compileStoredBoard(renamed, builtInRunners))).not.toEqual(shape(preRefactorWorkBoard));

    const swapped = {
      ...workBoardTemplate,
      phases: workBoardTemplate.phases.map(phase =>
        phase.key === 'execute'
          ? { ...phase, runner: { type: 'workflow' as const, workflowId: 'factory-plan' } }
          : phase,
      ),
    };
    expect(shape(compileStoredBoard(swapped, builtInRunners))).not.toEqual(shape(preRefactorWorkBoard));
  });

  it('allows only the declared next phases when a phase lists them', () => {
    const board = compileStoredBoard(
      {
        key: 'flow',
        name: 'Flow',
        phases: [
          { key: 'open', name: 'Open', kind: 'resting', nextPhases: ['doing'] },
          { key: 'doing', name: 'Doing', kind: 'working', runner: { type: 'agent', agentId: 'factory-build' } },
          { key: 'closed', name: 'Closed', kind: 'terminal' },
        ],
      },
      builtInRunners,
    );
    expect(board.allowsTransition('open', 'doing')).toBe(true);
    expect(board.allowsTransition('open', 'closed')).toBe(false);
    expect(board.allowsTransition('doing', 'open')).toBe(true);
    expect(board.roleForPhase('doing')).toBe('work');
    expect(board.transitionPolicy).toBeUndefined();
    expect(board.sourceClosed).toBeUndefined();
  });

  it('runs nothing in a working phase whose runner is unknown and says so', () => {
    const warnings: string[] = [];
    const board = compileStoredBoard(
      {
        key: 'flow',
        name: 'Flow',
        phases: [
          { key: 'open', name: 'Open', kind: 'resting' },
          { key: 'doing', name: 'Doing', kind: 'working', runner: { type: 'workflow', workflowId: 'not-a-runner' } },
          { key: 'closed', name: 'Closed', kind: 'terminal' },
        ],
      },
      builtInRunners,
      { warn: message => warnings.push(message) },
    );
    expect(board.phaseKind('doing')).toBe('resting');
    expect(board.rules.doing).toBeUndefined();
    expect(warnings).toEqual(["Board 'flow' phase 'doing' names unknown runner 'not-a-runner'; it runs nothing."]);
  });

  it('runs a stored agent phase in its context with its skill and instructions, else in the main context', () => {
    const board = compileStoredBoard(
      {
        key: 'flow',
        name: 'Flow',
        phases: [
          { key: 'open', name: 'Open', kind: 'resting' },
          {
            key: 'docs',
            name: 'Docs',
            kind: 'working',
            runner: {
              type: 'agent',
              agentId: 'writer',
              skill: 'write-docs',
              instructions: 'Keep it short.',
              context: 'release-notes',
            },
          },
          {
            key: 'notes',
            name: 'Notes',
            kind: 'working',
            runner: { type: 'agent', agentId: 'writer', instructions: 'Add notes.' },
          },
          { key: 'closed', name: 'Closed', kind: 'terminal' },
        ],
      },
      builtInRunners,
    );
    const context = { ingress: { id: 'in-1' }, item: { title: 'Fix login', url: 'https://x/1' } } as never;
    expect(board.phaseKind('docs')).toBe('working');
    expect(board.rules.docs?.issue?.onEnter?.(context)).toEqual({
      type: 'invokeSkill',
      idempotencyKey: 'in-1:phase-docs',
      role: 'release-notes',
      skillName: 'write-docs',
      arguments: 'Work item: Fix login (https://x/1)\n\nKeep it short.',
    });
    expect(board.rules.notes?.manual?.onEnter?.(context)).toEqual({
      type: 'invokeSkill',
      idempotencyKey: 'in-1:phase-notes',
      role: 'work',
      prompt: 'Add notes.\n\nWork item: Fix login (https://x/1)',
    });
  });

  it('runs a default phase agent with the skill stored on it, keeping its built-in gating', async () => {
    const edited = {
      ...workBoardTemplate,
      phases: workBoardTemplate.phases.map(phase =>
        phase.key === 'planning' || phase.key === 'triage'
          ? { ...phase, runner: { ...phase.runner!, skill: 'our-planner' } }
          : phase,
      ),
    };
    const board = compileStoredBoard(edited, builtInRunners);
    const card = { ingress: { id: 'in-1' }, board: 'work', item: { title: 'Fix login', url: 'https://x/1' } };
    expect(await board.rules.planning?.issue?.onEnter?.(card as never)).toMatchObject({
      type: 'invokeSkill',
      role: 'plan',
      skillName: 'our-planner',
      arguments: 'Work item (https://x/1)',
    });
    // Triage still decides on its own when a pull request goes straight to Review.
    const pullRequest = { ...card, item: { ...card.item, metadata: { autoStartCandidate: true } } };
    expect(await board.rules.triage?.pullRequest?.onEnter?.(pullRequest as never)).toEqual({
      type: 'transition',
      idempotencyKey: 'in-1:start-review',
      board: 'work',
      stage: 'review',
    });
    expect(
      await board.rules.triage?.pullRequest?.onEnter?.({ ...card, item: { ...card.item, metadata: {} } } as never),
    ).toBeUndefined();
  });

  it("moves a default phase into another context while Review's reviewer keeps its own", async () => {
    const edited = {
      ...workBoardTemplate,
      phases: workBoardTemplate.phases.map(phase =>
        phase.key === 'planning' ? { ...phase, runner: { ...phase.runner!, context: null } } : phase,
      ),
    };
    const board = compileStoredBoard(edited, builtInRunners);
    const card = {
      ingress: { id: 'in-1' },
      board: 'work',
      item: { id: 'w-1', title: 'Fix login', url: 'https://x/1' },
    };
    // Planning now continues the builder's main context.
    expect(board.roleForPhase('planning')).toBe('work');
    expect(await board.rules.planning?.issue?.onEnter?.(card as never)).toMatchObject({
      type: 'invokeSkill',
      role: 'work',
      skillName: 'factory-plan',
    });
    // Review sits in the main context, yet a pull request is still reviewed apart from its builder.
    expect(board.roleForPhase('review')).toBe('work');
    const pullRequest = {
      ...card,
      item: { ...card.item, source: 'github-pr', metadata: { githubPullRequestNumber: 7 } },
    };
    expect(await board.rules.review?.pullRequest?.onEnter?.(pullRequest as never)).toMatchObject({ role: 'review' });
  });

  it('grants Factory tools by phase, from the phase’s runner and never from a context name', () => {
    const board = compileStoredBoard(
      {
        ...workBoardTemplate,
        phases: [
          ...workBoardTemplate.phases,
          {
            key: 'qa',
            name: 'QA',
            kind: 'working',
            runner: { type: 'agent', agentId: 'qa', skill: 'qa', context: 'review' },
          },
        ],
      },
      builtInRunners,
    );
    expect(board.toolsForPhase('triage')).toEqual(['triage']);
    expect(board.toolsForPhase('review')).toEqual(['review']);
    expect(board.toolsForPhase('execute')).toEqual([]);
    expect(board.toolsForPhase('qa')).toEqual([]);
  });
});
