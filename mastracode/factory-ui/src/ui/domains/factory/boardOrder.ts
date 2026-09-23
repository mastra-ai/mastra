import type { WorkItem, WorkItemStageEntry } from './services/workItems';
import type { BoardStageId } from './stages';

export type BoardSort = 'recent' | 'recent-mine' | 'created-newest' | 'created-oldest';

function latestColumnEntry(item: WorkItem, stage: BoardStageId): WorkItemStageEntry | undefined {
  let latest: WorkItemStageEntry | undefined;
  for (const entry of item.stageHistory) {
    if (entry.stage !== stage || (latest !== undefined && entry.enteredAt <= latest.enteredAt)) continue;
    latest = entry;
  }
  return latest;
}

function columnPositionAt(item: WorkItem, stage: BoardStageId): string {
  return latestColumnEntry(item, stage)?.enteredAt ?? item.createdAt;
}

/** Orders persisted cards using Factory-owned timestamps; provider update clocks never participate. */
export function orderWorkItemsForStage(
  items: readonly WorkItem[],
  stage: BoardStageId,
  sort: BoardSort = 'recent',
  currentUserId?: string,
): WorkItem[] {
  return items.toSorted((left, right) => {
    if (sort === 'recent-mine' && currentUserId) {
      const leftMine = latestColumnEntry(left, stage)?.by === currentUserId;
      const rightMine = latestColumnEntry(right, stage)?.by === currentUserId;
      if (leftMine !== rightMine) return rightMine ? 1 : -1;
    }
    if (sort === 'created-newest' || sort === 'created-oldest') {
      const direction = sort === 'created-newest' ? -1 : 1;
      return left.createdAt.localeCompare(right.createdAt) * direction || right.id.localeCompare(left.id);
    }
    return (
      columnPositionAt(right, stage).localeCompare(columnPositionAt(left, stage)) || right.id.localeCompare(left.id)
    );
  });
}
