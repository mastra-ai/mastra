// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { forwardRef } from 'react';
import { Link as RouterLink, Outlet, RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { server } from '@/test/msw-server';
import { LinkComponentProvider, type LinkComponentProps } from '@/lib/framework';
import { navHandle } from '@/lib/nav';
import { RouteHeader, RouteHeaderActionsProvider, RouteHeaderCrumbsProvider } from '@/lib/route-header';
import Workspace from '../index';
import { configuredWorkspaceInfo, emptySkills, workspacesList } from './fixtures/workspace-editor';

const BASE_URL = 'http://localhost:4111';

const Link = forwardRef<HTMLAnchorElement, LinkComponentProps>(({ href = '', ...props }, ref) => (
  <RouterLink ref={ref} to={href} {...props} />
));
Link.displayName = 'TestLink';

const paths = {
  workspaceLink: (workspaceId?: string) => (workspaceId ? `/workspaces/${workspaceId}` : `/workspaces`),
} as unknown as React.ComponentProps<typeof LinkComponentProvider>['paths'];

const renderEditor = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: (
          <RouteHeaderActionsProvider>
            <RouteHeaderCrumbsProvider>
              <RouteHeader />
              <Outlet />
            </RouteHeaderCrumbsProvider>
          </RouteHeaderActionsProvider>
        ),
        children: [
          {
            path: 'workspaces/:workspaceId',
            element: <Workspace />,
            handle: navHandle('/workspaces'),
          },
        ],
      },
    ],
    { initialEntries: ['/workspaces/global-ws'] },
  );

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={Link} navigate={() => {}} paths={paths}>
          <RouterProvider router={router} />
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

afterEach(() => cleanup());

describe('Workspace editor breadcrumb', () => {
  it('shows "Workspaces > <workspace name>" in the route header', async () => {
    server.use(
      http.get(`${BASE_URL}/api/workspaces`, () => HttpResponse.json(workspacesList)),
      http.get(`${BASE_URL}/api/workspaces/global-ws`, () => HttpResponse.json(configuredWorkspaceInfo)),
      http.get(`${BASE_URL}/api/workspaces/global-ws/skills`, () => HttpResponse.json(emptySkills)),
    );

    renderEditor();

    const breadcrumb = await screen.findByRole('navigation', { name: /breadcrumb/i });

    await waitFor(() => expect(within(breadcrumb).getByText('Global Workspace')).not.toBeNull());

    // The workspaces list crumb links back to /workspaces.
    const workspacesCrumb = within(breadcrumb).getByText('Workspaces');
    expect(workspacesCrumb.closest('a')?.getAttribute('href')).toBe('/workspaces');
  });
});
