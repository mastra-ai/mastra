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
import { intakeBindingsQueryOptions, intakeConfigQueryOptions } from '../hooks/useIntakeConfig';
import { jiraStatusQueryOptions } from '../hooks/useJiraData';
import { linearStatusQueryOptions } from '../hooks/useLinearData';
import { serverFeaturesQueryOptions } from '../hooks/useServerFeatures';
import { allSessionWorkItemsQueryOptions, boardQueryOptions } from '../hooks/useWorkItems';
import { workspacesQueryOptions } from '../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from './domains/chat/services/constants';
import { boardDecisionsQueryOptions } from './domains/factory/hooks/useBoardDecisions';
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
  if (!factoryId || isSettingsPath(new URL(request.url).pathname)) return;
  const { queryClient, api } = services;
  void queryClient.query(serverFeaturesQueryOptions(api.client)).catch(noop);
  void queryClient.query(boardCatalogQueryOptions(api.client, factoryId)).catch(noop);
  // Says whether the sidebar offers "New board": only organization admins may change boards.
  void queryClient.query(intakeRoutesQueryOptions(api.baseUrl, factoryId)).catch(noop);
  void queryClient.query(allSessionWorkItemsQueryOptions(api.baseUrl, factoryId)).catch(noop);
  void queryClient.query(boardDecisionsQueryOptions(api.baseUrl, factoryId)).catch(noop);
  prefetchSessionRuns(services, factoryId);
};

export const prefetchBoard: Prefetch = (services, { params }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  const { queryClient, api } = services;
  // The page's largest read leaves with the Factory list, not once it answers: waiting to hear a
  // repository is linked would start every board a round trip later.
  void queryClient.query(boardQueryOptions(api.baseUrl, factoryId)).catch(noop);
  whenFactoryListed(services, factoryId, factory => {
    if (!hasLinkedRepository(factory)) return;
    void queryClient.query(intakeConfigQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(intakeBindingsQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(githubStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(gitLabStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(linearStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(jiraStatusQueryOptions(api.baseUrl)).catch(noop);
    void queryClient.query(incidentioStatusQueryOptions(api.baseUrl)).catch(noop);
  });
};

export const prefetchComposer: Prefetch = ({ queryClient, api }, { params }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  void queryClient.query(factoryProjectQueryOptions(api.baseUrl, factoryId)).catch(noop);
  void queryClient.query(defaultModelQueryOptions(api.client)).catch(noop);
  void queryClient.query(providersQueryOptions(api.client)).catch(noop);
};

/** A draft offers the board's cards as starters, and its activity, around the composer. */
export const prefetchDraft: Prefetch = (services, args) => {
  prefetchComposer(services, args);
  const { factoryId } = args.params;
  if (!factoryId) return;
  void services.queryClient.query(boardQueryOptions(services.api.baseUrl, factoryId)).catch(noop);
};

export const prefetchRuleDecisions: Prefetch = ({ queryClient, api }, { params, request }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  const group = ruleDecisionGroup(new URL(request.url).searchParams.get('group'));
  void queryClient
    .infiniteQuery(factoryDecisionHistoryQueryOptions(api.baseUrl, factoryId, group.key, group.statuses))
    .catch(noop);
};
