// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { KeyboardShortcutsProvider } from '@mastra/playground-ui/keyboard/keyboard-shortcuts-context';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, Outlet, RouterProvider, useLocation } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { WORKFLOW_ID, noSchedules, packagesWithObservability, weatherWorkflow } from './fixtures/workflow';
import { GlobalShortcuts } from '@/domains/navigation/components/global-shortcuts';
import { WorkflowLayout } from '@/domains/workflows/workflow-layout';
import { paths } from '@/lib/app-routing';
import { Link } from '@/lib/link';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const LocationProbe = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
};

const buildRouter = (initialEntry: string) =>
  createMemoryRouter(
    [
      {
        element: (
          <KeyboardShortcutsProvider>
            <GlobalShortcuts />
            <LocationProbe />
            <Outlet />
          </KeyboardShortcutsProvider>
        ),
        children: [
          { path: '/workflows', element: <div data-testid="workflows-list" /> },
          { path: '/traces', element: <div data-testid="global-traces" /> },
          {
            path: '/workflows/:workflowId',
            element: (
              <WorkflowLayout>
                <Outlet />
              </WorkflowLayout>
            ),
            children: [
              { path: 'schedules', element: <div data-testid="workflow-schedules" /> },
              { path: 'traces', element: <div data-testid="workflow-traces" /> },
            ],
          },
        ],
      },
    ],
    { initialEntries: [initialEntry] },
  );

const renderAt = (initialEntry: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = buildRouter(initialEntry);

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={Link} navigate={to => void router.navigate(to)} paths={paths}>
          <TooltipProvider>
            <RouterProvider router={router} />
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
};

const installHandlers = () => {
  server.use(
    http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json({ [WORKFLOW_ID]: weatherWorkflow })),
    http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(weatherWorkflow)),
    http.get(`${BASE_URL}/api/schedules`, () => HttpResponse.json(noSchedules)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithObservability)),
  );
};

const pressGThenT = () => {
  fireEvent.keyDown(window, { key: 'g' });
  fireEvent.keyDown(window, { key: 't' });
};

const locationIs = (pathname: string) =>
  waitFor(() => expect(screen.getByTestId('location-probe').textContent).toBe(pathname));

afterEach(() => {
  cleanup();
});

describe('workflow keyboard shortcuts', () => {
  describe('when on /workflows (outside any workflow page)', () => {
    it('g then t navigates to the global traces page', async () => {
      installHandlers();
      renderAt('/workflows');
      await screen.findByTestId('workflows-list');

      pressGThenT();

      await locationIs('/traces');
    });
  });

  describe('when on /workflows/:workflowId/schedules', () => {
    it('g then t navigates to that workflow traces page instead of the global one', async () => {
      installHandlers();
      renderAt(`/workflows/${WORKFLOW_ID}/schedules`);
      await screen.findByTestId('workflow-schedules');

      pressGThenT();

      await locationIs(`/workflows/${WORKFLOW_ID}/traces`);
      await screen.findByTestId('workflow-traces');
    });
  });

  describe('when the workflow id contains reserved URL characters', () => {
    it('g then t keeps the id URL-encoded in the traces target', async () => {
      const rawId = 'team/ship?v2';
      const encodedId = encodeURIComponent(rawId);
      server.use(
        http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json({ [rawId]: weatherWorkflow })),
        http.get(`${BASE_URL}/api/workflows/${encodedId}`, () => HttpResponse.json(weatherWorkflow)),
        http.get(`${BASE_URL}/api/schedules`, () => HttpResponse.json(noSchedules)),
        http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
        http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithObservability)),
      );
      renderAt(`/workflows/${encodedId}/schedules`);
      await screen.findByTestId('workflow-schedules');

      pressGThenT();

      await locationIs(`/workflows/${encodedId}/traces`);
      await screen.findByTestId('workflow-traces');
    });
  });

  describe('when leaving the workflow page for /workflows', () => {
    it('g then t goes back to the global traces page', async () => {
      installHandlers();
      renderAt(`/workflows/${WORKFLOW_ID}/schedules`);
      await screen.findByTestId('workflow-schedules');

      fireEvent.keyDown(window, { key: 'g' });
      fireEvent.keyDown(window, { key: 'w' });
      await locationIs('/workflows');
      await screen.findByTestId('workflows-list');

      pressGThenT();

      await locationIs('/traces');
    });
  });
});
