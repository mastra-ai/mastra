import { describe, expect, it } from 'vitest';

import type { FactoryApprovalRecord, WorkItemRow } from '../storage/domains/work-items/base.js';
import { FACTORY_SUPERVISOR_INSTRUCTIONS } from './instructions.js';
import { buildFactorySupervisorState } from './state.js';

function item(id: string, stages: string[], type: 'issue' | 'pull-request' = 'issue'): WorkItemRow {
  return { id, stages, externalSource: { type } } as WorkItemRow;
}

function approval(index: number): FactoryApprovalRecord {
  return {
    id: `approval-${index}`,
    workItemId: `item-${index}`,
    requestedBoard: 'work',
    requestedStage: 'execute',
    expectedRevision: index,
    requestingActor: { type: 'agent', bindingId: `binding-${index}`, role: 'work' },
    reason: 'Ready',
    summary: null,
    createdAt: new Date('2026-07-22T00:00:00.000Z'),
  } as unknown as FactoryApprovalRecord;
}

describe('Factory supervisor contract', () => {
  it('instructs the model about tools, durable approvals, idle observations, and attribution limits', () => {
    expect(FACTORY_SUPERVISOR_INSTRUCTIONS).toContain('Use Factory tools');
    expect(FACTORY_SUPERVISOR_INSTRUCTIONS).toContain('pending_approval');
    expect(FACTORY_SUPERVISOR_INSTRUCTIONS).toContain('stale');
    expect(FACTORY_SUPERVISOR_INSTRUCTIONS).toMatch(/idle-without-transition/i);
    expect(FACTORY_SUPERVISOR_INSTRUCTIONS).toContain('never grants authority');
  });

  it('counts each item once at its current stage and caps approval details', () => {
    const state = buildFactorySupervisorState(
      'project-1',
      [
        item('one', ['intake', 'planning']),
        item('two', ['intake']),
        item('three', ['intake', 'review'], 'pull-request'),
      ],
      Array.from({ length: 60 }, (_, index) => approval(index)),
    );

    expect(state).toMatchObject({
      factoryProjectId: 'project-1',
      totalItems: 3,
      counts: {
        byBoard: { work: 2, review: 1 },
        byStage: { planning: 1, intake: 1, review: 1 },
      },
    });
    expect(state.pendingApprovals).toHaveLength(50);
  });
});
