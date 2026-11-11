import { describe, expect, it } from 'vitest';

import type { FactoryStageRuleContext } from '../rules/types.js';
import { defineBoard } from './define-board.js';
import { phaseRunDecision } from './phase-runner.js';

const board = defineBoard({
  id: 'release',
  name: 'Release',
  initialPhase: 'queued',
  phases: {
    queued: { name: 'Queued', kind: 'resting', nextPhases: ['draft', 'check'] },
    draft: {
      name: 'Draft',
      kind: 'working',
      runner: {
        context: 'writer',
        skill: 'release-notes',
        instructions: 'Group by package.',
        goal: { objective: 'Notes cover every merged change.', maxRuns: 5 },
      },
      nextPhases: ['check', 'queued'],
    },
    check: {
      name: 'Check',
      kind: 'working',
      runner: { context: 'checker', skill: 'release-notes' },
      nextPhases: ['done', 'draft'],
    },
    seat: { name: 'Seat', kind: 'working', runner: { context: 'writer' }, nextPhases: ['done'] },
    done: { name: 'Done', kind: 'terminal' },
  },
});

function entering(
  fromStage: string,
  item: Partial<FactoryStageRuleContext['item']> = {},
): Pick<FactoryStageRuleContext, 'ingress' | 'item' | 'fromStage'> {
  return {
    ingress: { type: 'human', id: 'move-1' },
    fromStage,
    item: {
      id: 'item-1',
      source: 'manual',
      sourceKey: null,
      parentWorkItemId: null,
      title: 'v2 notes',
      url: 'https://example.test/cards/1',
      stages: [fromStage],
      acceptedAt: null,
      metadata: {},
      ...item,
    } as FactoryStageRuleContext['item'],
  };
}

describe('phaseRunDecision', () => {
  it("starts the runner's skill in its context with its instructions and goal on entry from another phase", () => {
    expect(phaseRunDecision(board, 'draft', entering('queued'))).toEqual({
      type: 'invokeSkill',
      idempotencyKey: 'move-1:draft:release-notes',
      role: 'writer',
      skillName: 'release-notes',
      arguments: 'Work item (https://example.test/cards/1)\n\nGroup by package.',
      startsAfterOwnMove: true,
      goal: { objective: 'Notes cover every merged change.', maxRuns: 5 },
    });
  });

  it('names the work item by title when it has no URL, and adds no instructions the runner lacks', () => {
    expect(phaseRunDecision(board, 'check', entering('draft', { url: null }))).toEqual({
      type: 'invokeSkill',
      idempotencyKey: 'move-1:check:release-notes',
      role: 'checker',
      skillName: 'release-notes',
      arguments: 'v2 notes',
      startsAfterOwnMove: true,
    });
  });

  it('keys two phases running the same skill from one move apart', () => {
    const draft = phaseRunDecision(board, 'draft', entering('queued'));
    const check = phaseRunDecision(board, 'check', entering('queued'));
    expect(draft?.idempotencyKey).not.toBe(check?.idempotencyKey);
  });

  it('supersedes the run in flight and resumes the skill when a card re-enters its phase', () => {
    expect(phaseRunDecision(board, 'draft', entering('draft'), { reenter: true })).toMatchObject({
      idempotencyKey: 'move-1:draft:release-notes',
      cancelInFlight: true,
      resume: true,
    });
    expect(phaseRunDecision(board, 'draft', entering('draft'), { reenter: true })).not.toHaveProperty(
      'startsAfterOwnMove',
    );
  });

  it('starts the runner on initial entry, without superseding anything', () => {
    const decision = phaseRunDecision(board, 'draft', entering('draft'), { initialEntry: true });
    expect(decision).toMatchObject({ skillName: 'release-notes', role: 'writer' });
    expect(decision).not.toHaveProperty('cancelInFlight');
    expect(decision).not.toHaveProperty('startsAfterOwnMove');
  });

  it('starts nothing for a replayed same-phase move, a runner with no skill, or a phase that is not working', () => {
    expect(phaseRunDecision(board, 'draft', entering('draft'))).toBeUndefined();
    expect(phaseRunDecision(board, 'seat', entering('queued'))).toBeUndefined();
    expect(phaseRunDecision(board, 'queued', entering('draft'))).toBeUndefined();
    expect(phaseRunDecision(board, 'done', entering('check'))).toBeUndefined();
    expect(phaseRunDecision(board, 'missing', entering('queued'))).toBeUndefined();
  });
});
