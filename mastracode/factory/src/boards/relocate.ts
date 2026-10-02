import { WorkItemUpdateConflictError } from '../storage/domains/work-items/base.js';
import type { WorkItemRow, WorkItemsStorage } from '../storage/domains/work-items/base.js';
import type { BoardRegistry } from './registry.js';

/** Rows that predate persisted boards used source-type routing. */
export function effectiveBoard(item: WorkItemRow): string {
  return item.board ?? (item.externalSource?.type === 'pull-request' ? 'review' : 'work');
}

/**
 * Put one card on `targetBoard`, at `targetStage` or the board's initial phase. Terminal cards and
 * cards with a session attached to a current stage stay put; so does a card that changed under us
 * (a run started or someone moved it), a card already on the target board when no phase is named,
 * and a card already sitting at the named destination.
 */
export async function moveCardToBoard({
  workItems,
  boardRegistry,
  userId,
  item,
  targetBoard,
  targetStage,
}: {
  workItems: Pick<WorkItemsStorage, 'update' | 'supersedeDecisionsForWorkItem'>;
  boardRegistry: BoardRegistry;
  userId: string;
  item: WorkItemRow;
  targetBoard: string;
  /** Phase to file the card on; defaults to the target board's initial phase. */
  targetStage?: string;
}): Promise<'moved' | 'skipped' | 'unchanged'> {
  const target = boardRegistry.get(targetBoard);
  if (!target) return 'unchanged';
  const stage = targetStage ?? target.initialPhase;
  // An unknown phase is not a placement this board can hold.
  if (targetStage !== undefined && target.phases[targetStage] === undefined) return 'unchanged';
  const currentBoard = effectiveBoard(item);
  // A caller that names no phase is asking for the board's landing spot, and a
  // card already on that board is where it needs to be — dragging a card out of
  // a working phase back to the initial one is not what a rebind or a label
  // route change means. A named phase is a placement, so the destination being
  // identical — board *and* phase — is the only case with nothing to do.
  if (
    currentBoard === targetBoard &&
    (targetStage === undefined || (item.stages.length === 1 && item.stages[0] === stage))
  )
    return 'unchanged';
  const current = boardRegistry.get(currentBoard);
  // Sessions are keyed by the phase's role, not the phase id.
  const movable = item.stages.every(currentStage => {
    if (current?.phases[currentStage]?.kind === 'terminal') return false;
    const role = current?.roleForPhase(currentStage);
    return role === undefined || item.sessions[role] === undefined;
  });
  if (!movable) return 'skipped';
  try {
    const updated = await workItems.update({
      orgId: item.orgId,
      id: item.id,
      userId,
      patch: { board: targetBoard, stages: [stage] },
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
