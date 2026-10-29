import { Notice } from '@mastra/playground-ui/components/Notice';
import type { ReactNode } from 'react';

import { useTerminalWorkItems } from '../../../../hooks/useTerminalWorkItems';
import type { BoardLayout } from '../boardLayout';
import type { WorkItem } from '../services/workItems';
import { BoardItemsSkeleton } from './BoardItemsSkeleton';
import { LoadMoreSentinel } from './LoadMoreSentinel';
import { VirtualBoardItems } from './VirtualBoardItems';

/**
 * The cards of a done or canceled column. The board snapshot does not carry
 * them, so the column reads its own pages once it is on screen; cards the
 * snapshot still lists in this phase (a move not yet refetched) stay on top.
 */
export function TerminalStageCards({
  factoryProjectId,
  board,
  stage,
  layout,
  enabled,
  liveItems,
  select,
  itemKey,
  pinnedKey,
  renderItem,
}: {
  factoryProjectId: string;
  board: string;
  stage: { id: string; label: string };
  layout: BoardLayout;
  /** Whether the column is open; a closed list group does not read its pages. */
  enabled: boolean;
  /** Cards the board snapshot still places in this phase, already filtered and ordered. */
  liveItems: readonly WorkItem[];
  /** Applies the board's filters and sort to a loaded page. */
  select: (items: readonly WorkItem[]) => WorkItem[];
  itemKey: (item: WorkItem) => string;
  pinnedKey?: string;
  renderItem: (item: WorkItem) => ReactNode;
}) {
  const page = useTerminalWorkItems({ factoryProjectId, board, stage: stage.id, enabled });
  const liveIds = new Set(liveItems.map(item => item.id));
  const items = [...liveItems, ...select(page.items.filter(item => !liveIds.has(item.id)))];
  const loading = enabled && page.isPending;
  return (
    <>
      <VirtualBoardItems
        items={items}
        itemKey={itemKey}
        layout={layout}
        pinnedKey={pinnedKey}
        renderItem={renderItem}
      />
      {loading && <BoardItemsSkeleton label={`Loading ${stage.label} column`} layout={layout} />}
      {page.error !== undefined && (
        <Notice variant="destructive" className="m-2">
          {page.error instanceof Error ? page.error.message : `Failed to load ${stage.label} cards`}
        </Notice>
      )}
      <LoadMoreSentinel
        hasNextPage={page.hasNextPage}
        isFetchingNextPage={page.isFetchingNextPage}
        onLoadMore={page.fetchNextPage}
        label={`Load more ${stage.label.toLowerCase()} cards`}
        loadingIndicator={<BoardItemsSkeleton label={`Loading more ${stage.label} cards`} rows={1} layout={layout} />}
      />
    </>
  );
}
