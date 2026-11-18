import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { PULL_REQUEST_SOURCE_FILTER } from '@mastra/factory/work-items/card-source-filters';
import { noop } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { LoaderFunctionArgs, ShouldRevalidateFunction } from 'react-router';

import type { ApiConfig } from '../api/config';
import { boardCatalogQueryOptions } from '../hooks/useBoardCatalog';
import { intakeRoutesQueryOptions } from '../hooks/useIntakeRoutes';
import { defaultModelQueryOptions } from '../hooks/use-default-model';
import { providersQueryOptions } from '../hooks/use-providers';
import { factoriesQueryOptions } from '../hooks/useFactories';
import { factoryDecisionHistoryQueryOptions, runQueueQueryOptions } from '../hooks/useFactoryDecisions';
import { factoryProjectQueryOptions } from '../hooks/useFactoryDefaultModel';
import { gitLabStatusQueryOptions } from '../hooks/useGitLabData';
import { githubStatusQueryOptions } from '../hooks/useGithubStatus';
import { incidentioStatusQueryOptions } from '../hooks/useIncidentioData';
import { intakeBindingsQueryOptions, intakeConfigQueryOptions } from '../hooks/useIntakeConfig';
import { jiraStatusQueryOptions } from '../hooks/useJiraData';
import { linearStatusQueryOptions } from '../hooks/useLinearData';
import { serverFeaturesQueryOptions } from '../hooks/useServerFeatures';
import { sessionActivityQueryOptions, sessionRowsQueryOptions } from '../hooks/useSessionRows';
import {
  boardPhasesQueryOptions,
  sessionWorkItemsQueryOptions,
  workItemActivityQueryOptions,
  workItemFilterOptionsQueryOptions,
  workItemQueryOptions,
  workItemStartersQueryOptions,
} from '../hooks/useWorkItems';
import { userSessionQueryOptions } from '../hooks/useWorkspaces';
import { boardPhasesRequest } from './domains/factory/boardPhasesRequest';
import { boardFiltersFromParams } from './domains/factory/boardFilters';
import { BOARD_VIEW_QUERY } from './domains/factory/boardSavedViews';
import { BOARD_SORT_QUERY, DEFAULT_BOARD_SORT, isBoardSort } from './domains/factory/boardSort';
import { boardDecisionsQueryOptions } from './domains/factory/hooks/useBoardDecisions';
import { BOARD_SEARCH_QUERY } from './domains/factory/hooks/useBoardView';
import { linkedSessionRepository } from './domains/factory/hooks/useSessionRepository';
import { DEFAULT_ACTIVITY_PERIOD } from './domains/factory/periodActivity';
import { ruleDecisionGroup } from './domains/factory/ruleDecisionGroups';
import { pullRequestSubscriptionsQuery } from './domains/factory/services/githubSubscriptions';
import { isSettingsPath } from './domains/settings/hooks/useSettingsOpen';
import { readPinnedSessions } from './domains/workspaces/hooks/usePinnedSessions';
import { readSessionFilters } from './domains/workspaces/hooks/useSessionFilters';
import { readSessionListView } from './domains/workspaces/hooks/useSessionListView';
import { hasLinkedRepository } from './domains/workspaces/services/factoryRepositories';
import { sessionRowsRequest } from './domains/workspaces/services/sessionRowReads';
import type { FactoryProject } from './domains/workspaces/services/github';
import type { LazyPageComponent } from './layouts/PageSuspense';

export interface RouteLoaderServices {
  queryClient: QueryClient;
  api: ApiConfig;
}

export type Prefetch = (services: RouteLoaderServices, args: LoaderFunctionArgs) => void | Promise<void>;

export function createLoadOnEntry(services: RouteLoaderServices | undefined, holdsNavigation?: () => boolean) {
  return function loadOnEntry(
    prefetch?: Prefetch,
    page?: LazyPageComponent,
    shouldRevalidate: ShouldRevalidateFunction = () => false,
  ) {
    if (!services) return {};
    return {
      loader: (args: LoaderFunctionArgs) => {
        page?.preload().catch(noop);
        const reads = prefetch?.(services, args);
        return holdsNavigation?.() ? reads : undefined;
      },
      shouldRevalidate,
    };
  };
}

