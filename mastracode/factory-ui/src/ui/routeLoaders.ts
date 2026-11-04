/**
 * Route loaders that start requests early.
 *
 * Gating stays in components (`RootGuards`), so every route below the sign-in
 * check used to wait for it before its components mounted and fetched. When a
 * route is entered, its loader starts the page's code and the queries its
 * element reads, with the same query options as the hooks that read them, and
 * returns without waiting. The router runs the loaders of every matched route
 * at once, so those requests load alongside the sign-in check and the
 * components find them in flight.
 *
 * Requests are started here when the URL determines them, or when they follow
 * from the Factory list (which this module loads) by a rule shared with the
 * component, like `hasLinkedRepository`. Requests keyed by other responses (the
 * board's issue lists, the composer's model list) or by state a component
 * resolves (the chat session's address) are left to the components that read
 * them, so this module never copies a component's logic.
 */
import type { QueryClient } from '@tanstack/react-query';
import type { LoaderFunctionArgs } from 'react-router';

import type { ApiConfig } from '../api/config';
import { activeRunsQuery } from '../hooks/useActiveRunResources';
import { boardCatalogQuery } from '../hooks/useBoardCatalog';
import { defaultModelQuery } from '../hooks/use-default-model';
import { providersQueryOptions } from '../hooks/use-providers';
import { factoriesQuery } from '../hooks/useFactories';
import { factoryDecisionHistoryQuery } from '../hooks/useFactoryDecisions';
import { factoryProjectQuery } from '../hooks/useFactoryDefaultModel';
import { gitLabStatusQuery } from '../hooks/useGitLabData';
import { githubStatusQuery } from '../hooks/useGithubStatus';
import { incidentioStatusQuery } from '../hooks/useIncidentioData';
import { intakeBindingsQuery, intakeConfigQuery } from '../hooks/useIntakeConfig';
import { jiraStatusQuery } from '../hooks/useJiraData';
import { linearStatusQuery } from '../hooks/useLinearData';
import { serverFeaturesQuery } from '../hooks/useServerFeatures';
import { boardQueryOptions } from '../hooks/useWorkItems';
import { workspacesQueryOptions } from '../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from './domains/chat/services/constants';
import { boardDecisionsQuery } from './domains/factory/hooks/useBoardDecisions';
import { ruleDecisionGroup } from './domains/factory/ruleDecisionGroups';
import { isSettingsPath } from './domains/settings/hooks/useSettingsOpen';
import { hasLinkedRepository } from './domains/workspaces/services/factoryRepositories';
import type { FactoryProject } from './domains/workspaces/services/github';

/** What the loaders start requests with: the app's query cache and API. */
export interface RouteLoaderServices {
  queryClient: QueryClient;
  api: ApiConfig;
}

/** A page whose code loads on first visit (see `lazyPage`). */
interface PreloadablePage {
  preload: () => Promise<unknown>;
}

type Prefetch = (services: RouteLoaderServices, args: LoaderFunctionArgs) => void;

/**
 * Route props whose loader starts a route's page code and queries when the
 * route is entered. Loaders don't run again on later navigations: the route's
 * components are mounted by then and fetch for themselves in the same render.
 * Without services, as in most tests, routes get no loader and the router
 * starts synchronously, with components fetching their own code and data.
 */
export function createLoadOnEntry(services: RouteLoaderServices | undefined) {
  return function loadOnEntry(page: PreloadablePage | undefined, prefetch?: Prefetch) {
    if (!services) return {};
    return {
      loader: (args: LoaderFunctionArgs) => {
        // A failed preload retries on the visit.
        page?.preload().catch(() => undefined);
        prefetch?.(services, args);
      },
      shouldRevalidate: () => false,
    };
  };
}

/**
 * The Factory list `OnboardingGuard` reads behind the sign-in check. The check
 * itself is not prefetched: `AuthGuard` sends it in the first frame and asks
 * again on every mount to watch the session, so a prefetched answer arriving
 * before it mounts would be fetched twice.
 */
