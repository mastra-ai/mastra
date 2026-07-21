import { useQuery } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { INITIAL_THREAD_MESSAGE_LIMIT, queryKeys } from '../api/keys';
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
const DEFAULT_INITIAL_MESSAGE_LIMIT = INITIAL_THREAD_MESSAGE_LIMIT;
const LOAD_MORE_PAGE_SIZE = INITIAL_THREAD_MESSAGE_LIMIT;

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
  // Tracks the (threadId, initialLimit) the current `limit` was seeded for so a
  // change can be detected during render.
  const [windowKey, setWindowKey] = useState({ threadId, initialLimit });

  // Reset the window synchronously during render when the thread (or the initial
  // cap) changes. This hook instance is NOT remounted on thread switch — only
  // its downstream provider is keyed — so an effect-based reset would run one
  // render too late, firing the very first query for the new thread with the
  // previous thread's grown limit (re-introducing the large fetch this cap is
  // meant to prevent). Adjusting state during render is the supported pattern
  // for deriving state from props.
  if (windowKey.threadId !== threadId || windowKey.initialLimit !== initialLimit) {
    setWindowKey({ threadId, initialLimit });
    setLimit(initialLimit);
  }

  // Prefix without the limit — used to detect "same thread" for placeholder data.
  const threadKey = queryKeys.agentControllerThreadMessages(agentControllerId, resourceId, threadId);

  const query = useQuery({
    queryKey: queryKeys.agentControllerThreadMessages(agentControllerId, resourceId, threadId, limit),
    queryFn: () => session!.listMessages(threadId!, limit),
    enabled: enabled && Boolean(session) && Boolean(threadId),
    refetchOnWindowFocus: false,
    // Growing the limit changes the query key, which would otherwise flip the
    // query back to `pending` and blank the transcript to a skeleton on every
    // load-more. That blank also collapses the scroll container to the top,
    // which re-triggers load-more in a runaway loop. Keeping the previous
    // window's data on screen while the larger one fetches avoids the remount
    // (only the newly revealed older messages get prepended). Scoped to the same
    // thread by comparing the key prefix: switching threads is a real pending
    // state, so we don't carry the previous thread's messages over.
    placeholderData: (previous, previousQuery) => {
      const previousKey = previousQuery?.queryKey as readonly unknown[] | undefined;
      const sameThread = previousKey ? threadKey.every((part, i) => previousKey[i] === part) : false;
      return sameThread ? previous : undefined;
    },
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
