import { describe, expect, it, vi } from 'vitest';

import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import type { WorkItemRow } from '../storage/domains/work-items/base.js';
import { moveCardToBoard } from './relocate.js';
import { createTestBoard } from './test-utils.js';
import { createBoardRegistry } from './index.js';

function item(overrides: Partial<WorkItemRow> = {}): WorkItemRow {
  return {
    id: 'item-1',
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    board: 'work',
    externalSource: null,
    claimKey: null,
    parentWorkItemId: null,
    title: 'Card',
    stages: ['intake'],
    stageHistory: [],
    sessions: {},
    metadata: null,
    triageType: null,
    autonomyArmedAt: null,
    plansPreapprovedAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    updatedBy: 'user-1',
    sourceCreatedAt: null,
    acceptedAt: null,
    revision: 3,
    ...overrides,
  } as WorkItemRow;
}

function harness(row: WorkItemRow) {
  const update = vi.fn().mockResolvedValue({ item: row, previous: row });
  const supersedeDecisionsForWorkItem = vi.fn().mockResolvedValue(0);
  return {
    update,
    supersedeDecisionsForWorkItem,
    boards: createBoardRegistry({ boards: [createTestBoard()] }),
  };
}

describe('moveCardToBoard', () => {
  it('moves a card onto another phase of the same board', async () => {
    const row = item({ board: 'work', stages: ['intake'] });
    const { boards, update, supersedeDecisionsForWorkItem } = harness(row);

    await expect(
      moveCardToBoard({
        workItems: { update, supersedeDecisionsForWorkItem },
        boardRegistry: boards,
        userId: 'factory-rule-dispatcher',
        item: row,
        targetBoard: 'work',
        targetStage: 'planning',
      }),
    ).resolves.toBe('moved');

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        patch: { board: 'work', stages: ['planning'] },
        expectedRevision: 3,
        expectedBoard: 'work',
      }),
    );
    // The old phase's proposed runs mean nothing on the new one.
    expect(supersedeDecisionsForWorkItem).toHaveBeenCalledTimes(1);
  });

  it('treats a card already on the target phase as nothing to do', async () => {
    const row = item({ board: 'work', stages: ['planning'] });
    const { boards, update } = harness(row);

    await expect(
      moveCardToBoard({
        workItems: { update, supersedeDecisionsForWorkItem: vi.fn() },
        boardRegistry: boards,
        userId: 'dispatcher',
        item: row,
        targetBoard: 'work',
        targetStage: 'planning',
      }),
    ).resolves.toBe('unchanged');
    expect(update).not.toHaveBeenCalled();
  });

  it('treats a card already on the target board as nothing to do when no phase is named', async () => {
    const row = item({
      board: 'work',
      stages: ['execute'],
      sessions: { work: { threadId: 't', sessionId: 's', branch: 'b', startedBy: 'user-1' } },
    });
    const { boards, update } = harness(row);

    await expect(
      moveCardToBoard({
        workItems: { update, supersedeDecisionsForWorkItem: vi.fn() },
        boardRegistry: boards,
        userId: 'dispatcher',
        item: row,
        targetBoard: 'work',
      }),
    ).resolves.toBe('unchanged');
    expect(update).not.toHaveBeenCalled();
  });

  it('defaults to the target board initial phase when no stage is named', async () => {
    const row = item({ board: 'work', stages: ['triage'] });
    const { boards, update } = harness(row);

    await expect(
      moveCardToBoard({
        workItems: { update, supersedeDecisionsForWorkItem: vi.fn() },
        boardRegistry: boards,
        userId: 'dispatcher',
        item: row,
        targetBoard: 'release',
      }),
    ).resolves.toBe('moved');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ patch: { board: 'release', stages: ['queued'] } }));
  });

  it('refuses an unknown target phase', async () => {
    const row = item({ board: 'work', stages: ['intake'] });
    const { boards, update } = harness(row);

    await expect(
      moveCardToBoard({
        workItems: { update, supersedeDecisionsForWorkItem: vi.fn() },
        boardRegistry: boards,
        userId: 'dispatcher',
        item: row,
        targetBoard: 'work',
        targetStage: 'shipping',
      }),
    ).resolves.toBe('unchanged');
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves a card whose current phase has a session attached', async () => {
    const row = item({
      board: 'work',
      stages: ['execute'],
      sessions: { work: { threadId: 't', sessionId: 's', branch: 'b', startedBy: 'user-1' } },
    });
    const { boards, update } = harness(row);

    await expect(
      moveCardToBoard({
        workItems: { update, supersedeDecisionsForWorkItem: vi.fn() },
        boardRegistry: boards,
        userId: 'dispatcher',
        item: row,
        targetBoard: 'work',
        targetStage: 'planning',
      }),
    ).resolves.toBe('skipped');
    expect(update).not.toHaveBeenCalled();
  });

  it('leaves a terminal card alone', async () => {
    const row = item({ board: 'work', stages: ['done'] });
    const { boards, update } = harness(row);

    await expect(
      moveCardToBoard({
        workItems: { update, supersedeDecisionsForWorkItem: vi.fn() },
        boardRegistry: boards,
        userId: 'dispatcher',
        item: row,
        targetBoard: 'work',
        targetStage: 'planning',
      }),
    ).resolves.toBe('skipped');
    expect(update).not.toHaveBeenCalled();
  });

  it('reports a card that changed under it as skipped, without superseding', async () => {
    const row = item({ board: 'work', stages: ['intake'] });
    const { boards, supersedeDecisionsForWorkItem } = harness(row);
    const update = vi.fn().mockRejectedValue(new WorkItemUpdateConflictError('revision'));

    await expect(
      moveCardToBoard({
        workItems: { update, supersedeDecisionsForWorkItem },
        boardRegistry: boards,
        userId: 'dispatcher',
        item: row,
        targetBoard: 'work',
        targetStage: 'planning',
      }),
    ).resolves.toBe('skipped');
    expect(supersedeDecisionsForWorkItem).not.toHaveBeenCalled();
  });
});
