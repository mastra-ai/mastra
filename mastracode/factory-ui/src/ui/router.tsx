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
 * The URL is the single source of truth for the active factory: everything
 * factory-scoped lives under `/factories/:factoryId/**` behind `FactoryLayout`.
 */
import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router';
import type { RouteObject } from 'react-router';

import { FactoryBoardLanding } from './domains/factory/components/FactoryBoardLanding';
import { boardConfigPath, boardSkillsPath, newBoardPath } from './domains/boardConfig/boardConfigPaths';
import { AuthPendingSkeleton, RootGuards } from './domains/auth/components/RootGuards';
import { PULL_REQUEST_SOURCE_FILTER } from './domains/factory/boardSourceFilters';
import { CustomBoardPage, WorkBoardPage } from './pages/BoardPage';

import { useBoardCatalog } from '../hooks/useBoardCatalog';
import { useFactoriesQuery } from '../hooks/useFactories';
import { useServerFeatures } from '../hooks/useServerFeatures';
import { FactoryLayout } from './domains/workspaces/components/FactoryLayout';
import { AppLayout } from './layouts/AppLayout';
import { AppPageLoader } from './layouts/AppPageLoader';
import { lazyPage } from './layouts/PageSuspense';
import type { LazyPageComponent } from './layouts/PageSuspense';
import { AppRouteErrorPage, RouteErrorPage } from './layouts/RouteErrorPage';
import {
  createLoadOnEntry,
  prefetchBoard,
  prefetchComposer,
  prefetchFactories,
  prefetchFactoryLayout,
  prefetchRuleDecisions,
  prefetchSidebar,
} from './routeLoaders';
import type { Prefetch, RouteLoaderServices } from './routeLoaders';
import { pendingCreateFlowFactoryId } from './domains/workspaces/hooks/useCreateFactoryFlow';
import { createFactoryPath } from './domains/workspaces/services/factoryPaths';
import { hasResumableFactoryOnboarding } from './domains/workspaces/services/onboardingFlow';

// Only the boards ship in the startup bundle; every other page loads on first
// visit behind its own loader (see `lazyPage`).
const ThreadPage = lazyPage(() => import('./pages/ThreadPage').then(module => module.ThreadPage), <AppPageLoader />);
// A new session opens its thread on the first prompt, so that page loads right after.
const NewPage = lazyPage(
  () =>
    import('./pages/NewPage').then(module => {
      // A failed preload retries on the visit.
      ThreadPage.preload().catch(() => undefined);
      return module.NewPage;
    }),
  <AppPageLoader />,
);
const KnowledgePage = lazyPage(
  () => import('./pages/KnowledgePage').then(module => module.KnowledgePage),
  <AppPageLoader />,
);
const SettingsPage = lazyPage(
  () => import('./pages/SettingsPage').then(module => module.SettingsPage),
  <AppPageLoader />,
);
const FactorySkillsPage = lazyPage(
  () => import('./pages/FactorySkillsPage').then(module => module.FactorySkillsPage),
  <AppPageLoader />,
);
const NewBoardPage = lazyPage(
  () => import('./pages/NewBoardPage').then(module => module.NewBoardPage),
  <AppPageLoader />,
);
const BoardConfigPage = lazyPage(
  () => import('./pages/BoardConfigPage').then(module => module.BoardConfigPage),
  <AppPageLoader />,
);
const SlackConnectionPage = lazyPage(
  () => import('./pages/SlackConnectionPage').then(module => module.SlackConnectionPage),
  <AppPageLoader />,
);
const CreateFactoryPage = lazyPage(
  () => import('./pages/CreateFactoryPage').then(module => module.CreateFactoryPage),
  <AppPageLoader />,
);
const CredentialRequestPage = lazyPage(
  () => import('./pages/CredentialRequestPage').then(module => module.CredentialRequestPage),
  <AppPageLoader />,
);
const RulesPage = lazyPage(() => import('./pages/RulesPage').then(module => module.RulesPage), <AppPageLoader />);
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

/**
 * The retired Review board's links (`/review?item=…`) open that board while the project still has open
 * cards on it, and otherwise Work filtered to pull requests alone, keeping the rest of their query.
 */
function RetiredReviewBoardRedirect() {
  const { search } = useLocation();
  const { factoryId } = useParams<{ factoryId: string }>();
  const catalog = useBoardCatalog(factoryId);
  if (catalog.isPending) return null;
  if (catalog.data?.some(board => board.id === 'review'))
    return <Navigate to={`../boards/review${search}`} relative="path" replace />;
  const params = new URLSearchParams(search);
  // Picked sources widen the filter, so any other source would show cards the Review board never held.
  params.set('source', PULL_REQUEST_SOURCE_FILTER);
  return <Navigate to={`../work?${params}`} relative="path" replace />;
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

/**
 * Boards used to be edited in Settings: old links (`?board=…`, `?new=1`) open that board's settings, the
 * new-board form, or the Work board's settings.
 */
function BoardSettingsRedirect() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const { search } = useLocation();
  if (!factoryId) return null;
  const params = new URLSearchParams(search);
  if (params.has('new')) return <Navigate to={newBoardPath(factoryId)} replace />;
  return <Navigate to={boardConfigPath(factoryId, params.get('board') ?? 'work')} replace />;
}

