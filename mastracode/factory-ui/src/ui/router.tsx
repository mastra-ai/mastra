/**
 * SPA route table (React Router v8, data mode).
 *
 * Auth gating happens in React layout components, not loaders: `RootGuards`
 * wraps the app routes and reads `/auth/me` through the `useFactoryAuth` custom
 * React Query hook (shared cache key with the rest of the UI), redirecting
 * unauthenticated sessions to `/signin` when web auth is enabled. `SignInPage`
 * mirrors the guard: signed-in (or auth-disabled) visitors are sent back to
 * `/` so the app can choose the active factory's board or draft composer.
 *
 * Loaders only start requests. When a route is entered, its loader starts the
 * code and the React Query queries that its element reads, using the same
 * query options as the hooks, and returns without waiting. The router runs the
 * loaders of every matched route at once, so the page's code, the Factory list
 * and the shell's queries load alongside the sign-in check instead of each
 * waiting for the guard above it. Components still read and refresh
 * their data through their hooks, so loaders run only when their route is
 * entered, not again on later navigations.
 *
 * The URL is the single source of truth for the active factory: everything
 * factory-scoped lives under `/factories/:factoryId/**` behind `FactoryLayout`.
 */
import type { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router';
import type { LoaderFunctionArgs, RouteObject } from 'react-router';

import { FactoryBoardLanding } from './domains/factory/components/FactoryBoardLanding';
import { AuthPendingSkeleton, RootGuards } from './domains/auth/components/RootGuards';
import { CustomBoardPage, ReviewBoardPage, WorkBoardPage } from './pages/BoardPage';

import type { ApiConfig } from '../api/config';
import { activeRunsQuery } from '../hooks/useActiveRunResources';
import { agentControllerPermissionsQuery } from '../hooks/useAgentControllerPermissions';
import { boardCatalogQuery } from '../hooks/useBoardCatalog';
import { defaultModelQuery } from '../hooks/use-default-model';
import { providersQueryOptions } from '../hooks/use-providers';
import { factoriesQuery, useFactoriesQuery } from '../hooks/useFactories';
import { factoryDecisionHistoryQuery } from '../hooks/useFactoryDecisions';
import { factoryProjectQuery } from '../hooks/useFactoryDefaultModel';
import { serverFeaturesQuery, useServerFeatures } from '../hooks/useServerFeatures';
import { boardQueryOptions } from '../hooks/useWorkItems';
import { workspacesQueryOptions } from '../hooks/useWorkspaces';
import { AGENT_CONTROLLER_ID } from './domains/chat/services/constants';
import { boardDecisionsQuery } from './domains/factory/hooks/useBoardDecisions';
import { ruleDecisionGroup } from './domains/factory/ruleDecisionGroups';
import { isSettingsPath } from './domains/settings/hooks/useSettingsOpen';
import { FactoryLayout } from './domains/workspaces/components/FactoryLayout';
import { AppLayout } from './layouts/AppLayout';
import { lazyPage } from './layouts/PageSuspense';
import { AppRouteErrorPage, RouteErrorPage } from './layouts/RouteErrorPage';
import { pendingCreateFlowFactoryId } from './domains/workspaces/hooks/useCreateFactoryFlow';
import { createFactoryPath } from './domains/workspaces/services/factoryPaths';
import { hasResumableFactoryOnboarding } from './domains/workspaces/services/onboardingFlow';

// Only the boards ship in the startup bundle; every other page loads on first
// visit behind its own loader (see `lazyPage`).
const ThreadPage = lazyPage(() => import('./pages/ThreadPage').then(module => module.ThreadPage));
// A new session opens its thread on the first prompt, so that page loads right after.
const NewPage = lazyPage(() =>
  import('./pages/NewPage').then(module => {
    // A failed preload retries on the visit.
    ThreadPage.preload().catch(() => undefined);
    return module.NewPage;
  }),
);
const KnowledgePage = lazyPage(() => import('./pages/KnowledgePage').then(module => module.KnowledgePage));
const SettingsPage = lazyPage(() => import('./pages/SettingsPage').then(module => module.SettingsPage));
const SlackConnectionPage = lazyPage(() =>
  import('./pages/SlackConnectionPage').then(module => module.SlackConnectionPage),
);
const CreateFactoryPage = lazyPage(() => import('./pages/CreateFactoryPage').then(module => module.CreateFactoryPage));
const RulesPage = lazyPage(() => import('./pages/RulesPage').then(module => module.RulesPage));
const OnboardingPage = lazyPage(
  () => import('./pages/OnboardingPage').then(module => module.OnboardingPage),
  <AuthPendingSkeleton label="Loading page" />,
);
const SignInPage = lazyPage(
  () => import('./pages/SignInPage').then(module => module.SignInPage),
  <AuthPendingSkeleton label="Loading page" />,
);

function RootLanding() {
  const { data: factories, isPending } = useFactoriesQuery();
  // Preserve `routeErrorNotice`-style state through the redirect chain (e.g.
  // FactoryLayout bouncing an unknown factoryId here).
  const { state, search } = useLocation();

  // OAuth callbacks land on `/?github=connected` etc. A mid-way create-factory
  // flow knows the Factory it was opened from, so it resumes there (with the
  // search intact) without waiting on any query.
  const createFlowFactoryId = pendingCreateFlowFactoryId();
  if (createFlowFactoryId) return <Navigate to={`${createFactoryPath(createFlowFactoryId)}${search}`} replace />;

  if (isPending || !factories) return null;

  const firstFactory = factories[0];
  // Empty list is bounced to /onboarding by OnboardingGuard before we render.
  if (!firstFactory) return null;

  // Onboarding does the same once its factory exists (created on repo pick): the
  // GitHub/Linear round-trips must resume the wizard, not land on the factory.
  if (hasResumableFactoryOnboarding(factories)) return <Navigate to={`/onboarding${search}`} replace />;

  return <Navigate to={`/factories/${firstFactory.id}`} replace state={state} />;
}

function FactoryHomeRedirect() {
  const { factoryId } = useParams<{ factoryId: string }>();
  return <FactoryBoardLanding factoryId={factoryId} />;
}

/**
 * Factory-agnostic thread deep link, used by server-built links that don't
 * know a factory id (e.g. the Slack "View Session" card, whose channel
 * sessions are controller-scoped). Forwards to the first factory's workspaces
 * thread route, preserving the query string — the `?sessionId=` override
 * (`?resourceId=` in older links) binds the chat surface to the channel session there.
 */
function ChannelThreadRedirect() {
  const { data: factories, isPending } = useFactoriesQuery();
  const { threadId } = useParams<{ threadId: string }>();
  const { search } = useLocation();

  if (isPending) return null;

  const firstFactory = factories?.[0];
  // Empty list is bounced to /onboarding by OnboardingGuard before we render.
  if (!firstFactory || !threadId) return null;

  return (
    <Navigate
      to={`/factories/${firstFactory.id}/workspaces/channel/threads/${encodeURIComponent(threadId)}${search}`}
      replace
    />
  );
}

/**
 * Factory-agnostic entry to Connections, used by server-built links that do not
 * know a Factory id. Routing through the SPA guarantees the visitor is
 * authenticated before they start the OIDC flow.
 */
function ConnectionsRedirect() {
  const { data: factories, isPending } = useFactoriesQuery();

  if (isPending) return null;

  const firstFactory = factories?.[0];
  // Empty list is bounced to /onboarding by OnboardingGuard before we render.
  if (!firstFactory) return null;

  return <Navigate to={`/factories/${firstFactory.id}/settings/connections`} replace />;
}

/** What the route loaders need to start requests. */
export interface AppRouteServices {
  queryClient: QueryClient;
  api: ApiConfig;
}

type LazyPage = ReturnType<typeof lazyPage>;
type Prefetch = (services: AppRouteServices, args: LoaderFunctionArgs) => void;

/** Loaders run when their route is entered; afterwards the components keep their own data fresh. */
const enteredOnly = () => false;

/**
 * What `OnboardingGuard` reads behind the sign-in check. The check itself is
 * not prefetched: `AuthGuard` sends it when it mounts, right after the loaders
 * return, and asks again on every mount to watch the session, so a prefetched
 * answer arriving first would be fetched twice.
 */
const prefetchGuards: Prefetch = ({ queryClient, api }) => {
  void queryClient.prefetchQuery(factoriesQuery(api.baseUrl));
};

/** What `AppLayout` reads on every Factory page: the chat's permissions and, outside Settings, the sidebar. */
const prefetchShell: Prefetch = ({ queryClient, api }, { params, request }) => {
  const { factoryId, sessionId, threadId, draftSessionId } = params;
  if (!factoryId) return;
  const url = new URL(request.url);
  // Outside a session (and without a `?sessionId=` override) the chat
  // addresses the Factory's own session, whose id is the Factory id; inside one,
  // the id comes from the session lookup (see `ChatSessionConfigProvider`).
  const factoryChat =
    !sessionId &&
    !threadId &&
    !draftSessionId &&
    !url.searchParams.has('sessionId') &&
    !url.searchParams.has('resourceId');
  if (factoryChat) {
    void queryClient.prefetchQuery(
      agentControllerPermissionsQuery({
        agentControllerId: AGENT_CONTROLLER_ID,
        sessionId: factoryId,
        baseUrl: api.baseUrl,
      }),
    );
  }
  if (isSettingsPath(url.pathname)) return;
  void queryClient.prefetchQuery(serverFeaturesQuery(api.client));
  void queryClient.prefetchQuery(boardCatalogQuery(api.client, factoryId));
  void queryClient.prefetchQuery(workspacesQueryOptions(api.baseUrl, factoryId));
  void queryClient.prefetchQuery(boardQueryOptions(api.baseUrl, factoryId));
  void queryClient.prefetchQuery(boardDecisionsQuery(api.baseUrl, factoryId));
  void queryClient.prefetchQuery(activeRunsQuery(AGENT_CONTROLLER_ID, api.baseUrl));
};

/** What the new-session composer reads to pick its model. */
const prefetchComposer: Prefetch = ({ queryClient, api }, { params }) => {
  void queryClient.prefetchQuery(factoryProjectQuery(api.baseUrl, params.factoryId));
  void queryClient.prefetchQuery(defaultModelQuery(api.client));
  void queryClient.prefetchQuery(providersQueryOptions(api.client));
};

const prefetchRuleDecisions: Prefetch = ({ queryClient, api }, { params, request }) => {
  const group = ruleDecisionGroup(new URL(request.url).searchParams.get('group'));
  void queryClient.prefetchInfiniteQuery(
    factoryDecisionHistoryQuery(api.baseUrl, params.factoryId, group.key, group.statuses),
  );
};

function KnowledgeRoute() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const features = useServerFeatures();

  if (features.isPending || !factoryId) return null;
  if (!features.data?.knowledge) return <Navigate to={`/factories/${factoryId}`} replace />;
  return <KnowledgePage />;
}

