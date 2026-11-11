import { keepPreviousData, queryOptions, skipToken, useQuery } from '@tanstack/react-query';

import { useApiConfig } from '../../../../api/config';
import { queryKeys } from '../../../../api/keys';
import type { WorkspacesData } from '../../../../hooks/useWorkspaces';
import type { BoardCandidate } from '../../factory/boardCandidates';
import { searchWorkItems } from '../../factory/services/workItems';
import type { WorkItem } from '../../factory/services/workItems';

type Candidate = { candidate: BoardCandidate; updatedAt: string };
type Found = { items: WorkItem[]; checked: readonly string[] };
const newestFirst = (a: { updatedAt: string }, b: { updatedAt: string }) => b.updatedAt.localeCompare(a.updatedAt);
const selectItems = (found: Found) => found.items;
const selectChecked = (found: Found) => found.checked;

/**
 * Board cards: they title the session results and are searchable on their own before a session exists.
 * The server sends the few that match what is typed, plus the ones asked for by key: the cards of the
 * newest sessions, and any card already holding one of the best unfiled candidates. A candidate is
 * offered only once the server has answered for it, so a filed one is never shown as unfiled.
 */
export function useGlobalSearchWorkItems(
  factoryId: string | undefined,
  search: string,
  candidates: Candidate[],
  sessions: WorkspacesData[],
) {
  const { baseUrl } = useApiConfig();
  const query = search.trim();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const score = ({ candidate: { title, sourceKey, url, meta } }: Candidate) =>
    terms.filter(term => [title, sourceKey, url, ...meta].join(' ').toLowerCase().includes(term)).length;
  const offered = candidates.toSorted((a, b) => score(b) - score(a) || newestFirst(a, b)).slice(0, 20);
  const newest = sessions
    .flatMap(repository => repository.workspaces)
    .toSorted(newestFirst)
    .slice(0, 40);
  // A pull request's head branch brings back the card it was opened from, which filing links it to.
  const keys = [
    ...offered.flatMap(({ candidate }) => [candidate.sourceKey, candidate.url, candidate.metadata.headBranch]),
    ...newest.map(session => session.branch),
  ].filter((key): key is string => typeof key === 'string' && key.length > 0);
  const options = queryOptions({
    // Under the board key, so whatever refreshes the board's cards refreshes an open search too.
    queryKey: [...queryKeys.workItems(factoryId), 'search', query, keys],
    queryFn: factoryId
      ? async ({ signal }): Promise<Found> => ({
          items: await searchWorkItems(baseUrl, factoryId, { query, keys }, signal),
          checked: keys,
        })
      : skipToken,
    // Results stay up between keystrokes instead of emptying while the next ones load.
    placeholderData: keepPreviousData,
  });
  const found = useQuery({ ...options, select: selectItems });
  const checked = useQuery({ ...options, select: selectChecked }).data ?? [];

  return {
    items: found.data ?? [],
    candidates: offered.filter(({ candidate }) => checked.includes(candidate.sourceKey)),
    refetch: found.refetch,
    pending: found.isLoading,
    failed: found.isError,
    retry: () => {
      void found.refetch();
    },
  };
}
