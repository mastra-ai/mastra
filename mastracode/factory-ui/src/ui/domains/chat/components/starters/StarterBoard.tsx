import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { useQuery } from '@tanstack/react-query';
import { useApiConfig } from '../../../../../api/config';
import { useBoardCatalog } from '../../../../../hooks/useBoardCatalog';
import { workItemStartersQueryOptions } from '../../../../../hooks/useWorkItems';
import { starterPrompts } from '../../../factory/starterPrompts';
import { StarterCard } from './StarterCard';

export function StarterBoard({ factoryId }: { factoryId: string }) {
  const { baseUrl } = useApiConfig();
  const counts = useQuery(workItemStartersQueryOptions(baseUrl, factoryId));
  const catalog = useBoardCatalog(factoryId);
  // A server too old to count starters answers 404: the page then offers none.
  if (!counts.data || catalog.isPending) return null;
  const starters = starterPrompts({
    board: catalog.data?.find(board => board.id === DEFAULT_BOARD_ID),
    starters: counts.data,
    now: new Date(counts.dataUpdatedAt),
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
