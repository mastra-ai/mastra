import { describe, expect, it } from 'vitest';

import { createBoardRegistry } from '../boards/index.js';
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
  async function heldInIntakeThenMoved(skillName: string, role: string, to: string) {
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
    return decisionOvertaken({ boards: createBoardRegistry(), item: moved!.item, record, role, siblings: [record] });
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
});
