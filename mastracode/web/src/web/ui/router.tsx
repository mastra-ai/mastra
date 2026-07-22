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
import { ReviewBoardPage, WorkBoardPage } from './pages/BoardPage';
import { CreateFactoryPage } from './pages/CreateFactoryPage';
import { MetricsPage } from './pages/MetricsPage';
import { NewPage } from './pages/NewPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { OverviewPage } from './pages/OverviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { RulesPage } from './pages/RulesPage';
import { SignInPage } from './pages/SignInPage';
import { ThreadPage } from './pages/ThreadPage';
import { Notice } from '@mastra/playground-ui/components/Notice';

import { useFactoriesQuery, useFactoryQuery } from '../../shared/hooks/useFactories';
import { useWorkspacesQuery } from '../../shared/hooks/useWorkspaces';
import { FactoryLayout } from './domains/workspaces/components/FactoryLayout';
import { AuthPendingSkeleton } from './domains/auth/components/RootGuards';

function RootLanding() {
  const { data: factories, isPending } = useFactoriesQuery();
  // Preserve `routeErrorNotice`-style state through the redirect chain (e.g.
  // FactoryLayout bouncing an unknown factoryId here).
  const { state } = useLocation();

  if (isPending) return null;

  const firstFactory = factories?.[0];
  // Empty list is bounced to /onboarding by OnboardingGuard before we render.
  if (!firstFactory) return null;

  return <Navigate to={`/factories/${firstFactory.id}`} replace state={state} />;
}

function FactoryHomeRedirect() {
  const { factoryId } = useParams<{ factoryId: string }>();
  const factory = useFactoryQuery(factoryId);
  const firstRepository = factory.data?.repositories[0];
  const workspaces = useWorkspacesQuery(firstRepository?.projectRepositoryId);

  if (factory.isPending || workspaces.isPending) return <AuthPendingSkeleton label="Loading workspaces" />;
  if (factory.isError || workspaces.isError) {
    return (
      <div className="grid h-dvh w-full place-items-center bg-surface1 px-4">
        <Notice variant="destructive">Could not load workspaces. Check the server connection and reload.</Notice>
      </div>
    );
  }

  const firstWorkspace = workspaces.data?.workspaces[0];
  if (firstWorkspace) return <Navigate to={`workspaces/${firstWorkspace.sessionId}`} replace />;

  return (
    <div className="grid h-full min-h-96 place-items-center bg-surface1 px-6 text-center">
      <div className="max-w-md space-y-3">
        <h1 className="text-lg font-semibold text-icon6">Create a workspace</h1>
        <p className="text-sm text-icon3">
          This Factory does not have any workspaces yet. Create one from the sidebar to start chatting in a
          repository session.
        </p>
      </div>
    </div>
  );
}

export function createAppRoutes(): RouteObject[] {
  // NOTE: route paths must not (case-insensitively) match a file at the Vite
  // root (src/web/ui), or dev deep-links serve the module source instead of
  // the app (e.g. /chat used to resolve to a root-level Chat.tsx).
  return [
    {
      path: '/',
      element: <RootGuards />,
      children: [
        { index: true, element: <RootLanding /> },
        { path: 'onboarding', element: <OnboardingPage /> },
        { path: 'factories/create', element: <CreateFactoryPage /> },
        {
          path: 'factories/:factoryId',
          element: <FactoryLayout />,
          children: [
            { index: true, element: <FactoryHomeRedirect /> },
            {
              path: 'workspaces/:sessionId',
              element: <Chat />,
              children: [
                { index: true, element: <NewPage /> },
                { path: 'threads/:threadId', element: <ThreadPage /> },
              ],
            },
            {
              path: 'user/threads/:threadId',
              element: <Chat />,
              children: [{ index: true, element: <ThreadPage /> }],
            },
            {
              element: <Chat />,
              children: [
                { path: 'new', element: <NewPage /> },
                { path: 'overview', element: <OverviewPage /> },
                { path: 'work', element: <WorkBoardPage /> },
                { path: 'review', element: <ReviewBoardPage /> },
                { path: 'metrics', element: <MetricsPage /> },
                { path: 'rules', element: <RulesPage /> },
                { path: 'audit', element: <AuditPage /> },
                {
                  path: 'settings',
                  children: [
                    { index: true, element: <Navigate to="general" replace /> },
                    { path: ':section', element: <SettingsPage /> },
                  ],
                },
              ],
            },
          ],
        },
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
