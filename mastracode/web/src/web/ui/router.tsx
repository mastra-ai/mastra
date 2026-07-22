/**
 * SPA route table (React Router v7, data mode).
 *
 * Auth gating happens in React layout components, not loaders: `RequireAuth`
 * wraps the app routes and reads `/auth/me` through the `useFactoryAuth` custom
 * React Query hook (shared cache key with the rest of the UI), redirecting
 * unauthenticated sessions to `/signin` when web auth is enabled. `SignInGate`
 * mirrors the guard: signed-in (or auth-disabled) visitors are sent back to
 * `/` so the app can choose the active factory's board or draft composer.
 */
import { createBrowserRouter, Navigate } from 'react-router';
import type { RouteObject } from 'react-router';

import { SignInPage } from './domains/auth';
import Chat from './domains/chat/Chat';
import { NewPage } from './domains/chat/NewPage';
import { ThreadPage } from './domains/chat/ThreadPage';
import { SettingsPage } from './domains/settings/SettingsPage';
import { DEFAULT_SETTINGS_PATH } from './domains/settings/settingsSections';

import { AuditPage } from './domains/factory/AuditPage';
import { ReviewBoardPage, WorkBoardPage } from './domains/factory/BoardPage';
import { MetricsPage } from './domains/factory/MetricsPage';
import { OverviewPage } from './domains/factory/OverviewPage';
import { RootGuards } from './domains/auth/components/RootGuards';
import { CreateFactoryPage } from './pages/CreateFactoryPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { useActiveFactoryContext } from './domains/workspaces/context/ActiveFactoryProvider';
import { isServerFactory } from './domains/workspaces/services/factories';

function RootLanding() {
  const { activeFactory } = useActiveFactoryContext();

  if (!activeFactory) return null;

  return <Navigate to={isServerFactory(activeFactory) ? '/factory/work' : '/new'} replace />;
}

function RedirectToDraftThread() {
  return <Navigate to="/new" replace />;
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
            { path: 'factory/overview', element: <OverviewPage /> },
            { path: 'factory/work', element: <WorkBoardPage /> },
            { path: 'factory/review', element: <ReviewBoardPage /> },
            { path: 'factory/metrics', element: <MetricsPage /> },
            { path: 'factory/audit', element: <AuditPage /> },
            { path: 'factories/create', element: <CreateFactoryPage /> },
            {
              path: 'settings',
              children: [
                { index: true, element: <Navigate to={DEFAULT_SETTINGS_PATH} replace /> },
                { path: ':section', element: <SettingsPage /> },
              ],
            },
            // Compatibility routes from the former combined Board.
            { path: 'factory/board', element: <Navigate to="/factory/work" replace /> },
            { path: 'factory/intake', element: <Navigate to="/factory/work" replace /> },
          ],
        },
        // Legacy deep links (the app used to serve everything at any path).
        { path: '*', element: <RedirectToDraftThread /> },
      ],
    },
    { path: '/signin', element: <SignInPage /> },
  ];
}

export function createAppRouter() {
  return createBrowserRouter(createAppRoutes());
}
