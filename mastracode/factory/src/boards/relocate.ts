import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { BoardRegistry } from './registry.js';

/** Rows that predate persisted boards used source-type routing. */
export function effectiveBoard(item: WorkItemRow): string {
  return item.board ?? (item.externalSource?.type === 'pull-request' ? 'review' : 'work');
}

/**
 * Put one card on `targetBoard`'s initial phase. Terminal cards and cards with a session attached to a
 * current stage stay put; so does a card that changed under us (a run started or someone moved it).
 */
export async function moveCardToBoard({
  workItems,
  boardRegistry,
  userId,
  item,
  targetBoard,
}: {
  workItems: Pick<WorkItemsStorage, 'update' | 'supersedeDecisionsForWorkItem'>;
  boardRegistry: BoardRegistry;
  userId: string;
  item: WorkItemRow;
  targetBoard: string;
}): Promise<'moved' | 'skipped' | 'unchanged'> {
  const target = boardRegistry.get(targetBoard);
  if (!target) return 'unchanged';
  const currentBoard = effectiveBoard(item);
  if (currentBoard === targetBoard) return 'unchanged';
  const current = boardRegistry.get(currentBoard);
  const movable = item.stages.every(
    stage => current?.phases[stage]?.kind !== 'terminal' && item.sessions[stage] === undefined,
  );
  if (!movable) return 'skipped';
  try {
    const updated = await workItems.update({
      orgId: item.orgId,
      id: item.id,
      userId,
      patch: { board: targetBoard, stages: [target.initialPhase] },
      expectedRevision: item.revision,
      expectedBoard: item.board,
    });
    if (!updated) return 'skipped';
    // Runs proposed by the old board's phases (e.g. Work's triage) mean nothing on the new board.
    await workItems.supersedeDecisionsForWorkItem({
      orgId: item.orgId,
      factoryProjectId: item.factoryProjectId,
      workItemId: item.id,
      supersededAt: new Date(),
    });
    return 'moved';
  } catch (error) {
    if (!(error instanceof WorkItemUpdateConflictError)) throw error;
    return 'skipped';
  }
}

export function cardLabels(item: WorkItemRow): string[] {
  const labels = item.metadata?.labels;
  return Array.isArray(labels) ? labels.filter((label): label is string => typeof label === 'string') : [];
}