// No `/auth/me` here: `AuthGuard` refetches it on every mount, so prefetching it would send it twice.
export const prefetchFactories: Prefetch = ({ queryClient, api }) => {
  void queryClient.query(factoriesQueryOptions(api.baseUrl)).catch(noop);
};

function whenFactoryListed(
  { queryClient, api }: RouteLoaderServices,
  factoryId: string,
  start: (factory: FactoryProject) => void,
) {
  queryClient.query({ ...factoriesQueryOptions(api.baseUrl), staleTime: 'static' }).then(factories => {
    const factory = factories.find(candidate => candidate.id === factoryId);
    if (factory) start(factory);
  }, noop);
}

export const prefetchFactoryLayout: Prefetch = (services, { params }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  const { queryClient, api } = services;
  whenFactoryListed(services, factoryId, factory => {
    if (!hasLinkedRepository(factory)) return;
    void queryClient.query(sessionActivityQueryOptions(api.baseUrl, factoryId)).catch(noop);
  });
};

export const prefetchSidebar: Prefetch = (services, { params, request }) => {
  const { factoryId } = params;
  const { pathname } = new URL(request.url);
  if (!factoryId || isSettingsPath(pathname)) return;
  const { queryClient, api } = services;
  void queryClient.query(serverFeaturesQueryOptions(api.client)).catch(noop);
  void queryClient.query(boardCatalogQueryOptions(api.client, factoryId)).catch(noop);
  // Says whether the sidebar offers "New board": only organization admins may change boards.
  void queryClient.query(intakeRoutesQueryOptions(api.baseUrl, factoryId)).catch(noop);
  const { sort, groupBy, revealChildSessions } = readSessionListView();
  const rows = sessionRowsRequest({
    sort,
    groupBy,
    filters: readSessionFilters(),
    pinned: readPinnedSessions(),
    // User sessions route as `user/threads/:threadId`.
    open: params.sessionId ?? params.threadId,
    children: revealChildSessions,
    windows: {},
  });
  void queryClient.query(sessionRowsQueryOptions(api.baseUrl, factoryId, rows)).catch(noop);
};

