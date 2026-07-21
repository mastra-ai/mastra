import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { queryKeys } from '../api/keys';
import { createAgentControllerClient } from '../../web/ui/domains/chat/services/agentControllerClient';

/**
 * Cap the initial transcript fetch so opening a long thread doesn't pull (and
 * render) its entire history at once, which freezes the browser. The message
 * list is not virtualized yet, so this bound is the primary guard against the
 * lag on long Mastra Code sessions.
 *
 * Older history is loaded on demand by *growing* this limit (100 -> 200 -> ...)
 * and refetching the newest-N window, which reuses the existing `limit`-only
 * `listMessages` surface without needing an offset/cursor param through core,
 * server, and the SDK. If a refetch returns exactly `limit` messages the thread
 * may have more older history; if it returns fewer we have reached the top.
 */
const DEFAULT_INITIAL_MESSAGE_LIMIT = 100;
const LOAD_MORE_PAGE_SIZE = 100;

interface UseAgentControllerThreadMessagesArgs {
  agentControllerId: string;
  resourceId: string;
  scope?: string;
  threadId?: string;
  baseUrl?: string;
  enabled?: boolean;
  initialLimit?: number;
  pageSize?: number;
}

export function useAgentControllerThreadMessages({
  agentControllerId,
  resourceId,
  scope,
  threadId,
  baseUrl = '',
  enabled = true,
  initialLimit = DEFAULT_INITIAL_MESSAGE_LIMIT,
  pageSize = LOAD_MORE_PAGE_SIZE,
}: UseAgentControllerThreadMessagesArgs) {
  const { session } = createAgentControllerClient({
    agentControllerId,
    resourceId,
    scope,
    baseUrl,
    enabled,
  });

  const [limit, setLimit] = useState(initialLimit);

  // Reset the window whenever we switch threads so each thread opens at the
  // initial cap rather than inheriting a grown limit from the previous thread.
  useEffect(() => {
    setLimit(initialLimit);
  }, [threadId, initialLimit]);

  const query = useQuery({
    queryKey: [...queryKeys.agentControllerThreadMessages(agentControllerId, resourceId, threadId), limit],
    queryFn: () => session!.listMessages(threadId!, limit),
    enabled: enabled && Boolean(session) && Boolean(threadId),
    refetchOnWindowFocus: false,
  });

  const loadedCount = query.data?.length ?? 0;
  // A full page means the window was saturated, so older history may exist. This
  // can produce one redundant "top" refetch when the thread length is an exact
  // multiple of the page size, which is harmless (it re-pulls the same rows).
  const hasMore = query.isSuccess && loadedCount >= limit;
  const isLoadingMore = query.isFetching && limit > initialLimit;

  const loadMore = useCallback(() => {
    if (query.isFetching) return;
    setLimit(prev => prev + pageSize);
  }, [query.isFetching, pageSize]);

  return {
    ...query,
    limit,
    hasMore,
    isLoadingMore,
    loadMore,
  };
}