export const prefetchFactories: Prefetch = ({ queryClient, api }) => {
  void queryClient.prefetchQuery(factoriesQuery(api.baseUrl));
};

/** Calls `start` with the route's Factory once the list (already loading) has it. */
function whenFactoryListed(
  { queryClient, api }: RouteLoaderServices,
  factoryId: string,
  start: (factory: FactoryProject) => void,
) {
  queryClient.ensureQueryData(factoriesQuery(api.baseUrl)).then(
    factories => {
      const factory = factories.find(candidate => candidate.id === factoryId);
      if (factory) start(factory);
    },
    // A failed list is the guard's to report.
    () => undefined,
  );
}

function prefetchSessionRuns({ queryClient, api }: RouteLoaderServices, factoryId: string) {
  void queryClient.prefetchQuery(workspacesQueryOptions(api.baseUrl, factoryId));
  void queryClient.prefetchQuery(activeRunsQuery(AGENT_CONTROLLER_ID, api.baseUrl));
}

/** `FactoryLayout` tracks session runs once the Factory has a repository, on every page including Settings. */
export const prefetchFactoryLayout: Prefetch = (services, { params }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  whenFactoryListed(services, factoryId, factory => {
    if (hasLinkedRepository(factory)) prefetchSessionRuns(services, factoryId);
  });
};

/** What the sidebar's main nav reads; Settings pages show the Settings sections instead. */
export const prefetchSidebar: Prefetch = (services, { params, request }) => {
  const { factoryId } = params;
  if (!factoryId || isSettingsPath(new URL(request.url).pathname)) return;
  const { queryClient, api } = services;
  void queryClient.prefetchQuery(serverFeaturesQuery(api.client));
  void queryClient.prefetchQuery(boardCatalogQuery(api.client, factoryId));
  void queryClient.prefetchQuery(boardQueryOptions(api.baseUrl, factoryId));
  void queryClient.prefetchQuery(boardDecisionsQuery(api.baseUrl, factoryId));
  prefetchSessionRuns(services, factoryId);
};

/** What a board reads to load its intake; it shows intake once the Factory has a repository. */
export const prefetchBoard: Prefetch = (services, { params }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  whenFactoryListed(services, factoryId, factory => {
    if (!hasLinkedRepository(factory)) return;
    const { queryClient, api } = services;
    void queryClient.prefetchQuery(intakeConfigQuery(api.baseUrl));
    void queryClient.prefetchQuery(intakeBindingsQuery(api.baseUrl));
    void queryClient.prefetchQuery(githubStatusQuery(api.baseUrl));
    void queryClient.prefetchQuery(gitLabStatusQuery(api.baseUrl));
    void queryClient.prefetchQuery(linearStatusQuery(api.baseUrl));
    void queryClient.prefetchQuery(jiraStatusQuery(api.baseUrl));
    void queryClient.prefetchQuery(incidentioStatusQuery(api.baseUrl));
  });
};

/** What the new-session composer reads before it picks a model. */
export const prefetchComposer: Prefetch = ({ queryClient, api }, { params }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  void queryClient.prefetchQuery(factoryProjectQuery(api.baseUrl, factoryId));
  void queryClient.prefetchQuery(defaultModelQuery(api.client));
  void queryClient.prefetchQuery(providersQueryOptions(api.client));
};

/** The Rules page's decision history for its `?group=` filter. */
export const prefetchRuleDecisions: Prefetch = ({ queryClient, api }, { params, request }) => {
  const { factoryId } = params;
  if (!factoryId) return;
  const group = ruleDecisionGroup(new URL(request.url).searchParams.get('group'));
  void queryClient.prefetchInfiniteQuery(
    factoryDecisionHistoryQuery(api.baseUrl, factoryId, group.key, group.statuses),
  );
};
