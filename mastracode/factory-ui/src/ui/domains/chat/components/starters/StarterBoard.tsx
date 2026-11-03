import { useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../../api/config';
import { queryKeys } from '../../../../../api/keys';
import { getWorkItemStarters } from '../../../factory/services/workItems';
import { starterPrompts } from '../../../factory/starterPrompts';
import { StarterCard } from './StarterCard';

export function StarterBoard({ factoryId }: { factoryId: string }) {
  const { baseUrl } = useApiConfig();
  const counts = useQuery({
    queryKey: queryKeys.workItemStarters(factoryId),
    queryFn: ({ signal }) => getWorkItemStarters(baseUrl, factoryId, signal),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  if (!counts.data) return null;
  const starters = starterPrompts({ starters: counts.data, now: new Date(counts.dataUpdatedAt) });
  if (starters.length === 0) return null;
  return (
    <ul aria-label="Start from the board" className="m-0 grid list-none grid-cols-2 gap-0.5 p-0 md:grid-cols-6">
      {starters.map((starter, index) => (
        <StarterCard key={starter.kind} starter={starter} index={index} count={starters.length} />
      ))}
    </ul>
  );
}