export const prefetchBoard: Prefetch = (services, { params, request }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  const { queryClient, api } = services;
  // The page's largest read leaves with the Factory list, not once it answers: waiting to hear a
  // repository is linked would start every board a round trip later. A saved view keeps its
  // filters in the browser's storage, so the page asks for that one itself.
  const { searchParams } = new URL(request.url);
  if (!searchParams.has(BOARD_VIEW_QUERY)) {
    const sort = searchParams.get(BOARD_SORT_QUERY);
    const view = boardPhasesRequest({
      board: params.boardId ?? DEFAULT_BOARD_ID,
      sort: sort && isBoardSort(sort) ? sort : DEFAULT_BOARD_SORT,
      search: searchParams.get(BOARD_SEARCH_QUERY) ?? '',
      filters: boardFiltersFromParams(searchParams, true),
      windows: {},
      item: searchParams.get('item') ?? undefined,
    });
    void queryClient.query(boardPhasesQueryOptions(api.baseUrl, factoryId, view)).catch(noop);
  }
  void queryClient.query(workItemFilterOptionsQueryOptions(api.baseUrl, factoryId)).catch(noop);
  void queryClient.query(boardDecisionsQueryOptions(api.baseUrl, factoryId)).catch(noop);
  whenFactoryListed(services, factoryId, factory => {
    if (!hasLinkedRepository(factory)) return;
    void queryClient.query(runQueueQueryOptions(api.baseUrl, factoryId)).catch(noop);
    void queryClient.query(intakeConfigQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(intakeBindingsQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(githubStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(gitLabStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(linearStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(jiraStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(incidentioStatusQueryOptions(api.baseUrl)).catch(noop);
  });
};

/** Where a link to the retired Review board lands on Work: the link's query, with pull requests alone. */
export function retiredReviewBoardSearch(search: string): URLSearchParams {
  const params = new URLSearchParams(search);
  // Picked sources widen the filter, so any other source would show cards the Review board never held.
  params.set('source', PULL_REQUEST_SOURCE_FILTER);
  return params;
}

/** A retired Review board link opens Work once the catalog says the board is gone: what Work reads starts now. */
export const prefetchRetiredReviewBoard: Prefetch = (services, args) => {
  const url = new URL(args.request.url);
  url.search = retiredReviewBoardSearch(url.search).toString();
  prefetchBoard(services, { ...args, request: new Request(url, { signal: args.request.signal }) });
};

export const prefetchComposer: Prefetch = ({ queryClient, api }, { params }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  void queryClient.query(factoryProjectQueryOptions(api.baseUrl, factoryId)).catch(noop);
  void queryClient.query(defaultModelQueryOptions(api.client)).catch(noop);
  void queryClient.query(providersQueryOptions(api.client)).catch(noop);
};

/** A draft offers starters counted off the board, and the board's activity, around the composer. */
export const prefetchDraft: Prefetch = (services, args) => {
  prefetchComposer(services, args);
  const { factoryId } = args.params;
  if (!factoryId) return;
  const { queryClient, api } = services;
  void queryClient.query(workItemStartersQueryOptions(api.baseUrl, factoryId)).catch(noop);
  void queryClient.query(workItemActivityQueryOptions(api.baseUrl, factoryId, DEFAULT_ACTIVITY_PERIOD)).catch(noop);
};

/** A card's draft offers the card's own actions under the composer. */
export const prefetchCardDraft: Prefetch = (services, args) => {
  prefetchComposer(services, args);
  const { factoryId, workItemId } = args.params;
  if (!factoryId || !workItemId) return;
  const { queryClient, api } = services;
  void queryClient.query(workItemQueryOptions(api.baseUrl, factoryId, workItemId)).catch(noop);
  void queryClient.query(boardCatalogQueryOptions(api.client, factoryId)).catch(noop);
  void queryClient.query(boardDecisionsQueryOptions(api.baseUrl, factoryId)).catch(noop);
};

const CACHED_UNLESS_INVALIDATED = { staleTime: Infinity };

export const loadSessionFrame: Prefetch = async (services, { params }) => {
  const { queryClient, api } = services;
  const { factoryId, threadId } = params;
  const sessionId = params.sessionId ?? threadId;
  if (!factoryId || !sessionId || !threadId) return;
  const cardReads = params.sessionId
    ? [
        queryClient
          .query({
            ...sessionWorkItemsQueryOptions(api.baseUrl, factoryId, params.sessionId),
            ...CACHED_UNLESS_INVALIDATED,
          })
          .catch(noop),
        queryClient
          .query({ ...boardCatalogQueryOptions(api.client, factoryId), ...CACHED_UNLESS_INVALIDATED })
          .catch(noop),
      ]
    : [];
  await Promise.all([...cardReads, loadSessionSubscriptions(services, factoryId, sessionId, threadId)]);
};

async function loadSessionSubscriptions(
  { queryClient, api }: RouteLoaderServices,
  factoryId: string,
  sessionId: string,
  threadId: string,
) {
  const [factories, session] = await Promise.all([
    queryClient.query({ ...factoriesQueryOptions(api.baseUrl), ...CACHED_UNLESS_INVALIDATED }).catch(() => undefined),
    queryClient
      .query({ ...userSessionQueryOptions(api.baseUrl, sessionId), ...CACHED_UNLESS_INVALIDATED })
      .catch(() => undefined),
  ]);
  const factory = factories?.find(candidate => candidate.id === factoryId);
  const { repository, provider } = linkedSessionRepository(factory, session);
  if (!repository) return;
  await queryClient
    .query({
      ...pullRequestSubscriptionsQuery(api.baseUrl, sessionId, threadId, provider, true),
      ...CACHED_UNLESS_INVALIDATED,
    })
    .catch(noop);
}

export const reloadOnAnotherThread: ShouldRevalidateFunction = ({ currentParams, nextParams }) =>
  currentParams.sessionId !== nextParams.sessionId || currentParams.threadId !== nextParams.threadId;

export const prefetchRuleDecisions: Prefetch = ({ queryClient, api }, { params, request }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  const group = ruleDecisionGroup(new URL(request.url).searchParams.get('group'));
  void queryClient
    .infiniteQuery(factoryDecisionHistoryQueryOptions(api.baseUrl, factoryId, group.key, group.statuses))
    .catch(noop);
};
