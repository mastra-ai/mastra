import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { useWorkItemsQuery } from '../../../../../hooks/useWorkItems';
import { useItemDecisions } from '../../../factory/hooks/useBoardDecisions';
import { starterPrompts } from '../../../factory/starterPrompts';
import { StarterCard } from './StarterCard';

export function StarterBoard({ factoryId }: { factoryId: string }) {
  const workItems = useWorkItemsQuery(factoryId);
  const decisions = useItemDecisions(factoryId);
  const catalog = useBoardCatalog(factoryId);
  if (workItems.isPending || decisions.isPending || catalog.isPending) return null;
  const starters = starterPrompts({
    board: catalog.data?.find(board => board.id === DEFAULT_BOARD_ID),
    cards: workItems.data ?? [],
    effectByItem: decisions.effectByItem,
    now: new Date(workItems.dataUpdatedAt),
  });
  if (starters.length === 0) return null;
  return (
    <ul aria-label="Start from the board" className="m-0 grid list-none grid-cols-2 gap-0.5 p-0 md:grid-cols-6">
      {starters.map((starter, index) => (
        <StarterCard key={starter.kind} starter={starter} index={index} count={starters.length} />
      ))}
    </ul>
  );
}
