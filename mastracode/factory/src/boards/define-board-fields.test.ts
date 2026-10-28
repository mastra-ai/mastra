import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { RuleGroup } from '../rules/rule-group.js';
import type { FactoryStageRuleContext } from '../rules/types.js';
import { cardRuleFacts } from './card-facts.js';
import { BoardDefinitionError, defineBoard } from './define-board.js';
import { reviewBoard } from './review.js';
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
    fromStage: 'backlog',
    toStage: stage,
  } as unknown as FactoryStageRuleContext;
}

const release = (phases: Record<string, unknown>) =>
  defineBoard({ id: 'release', name: 'Release', initialPhase: 'backlog', phases: phases as never });

describe('defineBoard phase fields', () => {
  it('migrates an old-style board to the same board as its new-style declaration', () => {
    const legacy = defineBoard({
      id: 'release',
      title: 'Release',
      initialPhase: 'backlog',
      phases: {
        backlog: { title: 'Backlog', kind: 'resting', next: 'build' },
        build: { title: 'Build', kind: 'working', role: 'review', next: 'done' },
        done: { title: 'Done', kind: 'terminal' },
      },
    });
    const current = defineBoard({
      id: 'release',
      name: 'Release',
      initialPhase: 'backlog',
      phases: {
        backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['build'] },
        build: { name: 'Build', kind: 'working', runner: { context: 'review' }, nextPhases: ['done'] },
        done: { name: 'Done', kind: 'terminal' },
      },
    });

    for (const board of [legacy, current]) {
      expect(board.name).toBe('Release');
      expect(board).not.toHaveProperty('title');
      expect(board.phases.build).not.toHaveProperty('title');
      expect(board.phases.build).not.toHaveProperty('role');
      expect(board.phases.backlog).not.toHaveProperty('next');
      expect(board.phases.build).toMatchObject({
        name: 'Build',
        runner: { agentId: 'code-agent', context: 'review' },
        nextPhases: ['done'],
      });
      expect(board.allowsTransition('backlog', 'build')).toBe(true);
      expect(board.allowsTransition('backlog', 'done')).toBe(false);
      expect(board.roleForPhase('build')).toBe('review');
      expect(board.phaseForRole('review')).toBe('build');
    }
    expect(current.transitions).toEqual(legacy.transitions);
  });

  it('keeps the built-in Work board contexts as the old role names', () => {
    expect(workBoard.phases.planning).toMatchObject({ name: 'Planning', runner: { context: 'plan' } });
    expect(workBoard.phases.intake.nextPhases).toEqual(workBoard.transitions.intake.map(({ to }) => to));
  });

  it('accepts a defined board phase back as a declaration, as fixtures that extend a board do', () => {
    const copy = defineBoard({ id: 'copy', name: 'Copy', initialPhase: 'intake', phases: workBoard.phases });
    expect(copy.transitions).toEqual(workBoard.transitions);
    expect(copy.phases.review).toMatchObject({ kind: 'working', runner: { context: 'work' } });
    expect(copy.phases.review).not.toHaveProperty('role');
  });

  it('lists each next phase once when several outcomes lead to it', () => {
    const board = defineBoard({
      id: 'twice',
      name: 'Twice',
      initialPhase: 'backlog',
      phases: {
        backlog: { name: 'Backlog', kind: 'resting', outcomes: { ship: 'done', finish: 'done' } },
        done: { name: 'Done', kind: 'terminal' },
      },
    });
    expect(board.phases.backlog.nextPhases).toEqual(['done']);
  });

  it('runs a working phase in the work context unless it names one, and rejects conflicting names', () => {
    const board = release({
      backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['build'] },
      build: { name: 'Build', kind: 'working' },
    });
    expect(board.roleForPhase('build')).toBe('work');
    expect(() =>
      release({
        backlog: { name: 'Backlog', kind: 'resting' },
        build: { name: 'Build', kind: 'working', role: 'plan', runner: { context: 'build' } },
      }),
    ).toThrow(new BoardDefinitionError('Phase "build" sets both role and runner.context; drop the deprecated role.'));
    expect(() => release({ backlog: { name: 'Backlog', title: 'Waiting', kind: 'resting' } })).toThrow(
      new BoardDefinitionError('Phase "backlog" sets both name and title; drop the deprecated title.'),
    );
    expect(() => release({ backlog: { kind: 'resting' } })).toThrow(
      new BoardDefinitionError('Phase "backlog" must declare a name.'),
    );
    expect(() =>
      release({
        backlog: { name: 'Backlog', kind: 'resting' },
        build: { name: 'Build', kind: 'working', runner: { agentId: 'other-agent' } },
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
      expect(() => release({ backlog: { name: 'Backlog', kind: 'resting', ...field } })).toThrow(
        `Phase "backlog" is resting and cannot declare ${Object.keys(field)[0]}.`,
      );
    }
  });

  it('starts a phase on its own only when autoStart is set and its condition matches the card', () => {
    const board = release({
      backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['always', 'lowEffort', 'manual'] },
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
    expect(board.startsAutomatically('backlog', lowEffort)).toBe(false);
    expect(() =>
      release({
        backlog: { name: 'Backlog', kind: 'resting' },
        lowEffort: { name: 'Low effort', kind: 'working', autoStartWhen: LOW_EFFORT },
      }),
    ).toThrow('Phase "lowEffort" autoStartWhen needs autoStart.');
    expect(() =>
      release({
        backlog: { name: 'Backlog', kind: 'resting' },
        lowEffort: {
          name: 'Low effort',
          kind: 'working',
          autoStart: true,
          autoStartWhen: { operator: 'AND', conditions: [{ field: 'item.body', operator: 'exists' }] },
        },
      }),
    ).toThrow(/autoStartWhen is not a valid condition/);
  });

  it('keeps the exit tool on the phase and adds no rule that moves the card', async () => {
    const board = release({
      backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['planning'] },
      planning: {
        name: 'Planning',
        kind: 'working',
        runner: { context: 'build' },
        exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: LOW_EFFORT },
        nextPhases: ['building', 'backlog'],
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

    // The exit tool does not move the card; the agent does, with factory_transition_work_item.
    expect(board.tools).toEqual({});
    expect(board.phases.planning.nextPhases).toEqual(['building', 'backlog']);
  });

  it('lets a board that keeps the built-in Work tool rules end Planning with submit_plan', () => {
    const board = defineBoard({
      id: 'work-plus',
      name: 'Work plus',
      initialPhase: 'intake',
      tools: workBoard.tools,
      phases: {
        ...workBoard.phases,
        planning: {
          ...workBoard.phases.planning,
          exitTool: { id: 'submit_plan', autoApprove: true, autoApproveWhen: LOW_EFFORT },
        },
      },
    });
    expect(board.tools).toEqual(workBoard.tools);
    expect(board.phases.planning).toMatchObject({ exitTool: { id: 'submit_plan', autoApprove: true } });
  });

  it('rejects exit tools that cannot end a phase', () => {
    expect(() =>
      release({
        backlog: { name: 'Backlog', kind: 'resting' },
        stuck: { name: 'Stuck', kind: 'working', exitTool: 'ship_it' },
      }),
    ).toThrow('Phase "stuck" exit tool needs a next phase to move the card to.');
    expect(() =>
      release({
        backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['moving'] },
        moving: { name: 'Moving', kind: 'working', exitTool: 'factory_transition_work_item', nextPhases: ['backlog'] },
      }),
    ).toThrow('Phase "moving" cannot end with factory_transition_work_item: that tool already moves the card.');
    expect(() =>
      release({
        backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['one'] },
        one: {
          name: 'One',
          kind: 'working',
          exitTool: { id: 'ship_it', autoApproveWhen: LOW_EFFORT },
          nextPhases: ['backlog'],
        },
      }),
    ).toThrow('Phase "one" exitTool.autoApproveWhen needs autoApprove.');
  });

  it('starts the runner skill for sources without a handler and adds instructions to every run', async () => {
    const board = release({
      backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['build'] },
      build: {
        name: 'Build',
        kind: 'working',
        runner: { context: 'release', skill: 'release-notes', instructions: 'Keep it short.' },
        onEnter: {
          manual: () => ({ type: 'invokeSkill', idempotencyKey: 'manual', role: 'release', prompt: 'Ship it.' }),
        },
      },
    });

    expect(await board.rules.build!.issue!.onEnter!(stageContext('build'))).toEqual({
      type: 'invokeSkill',
      idempotencyKey: 'ingress-1:release-notes',
      role: 'release',
      skillName: 'release-notes',
      arguments: 'Work item (https://github.test/acme/repo/issues/7)\n\nKeep it short.',
    });
    expect(await board.rules.build!.manual!.onEnter!(stageContext('build'))).toMatchObject({
      prompt: 'Ship it.\n\nKeep it short.',
    });

    // Declaring the defined phase again, as a board that extends this one does, keeps one copy.
    const again = release({ backlog: board.phases.backlog, build: board.phases.build });
    expect(await again.rules.build!.manual!.onEnter!(stageContext('build'))).toMatchObject({
      prompt: 'Ship it.\n\nKeep it short.',
    });
    expect(() =>
      release({
        backlog: { name: 'Backlog', kind: 'resting' },
        build: { name: 'Build', kind: 'working', runner: { skill: 'Not A Skill' } },
      }),
    ).toThrow('Phase "build" runner.skill must be a skill name.');
  });

  it('warns once per board that still uses deprecated fields', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    const legacy = {
      id: 'legacy-release',
      title: 'Release',
      initialPhase: 'backlog',
      phases: {
        backlog: { title: 'Backlog', kind: 'resting', next: 'build' },
        build: { title: 'Build', kind: 'working', role: 'publisher', outcomes: { done: 'done' } },
        done: { title: 'Done', kind: 'terminal' },
      },
    } as const;

    defineBoard(legacy);
    defineBoard(legacy);

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toBe(
      '[Mastra Factory] Board "legacy-release" uses deprecated fields: title → name, phases.backlog.title → name, ' +
        'phases.backlog.next → nextPhases, phases.build.title → name, phases.build.role → runner.context, ' +
        'phases.done.title → name. They still work but will be removed in a future release.',
    );
  });

  it('stays quiet for new fields, built-in boards and defined phases declared again', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());

    defineBoard({
      id: 'current-release',
      name: 'Release',
      initialPhase: 'backlog',
      phases: {
        backlog: { name: 'Backlog', kind: 'resting', nextPhases: ['build'] },
        build: {
          name: 'Build',
          kind: 'working',
          runner: { context: 'publisher' },
          outcomes: { done: 'done' },
        },
        done: { name: 'Done', kind: 'terminal' },
      },
    });
    defineBoard({ id: 'work-again', name: 'Work', initialPhase: 'intake', phases: workBoard.phases });
    defineBoard({ id: 'review-again', name: 'Review', initialPhase: 'intake', phases: reviewBoard.phases });

    expect(warn).not.toHaveBeenCalled();
  });

  it('defines the built-in boards without deprecated fields', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    onTestFinished(() => warn.mockRestore());
    vi.resetModules();

    await import('./work.js');
    await import('./review.js');

    expect(warn).not.toHaveBeenCalled();
  });
});
