import { MastraClientError } from '@mastra/client-js';
import type {
  KnowledgeActivityResponse,
  KnowledgeGraphResponse,
  KnowledgeLinkCountsResponse,
  KnowledgePageLinksResponse,
  KnowledgePageResponse,
  KnowledgeSearchResponse,
  KnowledgeTreeResponse,
} from '@mastra/client-js';
import type { KnowledgeExplorerTreeRequest } from '@mastra/playground-ui/domains/knowledge/components/KnowledgePageExplorer';
import { useMastraClient } from '@mastra/react';
import { keepPreviousData, skipToken, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

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

function onVisibilityChange(notify: () => void) {
  document.addEventListener('visibilitychange', notify);
  return () => document.removeEventListener('visibilitychange', notify);
}
const pageVisible = () => document.visibilityState !== 'hidden';

/**
 * Follows the instance's change stream and refetches the open Knowledge queries when a change arrives.
 * Returns whether the stream is connected, so the queries poll only while it isn't.
 *
 * The stream holds an HTTP connection open, and a browser allows about six per host over HTTP/1.1. With
 * Studio's own reload stream, every open tab held two, so a few tabs left a new tab's requests queued
 * forever. A hidden tab closes its stream, and reconnects and refetches when it is shown again.
 */
export function useKnowledgeLiveUpdates(knowledgeKey: string | undefined): boolean {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const [live, setLive] = useState(false);
  const visible = useSyncExternalStore(onVisibilityChange, pageVisible, () => true);
  // Only the first connection of the page can skip the catch-up refetch.
  const connectedBefore = useRef(false);
  useEffect(() => {
    if (!knowledgeKey || !visible) return;
    const abort = new AbortController();
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(debounce);
      debounce = setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: ['knowledge', knowledgeKey] }),
        REFRESH_DEBOUNCE_MS,
      );
    };
    void (async () => {
      while (!abort.signal.aborted) {
        try {
          const reader = (await client.getKnowledge(knowledgeKey).events({ signal: abort.signal })).getReader();
          // Writes may have landed while the stream was down or the tab was hidden.
          if (connectedBefore.current) refresh();
          connectedBefore.current = true;
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
      clearTimeout(debounce);
      setLive(false);
    };
  }, [client, queryClient, knowledgeKey, visible]);
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

/** Pages a link reaches, by id or `[[ref]]`, sharing the page query's cache. A 404 is not retried. */
export function useKnowledgeLinkedPages(knowledgeKey: string | undefined, keys: string[]) {
  const client = useMastraClient();
  return useQueries({
    queries: keys.map(key => ({
      queryKey: ['knowledge', knowledgeKey, 'page', key, null],
      queryFn: knowledgeKey
        ? async (): Promise<KnowledgePageResponse> => client.getKnowledge(knowledgeKey).page(key)
        : skipToken,
      retry: (failures: number, error: Error) => !(error && 'status' in error && error.status === 404) && failures < 2,
      staleTime: 30_000,
    })),
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

/** The most pages one link count request may ask about; the route rejects more. */
const LINK_COUNT_BATCH = 200;
/** A server with no link index answers 501 every time, and a refused caller the same; neither is retried. */
const retryUnlessFinal = (failures: number, error: unknown) => !isFinal(error) && failures < 2;

/** Exact link counts for the pages the graph holds, in batches. 501 (no link index) is an error the graph falls back from. */
export function useKnowledgeLinkCounts(knowledgeKey: string | undefined, live: boolean, pageIds: string[]) {
  const client = useMastraClient();
  return useQuery<KnowledgeLinkCountsResponse['counts']>({
    queryKey: ['knowledge', knowledgeKey, 'link-counts', pageIds],
    queryFn:
      knowledgeKey && pageIds.length
        ? async (): Promise<KnowledgeLinkCountsResponse['counts']> => {
            const knowledge = client.getKnowledge(knowledgeKey);
            const batches: string[][] = [];
            for (let i = 0; i < pageIds.length; i += LINK_COUNT_BATCH)
              batches.push(pageIds.slice(i, i + LINK_COUNT_BATCH));
            const results = await Promise.all(batches.map(batch => knowledge.linkCounts(batch)));
            return Object.assign({}, ...results.map(result => result.counts));
          }
        : skipToken,
    // The graph loads more pages as the person explores; keep the counts already known meanwhile.
    placeholderData: keepPreviousData,
    retry: retryUnlessFinal,
    refetchInterval: pollUnless(live),
  });
}

/** One page's links, for the page under the pointer. Cached per page, so returning to it asks nothing. */
export function useKnowledgePageLinks(knowledgeKey: string | undefined, pageId: string | null) {
  const client = useMastraClient();
  return useQuery<KnowledgePageLinksResponse>({
    queryKey: ['knowledge', knowledgeKey, 'page-links', pageId],
    queryFn:
      knowledgeKey && pageId
        ? async (): Promise<KnowledgePageLinksResponse> => client.getKnowledge(knowledgeKey).pageLinks(pageId)
        : skipToken,
    staleTime: 30_000,
    retry: retryUnlessFinal,
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
