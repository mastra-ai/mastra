import { describe, expect, it } from 'vitest';

import type { RuleGroup } from '../rules/rule-group.js';
import type { FactoryStageRuleContext, FactoryToolResultRuleContext } from '../rules/types.js';
import { cardRuleFacts } from './card-facts.js';
import { BoardDefinitionError, defineBoard } from './define-board.js';
import { workBoard } from './work.js';

const LOW_EFFORT: RuleGroup = {
  operator: 'AND',
  conditions: [{ field: 'item.labels', operator: 'contains', value: 'effort:low' }],
};

function stageContext(stage: string): Readonly<FactoryStageRuleContext> {
  return {
    ingress: { type: 'human', id: 'ingress-1' },
    item: { id: 'item-1', title: 'Fix retries', url: 'https://github.test/acme/repo/issues/7', stages: [stage] },
    source: 'issue',
    stage,
    fromStage: 'queued',
    toStage: stage,
  } as unknown as FactoryStageRuleContext;
}

function toolContext(
  stage: string,
  role: string,
  value: string,
  status: 'success' | 'error' = 'success',
): Readonly<FactoryToolResultRuleContext> {
  return {
    ingress: { type: 'toolResult', id: 'call-1' },
    item: { id: 'item-1', title: 'Fix retries', stages: [stage] },
    actor: { type: 'agent', bindingId: 'binding-1', role },
    toolName: 'submit_plan',
    result: { status, value },
  } as unknown as FactoryToolResultRuleContext;
}

const release = (phases: Record<string, unknown>) =>
  defineBoard({ id: 'release', name: 'Release', initialPhase: 'queued', phases: phases as never });