/**
 * The app's routes. `services` gives the loaders the query cache and API they
 * start requests with (see the header). Without it, as in most tests, the
 * routes have no loaders: the router starts synchronously and every component
 * fetches its own code and data, as it would with nothing prefetched.
 */
export function createAppRoutes(services?: AppRouteServices): RouteObject[] {
  /** Route props whose loader starts the route's page code and queries, once, without waiting for them. */
  const loadOnEntry = (page: LazyPage | undefined, prefetch?: Prefetch) =>
    services
      ? {
          loader: (args: LoaderFunctionArgs): null => {
            // A failed preload retries on the visit.
            page?.preload().catch(() => undefined);
            prefetch?.(services, args);
            return null;
          },
          shouldRevalidate: enteredOnly,
        }
      : {};

  // NOTE: route paths must not (case-insensitively) match a file at the Vite
  // root (src/ui), or dev deep-links serve the module source instead of
  // the app (e.g. /chat used to resolve to a root-level Chat.tsx).
  return [
    {
      path: '/',
      element: <RootGuards />,
      errorElement: <RouteErrorPage />,
      children: [
        {
          // Pathless, so `RootGuards` above renders in the first frame and sends
          // the sign-in check at once; only this subtree waits for the loaders,
          // and the guards cover it until both checks pass.
          hydrateFallbackElement: <AuthPendingSkeleton />,
          ...loadOnEntry(undefined, prefetchGuards),
          children: [
            { index: true, element: <RootLanding /> },
            { path: 'onboarding', element: <OnboardingPage />, ...loadOnEntry(OnboardingPage) },
            {
              path: 'factories/:factoryId',
              element: <FactoryLayout />,
              children: [
                {
                  element: <AppLayout />,
                  ...loadOnEntry(undefined, prefetchShell),
                  children: [
                    {
                      // Errors replace only the page, preserving the shell and its providers.
                      errorElement: <AppRouteErrorPage />,
                      children: [
                        { index: true, element: <FactoryHomeRedirect /> },
                        { path: 'workspaces/:sessionId', element: <NewPage />, ...loadOnEntry(NewPage) },
                        {
                          path: 'workspaces/:sessionId/threads/:threadId',
                          element: <ThreadPage />,
                          ...loadOnEntry(ThreadPage),
                        },
                        { path: 'user/new/:draftSessionId', element: <NewPage />, ...loadOnEntry(NewPage) },
                        { path: 'user/threads/:threadId', element: <ThreadPage />, ...loadOnEntry(ThreadPage) },
                        { path: 'new', element: <NewPage />, ...loadOnEntry(NewPage, prefetchComposer) },
                        { path: 'new-factory', element: <CreateFactoryPage />, ...loadOnEntry(CreateFactoryPage) },
                        { path: 'work', element: <WorkBoardPage /> },
                        { path: 'review', element: <ReviewBoardPage /> },
                        { path: 'boards/:boardId', element: <CustomBoardPage /> },
                        { path: 'activity', element: <FactoryHomeRedirect /> },
                        { path: 'overview', element: <FactoryHomeRedirect /> },
                        { path: 'attention', element: <FactoryHomeRedirect /> },
                        { path: 'metrics', element: <FactoryHomeRedirect /> },
                        { path: 'audit', element: <FactoryHomeRedirect /> },
                        {
                          path: 'rules',
                          element: <RulesPage />,
                          ...loadOnEntry(RulesPage, prefetchRuleDecisions),
                        },
                        { path: 'knowledge', element: <KnowledgeRoute />, ...loadOnEntry(KnowledgePage) },
                        {
                          path: 'settings',
                          children: [
                            { index: true, element: <Navigate to="preferences" replace /> },
                            {
                              path: 'connections/slack',
                              element: <SlackConnectionPage />,
                              ...loadOnEntry(SlackConnectionPage),
                            },
                            { path: ':section', element: <SettingsPage />, ...loadOnEntry(SettingsPage) },
                          ],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
            // Server-built thread deep links without a factory id (Slack cards).
            { path: 'threads/:threadId', element: <ChannelThreadRedirect /> },
            { path: 'settings/connections', element: <ConnectionsRedirect /> },
            // Legacy deep links (the app used to serve everything at any path).
            { path: '*', element: <Navigate to="/" replace /> },
          ],
        },
      ],
    },
    {
      // No loader: the page renders in the first frame and loads its own code and check.
      path: '/signin',
      element: <SignInPage />,
      errorElement: <RouteErrorPage />,
    },
  ];
}

export function createAppRouter(services: AppRouteServices) {
  return createBrowserRouter(createAppRoutes(services));
}
