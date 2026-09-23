import type { WorkItem } from './services/workItems';
import type { BoardStageId } from './stages';

function columnPositionAt(item: WorkItem, stage: BoardStageId): string {
  let positionedAt: string | undefined;
  for (const entry of item.stageHistory) {
    if (entry.stage !== stage || (positionedAt !== undefined && entry.enteredAt <= positionedAt)) continue;
    positionedAt = entry.enteredAt;
  }
  return positionedAt ?? item.createdAt;
}

/** Most recently placed in this column first; creation time covers legacy cards without stage history. */
export function orderWorkItemsForStage(items: readonly WorkItem[], stage: BoardStageId): WorkItem[] {
  return items.toSorted(
    (left, right) =>
      columnPositionAt(right, stage).localeCompare(columnPositionAt(left, stage)) || right.id.localeCompare(left.id),
  );
}
