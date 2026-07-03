/**
 * SPA route table (React Router v7, data mode).
 *
 * Auth gating happens in route loaders: the root layout loader resolves
 * `/auth/me` through the shared React Query cache (`queryClient.fetchQuery`
 * under the same key `useWebAuth` reads, so the sidebar reuses the entry
 * without a second fetch) and redirects unauthenticated sessions to `/signin`
 * when web auth is enabled. `/signin` mirrors the guard: signed-in (or
 * auth-disabled) visitors are sent back to `/chat`.
 */
import type { QueryClient } from '@tanstack/react-query';
import { createBrowserRouter, Outlet, redirect } from 'react-router';
import type { RouteObject } from 'react-router';

import { queryKeys } from '../../shared/api/keys';
import Chat from './Chat';
import { fetchAuthState, SignInPage } from './domains/auth';

/**
 * Loaders on `/` and `/signin` can both run for one navigation; the staleTime
 * lets `fetchQuery` serve the second call (and StrictMode re-runs) from cache
 * instead of hitting `/auth/me` again.
 */
const AUTH_STALE_TIME_MS = 30_000;

function loadAuthState(queryClient: QueryClient) {
  return queryClient.fetchQuery({
    queryKey: queryKeys.webAuth(),
    queryFn: fetchAuthState,
    staleTime: AUTH_STALE_TIME_MS,
  });
}

export function createAppRoutes(queryClient: QueryClient): RouteObject[] {
  return [
    {
      path: '/',
      element: <Outlet />,
      loader: async () => {
        const state = await loadAuthState(queryClient);
        if (state.authEnabled && !state.authenticated) throw redirect('/signin');
        return state;
      },
      children: [
        { index: true, loader: () => redirect('/chat') },
        { path: 'chat', element: <Chat /> },
        // Legacy deep links (the app used to serve everything at any path).
        // `element: null` keeps React Router from warning about a leaf route
        // with no element; the loader always redirects before render.
        { path: '*', element: null, loader: () => redirect('/chat') },
      ],
    },
    {
      path: '/signin',
      element: <SignInPage />,
      loader: async () => {
        const state = await loadAuthState(queryClient);
        if (!state.authEnabled || state.authenticated) throw redirect('/chat');
        return state;
      },
    },
  ];
}

export function createAppRouter(queryClient: QueryClient) {
  return createBrowserRouter(createAppRoutes(queryClient));
}
