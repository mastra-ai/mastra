import { MastraClientError } from '@mastra/client-js';
import type {
  KnowledgeActivityResponse,
  KnowledgeGraphResponse,
  KnowledgePageResponse,
  KnowledgeSearchResponse,
  KnowledgeTreeResponse,
} from '@mastra/client-js';
import type { KnowledgeExplorerTreeRequest } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import { useMastraClient } from '@mastra/react';
import { keepPreviousData, skipToken, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { createBurstRefresh } from './burst-refresh';

const MIN_SEARCH_LENGTH = 2;

/**
 * Agents write Knowledge while Studio is open. The page follows the server's change stream; when it
 * can't (an older server, or the stream dropped) the open queries poll at this interval instead.
 */
const POLL_MS = 5_000;
/**
 * The stream carries writes made in the server process Studio is connected to. Behind a load balancer,
 * writes on another replica are not on it, so a slow poll still catches those.
 */
const LIVE_POLL_MS = 60_000;
const RECONNECT_MS = 5_000;
/** A burst of writes (a page and its notes) refetches once. */
const REFRESH_DEBOUNCE_MS = 150;
/** A steady stream of writes (an import) still refetches this often, so the view follows it. */
const REFRESH_MAX_WAIT_MS = 750;

const pollUnless = (live: boolean) => (live ? LIVE_POLL_MS : POLL_MS);

/** A server without the stream (501), or a caller it refuses, gives the same answer on every retry. */
const isFinal = (error: unknown) =>
  error instanceof MastraClientError && ((error.status >= 400 && error.status < 500) || error.status === 501);

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>(resolve => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => (clearTimeout(timer), resolve()), { once: true });
  });
}

/**
 * Follows the instance's change stream and refetches the open Knowledge queries when a change arrives.
 * Returns whether the stream is connected, so the queries poll only while it isn't.
 */
export function useKnowledgeLiveUpdates(knowledgeKey: string | undefined): boolean {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!knowledgeKey) return;
    const abort = new AbortController();
    const burst = createBurstRefresh(
      () => void queryClient.invalidateQueries({ queryKey: ['knowledge', knowledgeKey] }),
      REFRESH_DEBOUNCE_MS,
      REFRESH_MAX_WAIT_MS,
    );
    const refresh = burst.notify;
    void (async () => {
      for (let connects = 0; !abort.signal.aborted;) {
        try {
          const reader = (await client.getKnowledge(knowledgeKey).events({ signal: abort.signal })).getReader();
          // Writes may have landed while the stream was down.
          if (connects++ > 0) refresh();
          setLive(true);
          while (!(await reader.read()).done) refresh();
        } catch (error) {
          // Falls back to polling: for good when the server can't stream, otherwise until it reconnects.
          if (isFinal(error)) {
            setLive(false);
            return;
          }
        }
        if (abort.signal.aborted) return;
        setLive(false);
        await sleep(RECONNECT_MS, abort.signal);
      }
    })();
    return () => {
      abort.abort();
      burst.cancel();
      setLive(false);
    };
  }, [client, queryClient, knowledgeKey]);
  return live;
}

export function useKnowledgeInstances() {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['knowledge', 'instances'],
    queryFn: async () => (await client.listKnowledge()).instances,
  });
}

/** The bounded page graph across every root scope; its pages also feed the tree. */
export function useKnowledgePageGraph(knowledgeKey: string | undefined, live: boolean) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['knowledge', knowledgeKey, 'graph'],
    queryFn: knowledgeKey
      ? async (): Promise<KnowledgeGraphResponse> => client.getKnowledge(knowledgeKey).graph()
      : skipToken,
    refetchInterval: pollUnless(live),
  });
}

export function useKnowledgePage(
  knowledgeKey: string | undefined,
  live: boolean,
  pageId: string | null,
  noteCursor?: string,
) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['knowledge', knowledgeKey, 'page', pageId, noteCursor ?? null],
    queryFn:
      knowledgeKey && pageId
        ? async (): Promise<KnowledgePageResponse> => client.getKnowledge(knowledgeKey).page(pageId, { noteCursor })
        : skipToken,
    // Only the first notes chunk polls; later chunks are fetched once as the user loads them.
    refetchInterval: noteCursor ? false : pollUnless(live),
  });
}

/** Tree levels for the explorer's lazily loaded sidebar, one query per request, in order. */
export function useKnowledgeTreeLevels(
  knowledgeKey: string | undefined,
  live: boolean,
  requests: KnowledgeExplorerTreeRequest[],
) {
  const client = useMastraClient();
  return useQueries({
    queries: requests.map(request => ({
      queryKey: ['knowledge', knowledgeKey, 'tree', request.parentId, request.cursor ?? null],
      queryFn: knowledgeKey
        ? async (): Promise<KnowledgeTreeResponse> =>
            client.getKnowledge(knowledgeKey).tree({ parentId: request.parentId ?? undefined, cursor: request.cursor })
        : skipToken,
      // A level's first chunk polls, so new children appear in the tree and the page's child list.
      refetchInterval: request.cursor ? false : pollUnless(live),
    })),
  });
}

export function useKnowledgeActivity(knowledgeKey: string | undefined, live: boolean, pageId: string) {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['knowledge', knowledgeKey, 'activity', pageId],
    queryFn: knowledgeKey
      ? async (): Promise<KnowledgeActivityResponse> => client.getKnowledge(knowledgeKey).activity({ pageId })
      : skipToken,
    refetchInterval: pollUnless(live),
  });
}

export function useKnowledgeSearch(knowledgeKey: string | undefined, query: string) {
  const client = useMastraClient();
  const trimmed = query.trim();
  return useQuery({
    queryKey: ['knowledge', knowledgeKey, 'search', trimmed],
    queryFn:
      knowledgeKey && trimmed.length >= MIN_SEARCH_LENGTH
        ? async (): Promise<KnowledgeSearchResponse> => client.getKnowledge(knowledgeKey).search(trimmed)
        : skipToken,
    placeholderData: keepPreviousData,
  });
}
