import { z } from 'zod/v4';
import { useLocalStorageState } from '@/hooks/use-local-storage-state';

const pinnedIdsSchema = z.array(z.string());

export const usePinnedThreads = (resourceType: 'agent' | 'network', resourceId: string) => {
  const [pinnedIds, setPinnedIds] = useLocalStorageState<string[]>({
    initialKey: `mastra:pinned-threads:${resourceType}:${resourceId}`,
    schema: pinnedIdsSchema,
    defaultValue: [],
  });

  const pin = (id: string) => setPinnedIds(ids => [id, ...ids.filter(pinned => pinned !== id)]);
  const unpin = (id: string) => setPinnedIds(ids => ids.filter(pinned => pinned !== id));

  return { pinnedIds, pin, unpin };
};
