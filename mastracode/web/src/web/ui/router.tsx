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
import { createBrowserRouter, Navigate, useLocation } from 'react-router';
import type { RouteObject } from 'react-router';

import Chat from './domains/chat/Chat';
import { RootGuards } from './domains/auth/components/RootGuards';
import { AuditPage } from './pages/AuditPage';
import { ReviewBoardPage, WorkBoardPage } from './pages/BoardPage';
import { CreateFactoryLayout } from './pages/CreateFactoryLayout';
import { CreateFactoryPage } from './pages/CreateFactoryPage';
import { MetricsPage } from './pages/MetricsPage';
import { NewPage } from './pages/NewPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { SettingsPage } from './pages/SettingsPage';
import { RulesPage } from './pages/RulesPage';
import { SignInPage } from './pages/SignInPage';
import { ThreadPage } from './pages/ThreadPage';
import { useFactoriesQuery } from '../../shared/hooks/useFactories';
import { FactoryLayout } from './domains/workspaces/components/FactoryLayout';
import { factoryHomePath } from './domains/workspaces/services/factoryPaths';

function RootLanding() {
  const { data: factories, isPending } = useFactoriesQuery();
  // Preserve `routeErrorNotice`-style state through the redirect chain (e.g.
  // FactoryLayout bouncing an unknown factoryId here).
  const { state } = useLocation();

  if (isPending) return null;

  const firstFactory = factories?.[0];
  // Empty list is bounced to /onboarding by OnboardingGuard before we render.
  if (!firstFactory) return null;

  return <Navigate to={factoryHomePath(firstFactory)} replace state={state} />;
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
        {
          path: 'factories/create',
          element: <CreateFactoryLayout />,
          children: [
            {
              element: <Chat />,
              children: [{ index: true, element: <CreateFactoryPage /> }],
            },
          ],
        },
        {
          path: 'factories/:factoryId',
          element: <FactoryLayout />,
          children: [
            {
              // Pathless layout: <Chat /> (providers, session, SSE stream) stays
              // mounted while navigating between thread URLs, so thread navigation
              // never tears down or reconnects the session.
              element: <Chat />,
              children: [
                { path: 'new', element: <NewPage /> },
                { path: 'threads/:threadId', element: <ThreadPage /> },
                // Personal (non-factory) sessions: same thread page, but the
                // session provider binds to the user's own resourceId + worktree.
                { path: 'user/threads/:threadId', element: <ThreadPage /> },
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
