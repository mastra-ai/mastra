import { useDebouncedValue } from '@mastra/playground-ui/hooks/use-debounced-value';
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useLocation } from 'react-router';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import { useSidebarWorkItemsQuery } from '../../../../hooks/useWorkItems';
import type { BoardCandidate } from '../../factory/boardCandidates';
import { isPersistedCandidate, persistedSourceKeys } from '../../factory/boardItems';
import { pageLoadsBoard } from '../../factory/pageLoadsBoard';
import { listWorkItems } from '../../factory/services/workItems';
import type { BoardSnapshot, WorkItem } from '../../factory/services/workItems';
import { candidateSearchValue } from '../services/searchResults';

type Candidate = { candidate: BoardCandidate; updatedAt: string };

/** How many unfiled candidates one search offers: each costs the server a lookup for its card. */
const OFFERED_CANDIDATES = 20;
const NO_CARDS: WorkItem[] = [];

function selectUnstarted(board: BoardSnapshot) {
  // A server from before `started=false` ignores it and sends the whole board: keep what was asked for.
  const cards = board.workItems.filter(item => Object.keys(item.sessions).length === 0);
  // Such a server sends no count either: count what it sent.
  return { cards, total: board.total ?? cards.length };
}

/**
 * The candidates that best match `search`: the most words found, then the most recently updated.
 * Words are looked for in the text the palette filters a candidate's row on.
 */
function bestCandidates(candidates: Candidate[], search: string): Candidate[] {
  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  return candidates
    .map(entry => {
      const text = candidateSearchValue(entry.candidate).toLowerCase();
      return { entry, found: words.filter(word => text.includes(word)).length };
    })
    .toSorted((a, b) => b.found - a.found || b.entry.updatedAt.localeCompare(a.entry.updatedAt))
    .slice(0, OFFERED_CANDIDATES)
    .map(({ entry }) => entry);
}

/**
 * What the board holds for one search text, without the board: the server's best unstarted cards
 * for it, and which of the best candidates are not filed yet. `known` are cards loaded elsewhere.
 */
function useUnstartedSearch(factoryId: string | undefined, search: string, candidates: Candidate[], known: WorkItem[]) {
  const { baseUrl } = useApiConfig();
  const unstarted = useQuery({
    // Under the board key, as is the lookup below: whatever refreshes the board's cards refreshes these.
    queryKey: queryKeys.unstartedWorkItems(factoryId, search),
    queryFn: factoryId
      ? ({ signal }) => listWorkItems(baseUrl, factoryId, signal, { started: 'false', q: search })
      : skipToken,
    select: selectUnstarted,
    // Results stay up between searches instead of emptying while the next ones load.
    placeholderData: keepPreviousData,
  });
  const cards = unstarted.data?.cards ?? NO_CARDS;

  const offered = bestCandidates(candidates, search);
  const sources = offered.flatMap(({ candidate }) => [candidate.sourceKey, candidate.url]).filter(Boolean);
  const filed = useQuery({
    queryKey: queryKeys.workItemsFiledFrom(factoryId, sources),
    queryFn:
      factoryId && sources.length > 0
        ? async ({ signal }) => ({ ...(await listWorkItems(baseUrl, factoryId, signal, { source: sources })), sources })
        : skipToken,
    placeholderData: keepPreviousData,
  });
  const filedCards = filed.data?.workItems ?? NO_CARDS;
  const filedKeys = persistedSourceKeys([...known, ...cards, ...filedCards]);
  // A candidate is offered only once the server has answered for it, so a filed one is never shown as unfiled.
  const answered = filed.data?.sources ?? [];
  const unfiled = offered.filter(
    ({ candidate }) => answered.includes(candidate.sourceKey) && !isPersistedCandidate(filedKeys, candidate),
  );

  return {
    unstarted,
    cards,
    filed,
    filedCards,
    unfiled,
    count: (unstarted.data?.total ?? 0) + unfiled.length,
  };
}

/**
 * Board cards for the palette, read in parts so opening it never downloads the board. The cards
 * holding a session title the session results. The cards holding none are searched by the server,
 * once typing pauses, and so are the cards already filed from the best unfiled candidates.
 */
export function useGlobalSearchWorkItems(factoryId: string | undefined, typed: string, candidates: Candidate[]) {
  const { baseUrl } = useApiConfig();
  const { pathname } = useLocation();
  const sessionCards = useSidebarWorkItemsQuery(factoryId, pageLoadsBoard(pathname));
  const withSessions = sessionCards.data?.workItems ?? NO_CARDS;
  const settled = useDebouncedValue(typed.trim(), 150);
  // Clearing the box goes back to the cached empty search at once.
  const search = useUnstartedSearch(factoryId, typed.trim() === '' ? '' : settled, candidates, withSessions);
  // The rail counts the empty search, so its number holds still while typing narrows the rows.
  const everything = useUnstartedSearch(factoryId, '', candidates, withSessions);

  // Kept across renders that load nothing new, so what is derived from it downstream is too.
  const loaded = useMemo(
    () => [...withSessions, ...search.cards, ...search.filedCards, ...everything.cards, ...everything.filedCards],
    [withSessions, search.cards, search.filedCards, everything.cards, everything.filedCards],
  );

  return {
    withSessions,
    unstarted: search.cards,
    candidates: search.unfiled,
    /** Every card either search loaded, for acting on a row. A card several reads sent is in it several times. */
    loaded,
    count: everything.count,
    /**
     * The clicked row's card alone, read fresh: it may have gained a session since it was listed,
     * or been deleted. Not the lists again: a card can leave the search's first rows and still exist.
     */
    refetch: async (
      itemId: string,
    ): Promise<{ isSuccess: true; data: WorkItem[] } | { isSuccess: false; error: unknown }> => {
      // Without a Factory no row is listed, so none is clicked.
      if (!factoryId) return { isSuccess: true, data: NO_CARDS };
      try {
        const card = await listWorkItems(baseUrl, factoryId, undefined, { workItemId: [itemId] });
        return { isSuccess: true, data: card.workItems };
      } catch (error) {
        return { isSuccess: false, error };
      }
    },
    pending: sessionCards.isLoading || search.unstarted.isLoading,
    failed: sessionCards.isError || search.unstarted.isError || search.filed.isError,
    retry: () => {
      // Only what failed: with no candidate the lookup has nothing to run, and refetching it would fail.
      for (const query of [sessionCards, search.unstarted, search.filed]) {
        if (query.isError) void query.refetch();
      }
    },
  };
}
