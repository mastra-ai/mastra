import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Whether the memory thread holds more than one trace, i.e. whether a "full thread" view would
 * show anything beyond the current turn. `false` while loading or on error, so the link only
 * appears once we know it leads somewhere.
 */
export function useThreadHasOtherTraces(threadId: string | undefined): boolean {
  const client = useMastraClient();
  const { data } = useQuery({
    queryKey: ['thread-trace-count', threadId],
    queryFn: () =>
      client.listTracesLight({
        filters: { threadId: threadId! },
        // Some stores apply metadata filters after paging, so a tiny page can miss sibling traces.
        // Match the page size the full thread view uses and count what actually comes back.
        pagination: { page: 0, perPage: 25 },
      }),
    enabled: !!threadId,
    select: response => (response.spans?.length ?? 0) > 1,
  });
  return data ?? false;
}
