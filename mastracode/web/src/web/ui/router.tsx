/**
 * SPA route table (React Router v7, data mode).
 *
 * Auth gating happens in React layout components, not loaders: `RequireAuth`
 * wraps the app routes and reads `/auth/me` through the `useWebAuth` custom
 * React Query hook (shared cache key with the rest of the UI), redirecting
 * unauthenticated sessions to `/signin` when web auth is enabled. `SignInGate`
 * mirrors the guard: signed-in (or auth-disabled) visitors are sent back to
 * `/` so the app can choose the active factory's board or draft composer.
 *
 * The active factory is resolved from the `/factories/:factoryId` URL param —
 * the URL is the single source of truth. `ActiveFactoryLayout` mounts the
 * `ActiveFactoryProvider` for every factory-scoped route and bounces unknown
 * factory ids back to `/`.
 */
import { createBrowserRouter, Navigate, useParams, useSearchParams } from 'react-router';
import type { RouteObject } from 'react-router';

import { useFactoriesQuery } from '../../shared/hooks/useFactories';
import { useWebAuth } from '../../shared/hooks/useWebAuth';
import { safeReturnTo, SignInPage } from './domains/auth';
import { AuthPendingSkeleton } from './domains/auth/components/RootGuards';
import Chat from './domains/chat/Chat';
import { NewPage } from './domains/chat/NewPage';
import { ThreadPage } from './domains/chat/ThreadPage';

import { AuditPage } from './domains/factory/AuditPage';
import { ReviewBoardPage, WorkBoardPage } from './domains/factory/BoardPage';
import { MetricsPage } from './domains/factory/MetricsPage';
import { OverviewPage } from './domains/factory/OverviewPage';
import { RootGuards } from './domains/auth/components/RootGuards';
import { OnboardingPage } from './pages/OnboardingPage';
import { ActiveFactoryLayout } from './domains/workspaces';
import { isServerFactory } from './domains/workspaces/services/factories';

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
  const { data: factories, isPending } = useFactoriesQuery();

  if (isPending) return null;

  const first = factories?.[0];
  // OnboardingGuard handles this when auth is enabled; with auth disabled the
  // landing route sends first-run visitors to the same factory-creation page.
  if (!first) return <Navigate to="/onboarding" replace />;

  // Server factories land on the board; local factories on the draft composer.
  const subpage = isServerFactory(first) ? 'work' : 'new';
  return <Navigate to={`/factories/${first.id}/${subpage}`} replace />;
}

/**
 * Pre-URL-param bookmarks (`/factory/work`, `/new`, `/threads/:id`, …) carried
 * no factory id; send them to the first factory with the same sub-page.
 */
function LegacyFactoryRedirect({ suffix }: { suffix: string }) {
  const { data: factories, isPending } = useFactoriesQuery();

  if (isPending) return null;

  const first = factories?.[0];
  if (!first) return <Navigate to="/" replace />;
  return <Navigate to={`/factories/${first.id}${suffix}`} replace />;
}

const LEGACY_FACTORY_SUBPAGES = new Set(['overview', 'work', 'review', 'metrics', 'audit']);

/** `/factory/*` (e.g. `/factory/board`, `/factory/metrics`) → factory-scoped sub-page. */
function LegacyFactorySubpageRedirect() {
  const splat = useParams()['*'] ?? '';
  const subpage = splat.split('/')[0];
  const suffix = LEGACY_FACTORY_SUBPAGES.has(subpage) ? `/${subpage}` : '/work';
  return <LegacyFactoryRedirect suffix={suffix} />;
}

function LegacyThreadRedirect({ userScoped = false }: { userScoped?: boolean }) {
  const { threadId } = useParams<{ threadId: string }>();
  const suffix = `${userScoped ? '/user' : ''}/threads/${encodeURIComponent(threadId ?? '')}`;
  return <LegacyFactoryRedirect suffix={suffix} />;
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
          path: 'factories/:factoryId',
          element: <ActiveFactoryLayout />,
          children: [
            {
              // Pathless layout: <Chat /> (providers, session, SSE stream) stays
              // mounted while navigating between thread URLs, so thread navigation
              // never tears down or reconnects the session.
              element: <Chat />,
              children: [
                { index: true, element: <Navigate to="new" replace /> },
                { path: 'new', element: <NewPage /> },
                { path: 'threads/:threadId', element: <ThreadPage /> },
                // Personal (non-factory) sessions: same thread page, but the
                // session provider binds to the user's own resourceId + worktree.
                { path: 'user/threads/:threadId', element: <ThreadPage /> },
                { path: 'overview', element: <OverviewPage /> },
                { path: 'work', element: <WorkBoardPage /> },
                { path: 'review', element: <ReviewBoardPage /> },
                { path: 'metrics', element: <MetricsPage /> },
                { path: 'audit', element: <AuditPage /> },
                // Compatibility routes from the former combined Board.
                { path: 'board', element: <Navigate to="../work" replace /> },
                { path: 'intake', element: <Navigate to="../work" replace /> },
              ],
            },
          ],
        },
        // Legacy deep links from before factory-scoped URLs.
        { path: 'factory/*', element: <LegacyFactorySubpageRedirect /> },
        { path: 'new', element: <LegacyFactoryRedirect suffix="/new" /> },
        { path: 'threads/:threadId', element: <LegacyThreadRedirect /> },
        { path: 'user/threads/:threadId', element: <LegacyThreadRedirect userScoped /> },
        { path: '*', element: <Navigate to="/" replace /> },
      ],
    },
    { path: '/signin', element: <SignInGate /> },
  ];
}

export function createAppRouter() {
  return createBrowserRouter(createAppRoutes());
}
