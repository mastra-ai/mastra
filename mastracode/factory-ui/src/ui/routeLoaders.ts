import { DEFAULT_BOARD_ID } from '@mastra/factory/boards/default-board';
import { PULL_REQUEST_SOURCE_FILTER } from '@mastra/factory/work-items/card-source-filters';
import { noop } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import type { LoaderFunctionArgs } from 'react-router';

import type { ApiConfig } from '../api/config';
import { activeRunsQueryOptions } from '../hooks/useActiveRunResources';
import { boardCatalogQueryOptions } from '../hooks/useBoardCatalog';
import { intakeRoutesQueryOptions } from '../hooks/useIntakeRoutes';
import { defaultModelQueryOptions } from '../hooks/use-default-model';
import { providersQueryOptions } from '../hooks/use-providers';
import { factoriesQueryOptions } from '../hooks/useFactories';
import { factoryDecisionHistoryQueryOptions } from '../hooks/useFactoryDecisions';
import { factoryProjectQueryOptions } from '../hooks/useFactoryDefaultModel';
import { gitLabStatusQueryOptions } from '../hooks/useGitLabData';
import { githubStatusQueryOptions } from '../hooks/useGithubStatus';
import { incidentioStatusQueryOptions } from '../hooks/useIncidentioData';
import { intakeCandidatesQueryOptions } from '../hooks/useIntakeCandidates';
import { intakeBindingsQueryOptions, intakeConfigQueryOptions } from '../hooks/useIntakeConfig';
import { jiraStatusQueryOptions } from '../hooks/useJiraData';
import { linearStatusQueryOptions } from '../hooks/useLinearData';
import { serverFeaturesQueryOptions } from '../hooks/useServerFeatures';
import {
  boardPhasesQueryOptions,
  sessionCardsQueryOptions,
  workItemActivityQueryOptions,
  workItemFilterOptionsQueryOptions,
  workItemStartersQueryOptions,
} from '../hooks/useWorkItems';
import { workspacesQueryOptions } from '../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from './domains/chat/services/constants';
import { boardPhasesRequest } from './domains/factory/boardPhasesRequest';
import { boardFiltersFromParams } from './domains/factory/boardFilters';
import { BOARD_VIEW_QUERY } from './domains/factory/boardSavedViews';
import { BOARD_SORT_QUERY, DEFAULT_BOARD_SORT, isBoardSort } from './domains/factory/boardSort';
import { boardDecisionsQueryOptions } from './domains/factory/hooks/useBoardDecisions';
import { BOARD_SEARCH_QUERY } from './domains/factory/hooks/useBoardView';
import { DEFAULT_ACTIVITY_PERIOD } from './domains/factory/periodActivity';
import { ruleDecisionGroup } from './domains/factory/ruleDecisionGroups';
import { isSettingsPath } from './domains/settings/hooks/useSettingsOpen';
import { hasLinkedRepository } from './domains/workspaces/services/factoryRepositories';
import type { FactoryProject } from './domains/workspaces/services/github';
import type { LazyPageComponent } from './layouts/PageSuspense';

export interface RouteLoaderServices {
  queryClient: QueryClient;
  api: ApiConfig;
}

export type Prefetch = (services: RouteLoaderServices, args: LoaderFunctionArgs) => void;

export function createLoadOnEntry(services: RouteLoaderServices | undefined) {
  return function loadOnEntry(prefetch?: Prefetch, page?: LazyPageComponent) {
    if (!services) return {};
    return {
      loader: (args: LoaderFunctionArgs) => {
        page?.preload().catch(noop);
        prefetch?.(services, args);
      },
      shouldRevalidate: () => false,
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

function prefetchSessionRuns({ queryClient, api }: RouteLoaderServices, factoryId: string) {
  void queryClient.query(workspacesQueryOptions(api.baseUrl, factoryId)).catch(noop);
  void queryClient.query(activeRunsQueryOptions(AGENT_CONTROLLER_ID, api.baseUrl)).catch(noop);
}

export const prefetchFactoryLayout: Prefetch = (services, { params }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  whenFactoryListed(services, factoryId, factory => {
    if (hasLinkedRepository(factory)) prefetchSessionRuns(services, factoryId);
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
  void queryClient.query(sessionCardsQueryOptions(api.baseUrl, factoryId)).catch(noop);
  void queryClient.query(boardDecisionsQueryOptions(api.baseUrl, factoryId)).catch(noop);
  prefetchSessionRuns(services, factoryId);
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
  whenFactoryListed(services, factoryId, factory => {
    if (!hasLinkedRepository(factory)) return;
    void queryClient.query(intakeConfigQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(intakeBindingsQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(githubStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(gitLabStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(linearStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(jiraStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(incidentioStatusQueryOptions(api.baseUrl)).catch(noop);
    // Only the default board lists the records that have no card yet.
    if ((params.boardId ?? DEFAULT_BOARD_ID) === DEFAULT_BOARD_ID) {
      void queryClient.infiniteQuery(intakeCandidatesQueryOptions(api.baseUrl, factoryId)).catch(noop);
    }
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

export const prefetchRuleDecisions: Prefetch = ({ queryClient, api }, { params, request }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  const group = ruleDecisionGroup(new URL(request.url).searchParams.get('group'));
  void queryClient
    .infiniteQuery(factoryDecisionHistoryQueryOptions(api.baseUrl, factoryId, group.key, group.statuses))
    .catch(noop);
};