describe('defineBoard phase fields', () => {
  it('migrates an old-style board to the same board as its new-style declaration', () => {
    const legacy = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { title: 'Queued', kind: 'resting', next: 'shipping' },
        shipping: { title: 'Shipping', kind: 'working', role: 'review', next: 'shipped' },
        shipped: { title: 'Shipped', kind: 'terminal' },
      },
    });
    const current = defineBoard({
      id: 'release',
      name: 'Release',
      initialPhase: 'queued',
      phases: {
        queued: { name: 'Queued', kind: 'resting', nextPhases: ['shipping'] },
        shipping: { name: 'Shipping', kind: 'working', runner: { context: 'review' }, nextPhases: ['shipped'] },
        shipped: { name: 'Shipped', kind: 'terminal' },
      },
    });

    for (const board of [legacy, current]) {
      expect([board.name, board.title]).toEqual(['Release', 'Release']);
      expect(board.phases.shipping).toMatchObject({
        name: 'Shipping',
        title: 'Shipping',
        role: 'review',
        runner: { agentId: 'code-agent', context: 'review' },
        nextPhases: ['shipped'],
      });
      expect(board.allowsTransition('queued', 'shipping')).toBe(true);
      expect(board.allowsTransition('queued', 'shipped')).toBe(false);
      expect(board.roleForPhase('shipping')).toBe('review');
      expect(board.phaseForRole('review')).toBe('shipping');
    }
    expect(current.transitions).toEqual(legacy.transitions);
  });

  it('keeps the built-in Work board readable through both the old and new fields', () => {
    expect(workBoard.phases.planning).toMatchObject({ name: 'Planning', title: 'Planning', role: 'plan' });
    expect(workBoard.phases.planning.runner?.context).toBe('plan');
    expect(workBoard.phases.intake.nextPhases).toEqual(workBoard.transitions.intake.map(({ to }) => to));
  });

  it('accepts a defined board phase back as a declaration, as fixtures that extend a board do', () => {
    const copy = defineBoard({ id: 'copy', name: 'Copy', initialPhase: 'intake', phases: workBoard.phases });
    expect(copy.transitions).toEqual(workBoard.transitions);
    expect(copy.phases.review.role).toBe(workBoard.phases.review.role);
  });

  it('runs a working phase in the work context unless it names one, and rejects conflicting names', () => {
    const board = release({
      queued: { name: 'Queued', kind: 'resting', nextPhases: ['shipping'] },
      shipping: { name: 'Shipping', kind: 'working' },
    });
    expect(board.roleForPhase('shipping')).toBe('work');
    expect(() =>
      release({
        queued: { name: 'Queued', kind: 'resting' },
        shipping: { name: 'Shipping', kind: 'working', role: 'plan', runner: { context: 'build' } },
      }),
    ).toThrow(
      new BoardDefinitionError('Phase "shipping" sets both role and runner.context; drop the deprecated role.'),
    );
    expect(() => release({ queued: { name: 'Queued', title: 'Waiting', kind: 'resting' } })).toThrow(
      new BoardDefinitionError('Phase "queued" sets both name and title; drop the deprecated title.'),
    );
    expect(() => release({ queued: { kind: 'resting' } })).toThrow(
      new BoardDefinitionError('Phase "queued" must declare a name.'),
    );
    expect(() =>
      release({
        queued: { name: 'Queued', kind: 'resting' },
        shipping: { name: 'Shipping', kind: 'working', runner: { agentId: 'other-agent' } },
      }),
    ).toThrow(/names unknown agent "other-agent"; Factory runs "code-agent"/);
  });

  it('keeps working-phase fields off resting and terminal phases', () => {
    for (const field of [
      { runner: { skill: 'ship' } },
      { autoStart: true },
      { autoStartWhen: LOW_EFFORT },
      { exitTool: 'ship_it' },
    ]) {
      expect(() => release({ queued: { name: 'Queued', kind: 'resting', ...field } })).toThrow(
        `Phase "queued" is resting and cannot declare ${Object.keys(field)[0]}.`,
      );
    }
  });

  it('starts a phase on its own only when autoStart is set and its condition matches the card', () => {
    const board = release({
      queued: { name: 'Queued', kind: 'resting', nextPhases: ['always', 'lowEffort', 'manual'] },
      always: { name: 'Always', kind: 'working', autoStart: true },
      lowEffort: { name: 'Low effort', kind: 'working', autoStart: true, autoStartWhen: LOW_EFFORT },
      manual: { name: 'Manual', kind: 'working' },
    });
    const lowEffort = cardRuleFacts({ title: 'Fix', metadata: { labels: ['effort:low'] }, externalSource: null });
    const highEffort = cardRuleFacts({ title: 'Fix', metadata: { labels: ['effort:high'] }, externalSource: null });

    expect(board.startsAutomatically('always')).toBe(true);
    expect(board.startsAutomatically('lowEffort', lowEffort)).toBe(true);
    expect(board.startsAutomatically('lowEffort', highEffort)).toBe(false);
    expect(board.startsAutomatically('lowEffort')).toBe(false);
    expect(board.startsAutomatically('manual', lowEffort)).toBe(false);
    expect(board.startsAutomatically('queued', lowEffort)).toBe(false);
    expect(() =>
      release({
        queued: { name: 'Queued', kind: 'resting' },
        lowEffort: { name: 'Low effort', kind: 'working', autoStartWhen: LOW_EFFORT },
      }),
    ).toThrow('Phase "lowEffort" autoStartWhen needs autoStart.');
    expect(() =>
      release({
        queued: { name: 'Queued', kind: 'resting' },
        lowEffort: {
          name: 'Low effort',
          kind: 'working',
          autoStart: true,
          autoStartWhen: { operator: 'AND', conditions: [{ field: 'item.body', operator: 'exists' }] },
        },
      }),
    ).toThrow(/autoStartWhen is not a valid condition/);
  });

  it('moves the card to the first next phase when its context completes the exit tool', async () => {
    const board = release({
      queued: { name: 'Queued', kind: 'resting', nextPhases: ['planning'] },
      planning: {
        name: 'Planning',
        kind: 'working',
        runner: { context: 'build' },
        exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: LOW_EFFORT },
        nextPhases: ['building', 'queued'],
      },
      building: {
        name: 'Building',
        kind: 'working',
        runner: { context: 'build' },
        exitTool: 'ship_it',
        nextPhases: ['done'],
      },
      done: { name: 'Done', kind: 'terminal' },
    });
    expect(board.phases.planning.exitTool).toEqual({
      id: 'submit_plan',
      autoApprove: true,
      autoApproveWhen: LOW_EFFORT,
    });
    expect(board.phases.building.exitTool).toEqual({ id: 'ship_it', autoApprove: false });

    const planned = board.tools.submit_plan!.onResult;
    expect(await planned(toolContext('planning', 'build', 'Plan approved. Build it.'))).toEqual({
      type: 'transition',
      idempotencyKey: 'call-1:exit-planning',
      board: 'release',
      stage: 'building',
    });
    expect(await planned(toolContext('planning', 'build', 'Plan rejected: add tests.'))).toBeUndefined();
    expect(await planned(toolContext('planning', 'review', 'Plan approved.'))).toBeUndefined();
    expect(await planned(toolContext('building', 'build', 'Plan approved.'))).toBeUndefined();
    expect(await board.tools.ship_it!.onResult(toolContext('building', 'build', 'shipped'))).toMatchObject({
      stage: 'done',
    });
    expect(await board.tools.ship_it!.onResult(toolContext('building', 'build', 'boom', 'error'))).toBeUndefined();
  });

  it('rejects exit tools that cannot end a phase', () => {
    expect(() =>
      release({
        queued: { name: 'Queued', kind: 'resting' },
        stuck: { name: 'Stuck', kind: 'working', exitTool: 'ship_it' },
      }),
    ).toThrow('Phase "stuck" exit tool needs a next phase to move the card to.');
    expect(() =>
      release({
        queued: { name: 'Queued', kind: 'resting', nextPhases: ['moving'] },
        moving: { name: 'Moving', kind: 'working', exitTool: 'factory_transition_work_item', nextPhases: ['queued'] },
      }),
    ).toThrow('Phase "moving" cannot end with factory_transition_work_item: that tool already moves the card.');
    expect(() =>
      release({
        queued: { name: 'Queued', kind: 'resting', nextPhases: ['one'] },
        one: { name: 'One', kind: 'working', exitTool: 'ship_it', nextPhases: ['two'] },
        two: { name: 'Two', kind: 'working', exitTool: 'ship_it', nextPhases: ['queued'] },
      }),
    ).toThrow('Tool "ship_it" already has a rule on this board; Phase "two" cannot end with it.');
    expect(() =>
      release({
        queued: { name: 'Queued', kind: 'resting', nextPhases: ['one'] },
        one: {
          name: 'One',
          kind: 'working',
          exitTool: { id: 'ship_it', autoApproveWhen: LOW_EFFORT },
          nextPhases: ['queued'],
        },
      }),
    ).toThrow('Phase "one" exitTool.autoApproveWhen needs autoApprove.');
  });

  it('starts the runner skill for sources without a handler and adds instructions to every run', async () => {
    const board = release({
      queued: { name: 'Queued', kind: 'resting', nextPhases: ['shipping'] },
      shipping: {
        name: 'Shipping',
        kind: 'working',
        runner: { context: 'release', skill: 'release-notes', instructions: 'Keep it short.' },
        onEnter: {
          manual: () => ({ type: 'invokeSkill', idempotencyKey: 'manual', role: 'release', prompt: 'Ship it.' }),
        },
      },
    });

    expect(await board.rules.shipping!.issue!.onEnter!(stageContext('shipping'))).toEqual({
      type: 'invokeSkill',
      idempotencyKey: 'ingress-1:release-notes',
      role: 'release',
      skillName: 'release-notes',
      arguments: 'Work item (https://github.test/acme/repo/issues/7)\n\nKeep it short.',
    });
    expect(await board.rules.shipping!.manual!.onEnter!(stageContext('shipping'))).toMatchObject({
      prompt: 'Ship it.\n\nKeep it short.',
    });

    // Declaring the defined phase again, as a board that extends this one does, keeps one copy.
    const again = release({ queued: board.phases.queued, shipping: board.phases.shipping });
    expect(await again.rules.shipping!.manual!.onEnter!(stageContext('shipping'))).toMatchObject({
      prompt: 'Ship it.\n\nKeep it short.',
    });
    expect(() =>
      release({
        queued: { name: 'Queued', kind: 'resting' },
        shipping: { name: 'Shipping', kind: 'working', runner: { skill: 'Not A Skill' } },
      }),
    ).toThrow('Phase "shipping" runner.skill must be a skill name.');
  });
});
