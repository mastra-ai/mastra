import { describe, expect, it } from 'vitest';

import { createBoardRegistry, defineBoard } from '../boards/index.js';
import type { BoardRegistry } from '../boards/index.js';
import { ProjectBoardCache } from '../boards/project-boards.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { decisionOvertaken, decisionRetryable } from './decision-applicability.js';

describe('decisionRetryable', () => {
  it('allows only failed, retryable, not-overtaken decisions', () => {
    expect(decisionRetryable({ status: 'failed', failureCode: 'session_unavailable' }, false)).toBe(true);
    expect(decisionRetryable({ status: 'failed', failureCode: null }, false)).toBe(true);
  });

  it.each(['pending', 'retry', 'leased', 'succeeded', 'superseded', 'proposed', 'dismissed'] as const)(
    'refuses a %s decision even though its failure code is empty',
    status => {
      expect(decisionRetryable({ status, failureCode: null }, false)).toBe(false);
    },
  );

  it.each(['run_overdue', 'skill_delivery_ambiguous', 'run_terminal_event_missing', 'repository_git_missing'] as const)(
    'refuses a failure a rerun cannot fix (%s)',
    failureCode => {
      expect(decisionRetryable({ status: 'failed', failureCode }, false)).toBe(false);
    },
  );

  it('refuses a failed decision whose card has moved on', () => {
    expect(decisionRetryable({ status: 'failed', failureCode: 'session_unavailable' }, true)).toBe(false);
  });
});

describe('decisionOvertaken on the Work board', () => {
  // Planning and Building share the `work` context, so the skill tells which lane a held run was for.
  async function heldInIntakeThenMoved(
    skillName: string,
    role: string,
    to: string,
    boards: BoardRegistry = createBoardRegistry(),
  ) {
    const { workItems } = await createFactoryStorageForTests();
    const scope = { orgId: 'org-1', userId: 'user-1' };
    const { item: created } = await workItems.upsert({
      ...scope,
      factoryProjectId: '11111111-2222-4333-8444-555555555555',
      input: {
        externalSource: { integrationId: 'github', type: 'issue', externalId: '1' },
        title: 'Fix the bug',
        stages: ['intake'],
        sessions: {},
        metadata: {},
      },
    });
    const record = {
      id: 'decision-1',
      evaluationId: 'evaluation-1',
      createdAt: new Date(),
      decision: { type: 'invokeSkill' as const, role, skillName, prompt: 'Go.' },
    };
    await new Promise(resolve => setTimeout(resolve, 5));
    const moved = await workItems.update({ ...scope, id: created.id, patch: { stages: [to] } });
    return decisionOvertaken({ boards, item: moved!.item, record, role, siblings: [record] });
  }

  it.each([
    ['a build held in Intake', 'factory-build', 'work', 'planning', true],
    ['a plan held in Intake', 'factory-plan', 'work', 'execute', true],
    ['a plan held in Intake', 'factory-plan', 'work', 'planning', false],
    ['a build held in Intake', 'factory-build', 'work', 'execute', false],
    ['a run held for the old plan role', 'factory-plan', 'plan', 'planning', false],
    ['a run held for the old plan role', 'factory-plan', 'plan', 'execute', true],
  ])('%s (%s, role %s) entering %s is overtaken: %s', async (_label, skillName, role, to, overtaken) => {
    expect(await heldInIntakeThenMoved(skillName, role, to)).toBe(overtaken);
  });

  it.each([
    ['factory-build', 'work', 'planning', true],
    ['factory-plan', 'work', 'execute', true],
    ['factory-plan', 'work', 'planning', false],
    ['factory-plan', 'plan', 'execute', true],
  ])(
    "judges %s (role %s) entering %s the same on a project's stored Work board: %s",
    async (skillName, role, to, overtaken) => {
      const { boards } = await createFactoryStorageForTests();
      const stored = await new ProjectBoardCache({ seedRegistry: createBoardRegistry(), storage: boards }).load({
        orgId: 'org-1',
        factoryProjectId: '11111111-2222-4333-8444-555555555555',
      });
      expect(stored.get('work')).not.toBe(createBoardRegistry().get('work'));
      expect(await heldInIntakeThenMoved(skillName, role, to, stored)).toBe(overtaken);
    },
  );

  it('matches a board installed as work in place of the built-in one by context, not by phase name', async () => {
    const replacement = createBoardRegistry({
      boards: [
        defineBoard({
          id: 'work',
          name: 'Work',
          initialPhase: 'intake',
          phases: {
            intake: { kind: 'resting', name: 'Intake', nextPhases: ['design', 'done'] },
            design: {
              kind: 'working',
              name: 'Design',
              runner: { context: 'work', skill: 'factory-plan' },
              nextPhases: ['done'],
            },
            done: { kind: 'terminal', name: 'Done' },
          },
        }),
      ],
      includeDefaultBoards: false,
    });
    expect(await heldInIntakeThenMoved('factory-plan', 'work', 'design', replacement)).toBe(false);
  });

  it('matches a replacement work board that reuses the Planning name by context too', async () => {
    const replacement = createBoardRegistry({
      boards: [
        defineBoard({
          id: 'work',
          name: 'Work',
          initialPhase: 'intake',
          phases: {
            intake: { kind: 'resting', name: 'Intake', nextPhases: ['planning', 'done'] },
            planning: {
              kind: 'working',
              name: 'Planning',
              runner: { context: 'work', skill: 'design' },
              nextPhases: ['done'],
            },
            done: { kind: 'terminal', name: 'Done' },
          },
        }),
      ],
      includeDefaultBoards: false,
    });
    // Built-in Work would hand Planning only factory-plan runs; this board runs its own skill there.
    expect(await heldInIntakeThenMoved('design', 'work', 'planning', replacement)).toBe(false);
  });
});
