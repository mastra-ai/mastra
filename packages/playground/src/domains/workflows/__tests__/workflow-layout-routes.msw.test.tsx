// @vitest-environment jsdom
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Outlet, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { WORKFLOW_ID, noSchedules, packagesWithObservability, weatherWorkflow } from './fixtures/workflow';
import { WorkflowLayout } from '@/domains/workflows/workflow-layout';
import { paths } from '@/lib/app-routing';
import { Link } from '@/lib/link';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const renderAt = (initialEntry: string) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={Link} navigate={() => {}} paths={paths}>
          <TooltipProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
              <Routes>
                <Route
                  path="/workflows/:workflowId"
                  element={
                    <WorkflowLayout>
                      <Outlet />
                    </WorkflowLayout>
                  }
                >
                  <Route path="graph" element={<div data-testid="workflow-child" />} />
                  <Route path="traces" element={<div data-testid="workflow-child" />} />
                  <Route path="schedules" element={<div data-testid="workflow-child" />} />
                </Route>
              </Routes>
            </MemoryRouter>
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
    http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}/runs`, () => HttpResponse.json({ runs: [], total: 0 })),
    http.get(`${BASE_URL}/api/schedules`, () => HttpResponse.json(noSchedules)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packagesWithObservability)),
  );
};

afterEach(() => {
  cleanup();
});

describe('WorkflowLayout routes', () => {
  describe('when on /workflows/:workflowId/traces', () => {
    it('renders the child without the workflow information panel', async () => {
      installHandlers();
      renderAt(`/workflows/${WORKFLOW_ID}/traces`);

      await screen.findByTestId('workflow-child');

      expect(screen.queryByTestId('workflow-information-panel')).toBeNull();
    });
  });

  describe('when on /workflows/:workflowId/schedules', () => {
    it('renders the child without the workflow information panel', async () => {
      installHandlers();
      renderAt(`/workflows/${WORKFLOW_ID}/schedules`);

      await screen.findByTestId('workflow-child');

      expect(screen.queryByTestId('workflow-information-panel')).toBeNull();
    });
  });

  describe('when on /workflows/:workflowId/graph', () => {
    it('still renders the workflow information panel around the child', async () => {
      installHandlers();
      renderAt(`/workflows/${WORKFLOW_ID}/graph`);

      await screen.findByTestId('workflow-child');

      await waitFor(() => expect(screen.getByTestId('workflow-information-panel')).not.toBeNull());
    });
  });

  describe('when the layout header renders', () => {
    it('exposes only the API endpoints action, Traces and Schedules live in the tabs', async () => {
      installHandlers();
      renderAt(`/workflows/${WORKFLOW_ID}/traces`);

      await screen.findByRole('tab', { name: 'Traces' });

      expect(screen.getByRole('link', { name: /API endpoints/ })).not.toBeNull();
      expect(screen.queryByRole('link', { name: 'Traces' })).toBeNull();
      expect(screen.queryByRole('link', { name: /Schedules/ })).toBeNull();
    });
  });
});
