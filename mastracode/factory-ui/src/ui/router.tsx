/**
 * SPA route table (React Router v7, data mode).
 *
 * Auth gating happens in React layout components, not loaders: `RequireAuth`
 * wraps the app routes and reads `/auth/me` through the `useFactoryAuth` custom
 * React Query hook (shared cache key with the rest of the UI), redirecting
 * unauthenticated sessions to `/signin` when web auth is enabled. `SignInGate`
 * mirrors the guard: signed-in (or auth-disabled) visitors are sent back to
 * `/` so the app can choose the active factory's board or draft composer.
 *
 * The URL is the single source of truth for the active factory: everything
 * factory-scoped lives under `/factories/:factoryId/**` behind `FactoryLayout`.
 */
import { createBrowserRouter, Navigate, useLocation, useParams } from 'react-router';
import type { RouteObject } from 'react-router';

import Chat from './domains/chat/Chat';
import { RootGuards } from './domains/auth/components/RootGuards';
import { AuditPage } from './pages/AuditPage';
import { ActivityPage } from './pages/ActivityPage';
import { AttentionPage } from './pages/AttentionPage';
import { KnowledgePage } from './pages/KnowledgePage';
import { ReviewBoardPage, WorkBoardPage } from './pages/BoardPage';
import { CreateFactoryPage } from './pages/CreateFactoryPage';
import { NewPage } from './pages/NewPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { SlackConnectionPage } from './pages/SlackConnectionPage';
import { RulesPage } from './pages/RulesPage';
import { SignInPage } from './pages/SignInPage';
import { SupervisorPage } from './pages/SupervisorPage';
import { ThreadPage } from './pages/ThreadPage';

import { useFactoriesQuery } from '../hooks/useFactories';
import { useServerFeatures } from '../hooks/useServerFeatures';
import { FactoryLayout } from './domains/workspaces/components/FactoryLayout';
import { pendingCreateFlowFactoryId } from './domains/workspaces/hooks/useCreateFactoryFlow';
import { createFactoryPath } from './domains/workspaces/services/factoryPaths';
import { hasResumableFactoryOnboarding } from './domains/workspaces/services/onboardingFlow';

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
  return <Navigate to="work" replace />;
}

/** `/metrics` shipped before the page became the Overview — keep old links alive. */
function MetricsRedirect() {
  const { factoryId } = useParams<{ factoryId: string }>();
  return <Navigate to={`/factories/${factoryId}/overview`} replace />;
}

/**
 * Factory-agnostic thread deep link, used by server-built links that don't
 * know a factory id (e.g. the Slack "View Session" card, whose channel
 * sessions are controller-scoped). Forwards to the first factory's workspaces
 * thread route, preserving the query string — the `?resourceId=` override
 * binds the chat surface to the channel session's resource there.
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

function KnowledgeRoute() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const features = useServerFeatures();

  if (features.isPending || !factoryId) return null;
  if (!features.data?.knowledge) return <Navigate to={`/factories/${factoryId}/overview`} replace />;
  return <KnowledgePage />;
}

export function createAppRoutes(): RouteObject[] {
  // NOTE: route paths must not (case-insensitively) match a file at the Vite
  // root (src/ui), or dev deep-links serve the module source instead of
  // the app (e.g. /chat used to resolve to a root-level Chat.tsx).
  return [
    {
      path: '/',
      element: <RootGuards />,
      children: [
        { index: true, element: <RootLanding /> },
        { path: 'onboarding', element: <OnboardingPage /> },
        {
          path: 'factories/:factoryId',
          element: <FactoryLayout />,
          children: [
            {
              element: <Chat />,
              children: [{ index: true, element: <FactoryHomeRedirect /> }],
            },
            {
              path: 'workspaces/:sessionId',
              element: <Chat />,
              children: [
                { index: true, element: <NewPage /> },
                { path: 'threads/:threadId', element: <ThreadPage /> },
              ],
            },
            {
              path: 'user/new/:draftSessionId',
              element: <Chat />,
              children: [{ index: true, element: <NewPage /> }],
            },
            {
              path: 'user/threads/:threadId',
              element: <Chat />,
              children: [{ index: true, element: <ThreadPage /> }],
            },
            {
              path: 'supervisor',
              element: <Chat />,
              children: [{ index: true, element: <SupervisorPage /> }],
            },
            {
              element: <Chat />,
              children: [
                { path: 'new', element: <NewPage /> },
                { path: 'new-factory', element: <CreateFactoryPage /> },
                { path: 'work', element: <WorkBoardPage /> },
                { path: 'review', element: <ReviewBoardPage /> },
                { path: 'overview', element: <OverviewPage /> },
                { path: 'attention', element: <AttentionPage /> },
                { path: 'activity', element: <ActivityPage /> },
                { path: 'metrics', element: <MetricsRedirect /> },
                { path: 'rules', element: <RulesPage /> },
                { path: 'audit', element: <AuditPage /> },
                { path: 'knowledge', element: <KnowledgeRoute /> },
                {
                  path: 'settings',
                  children: [
                    { index: true, element: <Navigate to="preferences" replace /> },
                    { path: 'connections/slack', element: <SlackConnectionPage /> },
                    { path: ':section', element: <SettingsPage /> },
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
    { path: '/signin', element: <SignInPage /> },
  ];
}

export function createAppRouter() {
  return createBrowserRouter(createAppRoutes());
}
