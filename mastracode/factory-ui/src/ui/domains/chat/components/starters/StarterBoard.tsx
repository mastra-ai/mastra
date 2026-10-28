import { useWorkItemsQuery } from '../../../../../hooks/useWorkItems';
import { useItemDecisions } from '../../../factory/hooks/useBoardDecisions';
import { starterPrompts } from '../../../factory/starterPrompts';
import { StarterCard } from './StarterCard';

export function StarterBoard({ factoryId }: { factoryId: string }) {
  const workItems = useWorkItemsQuery(factoryId);
  const decisions = useItemDecisions(factoryId);
  if (workItems.isPending || decisions.isPending) return null;
  const starters = starterPrompts({
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