/** Skills used to live in Settings; old links open them beside the Work board's settings. */
function SkillsSettingsRedirect() {
  const { factoryId } = useParams<{ factoryId: string }>();
  if (!factoryId) return null;
  return <Navigate to={boardSkillsPath(factoryId, 'work')} replace />;
}

function KnowledgeRoute() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const features = useServerFeatures();

  if (!factoryId) return null;
  if (features.isPending) return <AppPageLoader />;
  if (!features.data?.knowledge) return <Navigate to={`/factories/${factoryId}`} replace />;
  return <KnowledgePage />;
}

export function createAppRoutes(services?: RouteLoaderServices): RouteObject[] {
  const loadOnEntry = createLoadOnEntry(services);
  const lazyRoute = (Page: LazyPageComponent, prefetch?: Prefetch) => ({
    element: <Page />,
    ...loadOnEntry(prefetch, Page),
  });

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
          // Pathless, so `RootGuards` renders and sends the sign-in check before these loaders settle.
          hydrateFallbackElement: <AuthPendingSkeleton />,
          ...loadOnEntry(prefetchFactories),
          children: [
            { index: true, element: <RootLanding /> },
            { path: 'onboarding', ...lazyRoute(OnboardingPage) },
            {
              path: 'factories/:factoryId',
              element: <FactoryLayout />,
              ...loadOnEntry(prefetchFactoryLayout),
              children: [
                {
                  element: <AppLayout />,
                  // Load the chat code while its session links appear, before "Open session" is clicked.
                  ...loadOnEntry(prefetchSidebar, ThreadPage),
                  children: [
                    {
                      // Errors replace only the page, preserving the shell and its providers.
                      errorElement: <AppRouteErrorPage />,
                      children: [
                        { index: true, element: <FactoryHomeRedirect /> },
                        { path: 'workspaces/:sessionId', ...lazyRoute(NewPage, prefetchComposer) },
                        { path: 'workspaces/:sessionId/threads/:threadId', ...lazyRoute(ThreadPage) },
                        { path: 'user/new/:draftSessionId', ...lazyRoute(NewPage, prefetchComposer) },
                        { path: 'user/threads/:threadId', ...lazyRoute(ThreadPage) },
                        { path: 'new', ...lazyRoute(NewPage, prefetchComposer) },
                        { path: 'new-factory', ...lazyRoute(CreateFactoryPage) },
                        { path: 'new-board', ...lazyRoute(NewBoardPage) },
                        { path: 'work', element: <WorkBoardPage />, ...loadOnEntry(prefetchBoard) },
                        // The Review board was retired: new pull requests live on Work.
                        { path: 'review', element: <RetiredReviewBoardRedirect />, ...loadOnEntry(prefetchBoard) },
                        { path: 'boards/:boardId', element: <CustomBoardPage />, ...loadOnEntry(prefetchBoard) },
                        { path: 'work/config/:phaseKey?', ...lazyRoute(BoardConfigPage) },
                        { path: 'boards/:boardId/config/:phaseKey?', ...lazyRoute(BoardConfigPage) },
                        { path: 'work/skills', ...lazyRoute(FactorySkillsPage) },
                        { path: 'boards/:boardId/skills', ...lazyRoute(FactorySkillsPage) },
                        { path: 'activity', element: <FactoryHomeRedirect /> },
                        { path: 'overview', element: <FactoryHomeRedirect /> },
                        { path: 'attention', element: <FactoryHomeRedirect /> },
                        { path: 'metrics', element: <FactoryHomeRedirect /> },
                        { path: 'audit', element: <FactoryHomeRedirect /> },
                        { path: 'rules', ...lazyRoute(RulesPage, prefetchRuleDecisions) },
                        // No preload: the page redirects away unless the server enables Knowledge.
                        { path: 'knowledge', element: <KnowledgeRoute /> },
                        {
                          path: 'settings',
                          children: [
                            { index: true, element: <Navigate to="preferences" replace /> },
                            { path: 'connections/slack', ...lazyRoute(SlackConnectionPage) },
                            { path: 'board', element: <BoardSettingsRedirect /> },
                            { path: 'skills', element: <SkillsSettingsRedirect /> },
                            { path: ':section', ...lazyRoute(SettingsPage) },
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
            // One-time private credential entry links built by the agent tool (no factory id).
            { path: 'credentials/:requestId', ...lazyRoute(CredentialRequestPage) },
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

export function createAppRouter(services: RouteLoaderServices) {
  return createBrowserRouter(createAppRoutes(services));
}
