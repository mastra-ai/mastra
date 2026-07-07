/**
 * SPA route table (React Router v7, data mode).
 *
 * Auth gating happens in React layout components, not loaders: `RequireAuth`
 * wraps the app routes and reads `/auth/me` through the `useWebAuth` custom
 * React Query hook (shared cache key with the rest of the UI), redirecting
 * unauthenticated sessions to `/signin` when web auth is enabled. `SignInGate`
 * mirrors the guard: signed-in (or auth-disabled) visitors are sent back to
 * `/` so the app can render the draft composer.
 */
import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { createBrowserRouter, Navigate, Outlet } from 'react-router';
import type { RouteObject } from 'react-router';

import { SignInPage, useWebAuth } from './domains/auth';
import Chat from './domains/chat/Chat';

/**
 * Full-page placeholder while `/auth/me` resolves — a shimmer block instead
 * of a blank screen on deep links / refreshes.
 */
function AuthPendingSkeleton() {
  return (
    <div
      role="status"
      aria-label="Checking sign-in"
      className="flex h-dvh w-full items-center justify-center bg-surface1"
    >
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
  if (auth.isPending) return <AuthPendingSkeleton />;
  const state = auth.data;
  if (state?.authEnabled && !state.authenticated) return <Navigate to="/signin" replace />;
  return <Outlet />;
}

/** Inverse guard for /signin: only unauthenticated (auth-enabled) users stay. */
function SignInGate() {
  const auth = useWebAuth();
  if (auth.isPending) return <AuthPendingSkeleton />;
  const state = auth.data;
  if (!state?.authEnabled || state.authenticated) return <Navigate to="/" replace />;
  return <SignInPage />;
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
        { index: true, element: <RedirectToDraftThread /> },
        {
          // Pathless layout: <Chat /> (providers, session, SSE stream) stays
          // mounted while navigating between thread URLs, so thread navigation
          // never tears down or reconnects the session.
          element: <Chat />,
          children: [
            // The leaf renders nothing itself (explicit null element): <Chat />
            // reads the route and renders the whole page.
            { path: 'new', element: null },
            { path: 'threads/:threadId', element: null },
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
