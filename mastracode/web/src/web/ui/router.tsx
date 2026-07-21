import { createBrowserRouter } from 'react-router';
import type { RouteObject } from 'react-router';

import { SignInRoute } from './domains/auth';
import { NewPage } from './domains/chat/NewPage';
import { ThreadPage } from './domains/chat/ThreadPage';
import { AuditPage } from './domains/factory/AuditPage';
import { BoardPage } from './domains/factory/BoardPage';
import { IntakeBoardPage } from './domains/factory/IntakeBoardPage';
import { MetricsPage } from './domains/factory/MetricsPage';
import { OverviewPage } from './domains/factory/OverviewPage';
import { ReviewBoardPage } from './domains/factory/ReviewBoardPage';
import { DashboardRoute } from './domains/factory/routes/DashboardRoute';
import { OnboardingPage } from './domains/onboarding/OnboardingPage';
import { LocalRoute } from './domains/workspaces/routes/LocalRoute';
import { DashboardLayout, LocalLayout } from './layouts/ProjectLayouts';
import { ProjectAccessGuard, RootLayout } from './layouts/RootLayout';

function NotFound() {
  return <main className="flex h-dvh items-center justify-center bg-surface1 text-icon6"><h1>Page not found</h1></main>;
}

const chatChildren: RouteObject[] = [
  { path: 'new', element: <NewPage /> },
  { path: 'threads/:threadId', element: <ThreadPage /> },
];

export function createAppRoutes(): RouteObject[] {
  return [
    {
      path: '/',
      element: <RootLayout />,
      children: [
        {
          path: '',
          element: <ProjectAccessGuard />,
          children: [
            { path: 'onboarding', element: <OnboardingPage /> },
            {
              path: 'local/:projectId',
              element: <LocalRoute />,
              children: [{ element: <LocalLayout />, children: chatChildren }],
            },
            {
              path: 'dashboard/:projectId',
              element: <DashboardRoute />,
              children: [
                {
                  element: <DashboardLayout />,
                  children: [
                    ...chatChildren,
                    { path: 'user/threads/:threadId', element: <ThreadPage /> },
                    { path: 'factory/board', element: <BoardPage /> },
                    { path: 'factory/intake', element: <IntakeBoardPage /> },
                    { path: 'factory/review', element: <ReviewBoardPage /> },
                    { path: 'factory/overview', element: <OverviewPage /> },
                    { path: 'factory/metrics', element: <MetricsPage /> },
                    { path: 'factory/audit', element: <AuditPage /> },
                  ],
                },
              ],
            },
            { path: '*', element: <NotFound /> },
          ],
        },
      ],
    },
    { path: '/signin', element: <SignInRoute /> },
  ];
}

export function createAppRouter() {
  return createBrowserRouter(createAppRoutes());
}
