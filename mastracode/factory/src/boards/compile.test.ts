import { describe, expect, it } from 'vitest';

import { compileStoredBoard } from './compile.js';
import { defineBoard } from './define-board.js';
import type { BoardPhaseDefinition, ReadonlyBoardPhaseHandlers } from './define-board.js';
import type { InstalledBoard } from './registry.js';
import { builtInRunners } from './runners.js';
import { workBoardTemplate } from './templates/work.js';
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
    submit_plan: runner('factory-plan').tools!.submit_plan!,
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
    tools: board.tools,
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
});
