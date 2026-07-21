/**
 * SPA route table (React Router v7, data mode).
 *
 * Auth gating happens in React layout components, not loaders: `RequireAuth`
 * wraps the app routes and reads `/auth/me` through the `useWebAuth` custom
 * React Query hook (shared cache key with the rest of the UI), redirecting
 * unauthenticated sessions to `/signin` when web auth is enabled. `SignInGate`
 * mirrors the guard: signed-in (or auth-disabled) visitors are sent back to
 * `/` so the app can choose the active factory's board or draft composer.
 */
import { Notice } from '@mastra/playground-ui/components/Notice';
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { createBrowserRouter, Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import type { RouteObject } from 'react-router';

import { safeReturnTo, SignInPage, useWebAuth } from './domains/auth';
import Chat from './domains/chat/Chat';
import { NewPage } from './domains/chat/NewPage';
import { ThreadPage } from './domains/chat/ThreadPage';
import { useActiveFactory } from '../../shared/hooks/useActiveFactory';
import { useWorkItemsQuery } from '../../shared/hooks/useWorkItems';
import { isServerFactory } from './domains/workspaces/services/factories';
import { AuditPage } from './domains/factory/AuditPage';
import { BoardPage } from './domains/factory/BoardPage';
import { MetricsPage } from './domains/factory/MetricsPage';
import { OverviewPage } from './domains/factory/OverviewPage';

/**
 * Full-page placeholder while `/auth/me` resolves — a shimmer block instead
 * of a blank screen on deep links / refreshes.
 */
function AuthPendingSkeleton({ label = 'Checking sign-in' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex h-dvh w-full items-center justify-center bg-surface1">
      <div className="flex w-64 flex-col gap-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  );
}

/**
 * Root layout guard. Shows a skeleton while the auth state resolves (one
 * cached query, shared with the sidebar identity UI) so the app neither
 * flashes protected content nor bounces through /signin on refresh.
 */
function RequireAuth() {
  const auth = useWebAuth();
  const location = useLocation();
  if (auth.isPending) return <AuthPendingSkeleton />;
  const state = auth.data;
  if (state?.authEnabled && !state.authenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/signin?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }
  return <Outlet />;
}

/** Inverse guard for /signin: only unauthenticated (auth-enabled) users stay. */
function SignInGate() {
  const auth = useWebAuth();
  const [searchParams] = useSearchParams();
  if (auth.isPending) return <AuthPendingSkeleton />;
  const state = auth.data;
  if (!state?.authEnabled || state.authenticated) {
    return <Navigate to={safeReturnTo(searchParams.get('returnTo') ?? undefined)} replace />;
  }
  return <SignInPage />;
}

function RootLanding() {
  const { activeFactory } = useActiveFactory();
  const factoryProjectId =
    activeFactory && isServerFactory(activeFactory) ? activeFactory.binding.factoryProjectId : undefined;
  const workItems = useWorkItemsQuery(factoryProjectId);

  if (factoryProjectId && workItems.isPending) return <AuthPendingSkeleton label="Loading Factory board" />;
  if (factoryProjectId && workItems.isError) {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-surface1 p-4">
        <Notice variant="destructive">
          {workItems.error instanceof Error ? workItems.error.message : 'Failed to load Factory work'}
        </Notice>
      </div>
    );
  }
  return <Navigate to={factoryProjectId && (workItems.data?.length ?? 0) > 0 ? '/factory/board' : '/new'} replace />;
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
      element: <RequireAuth />,
      children: [
        { index: true, element: <RootLanding /> },
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
            { path: 'factory/board', element: <BoardPage /> },
            { path: 'factory/overview', element: <OverviewPage /> },
            { path: 'factory/metrics', element: <MetricsPage /> },
            { path: 'factory/audit', element: <AuditPage /> },
            // Legacy Factory pages, folded into the Board.
            { path: 'factory/intake', element: <Navigate to="/factory/board" replace /> },
            { path: 'factory/review', element: <Navigate to="/factory/board" replace /> },
          ],
        },
        // Legacy deep links (the app used to serve everything at any path).
        { path: '*', element: <RedirectToDraftThread /> },
      ],
    },
    { path: '/signin', element: <SignInGate /> },
  ];
}

export function createAppRouter() {
  return createBrowserRouter(createAppRoutes());
}
