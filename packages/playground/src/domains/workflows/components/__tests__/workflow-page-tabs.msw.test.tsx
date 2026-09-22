import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WORKFLOW_ID,
  noSchedules,
  packagesWithObservability,
  packagesWithoutObservability,
  twoSchedules,
  weatherWorkflow,
} from '../../__tests__/fixtures/workflow';
import { WorkflowLayout } from '../../workflow-layout';
import { LinkComponentProvider } from '@/lib/framework';
import type { LinkComponentProviderProps } from '@/lib/framework';
import { server } from '@/test/msw-server';

const BASE_URL = 'http://localhost:4111';

const StubLink = ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a {...props}>{children}</a>
);

const navigateSpy = vi.fn();
const noopPaths = {} as unknown as LinkComponentProviderProps['paths'];

function renderLayout(initialEntry = `/workflows/${WORKFLOW_ID}/traces`) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <MastraReactProvider baseUrl={BASE_URL}>
      <QueryClientProvider client={queryClient}>
        <LinkComponentProvider Link={StubLink as never} navigate={navigateSpy} paths={noopPaths}>
          <TooltipProvider>
            <MemoryRouter initialEntries={[initialEntry]}>
              <Routes>
                <Route
                  path="/workflows/:workflowId/*"
                  element={
                    <WorkflowLayout>
                      <div data-testid="workflow-child" />
                    </WorkflowLayout>
                  }
                />
              </Routes>
            </MemoryRouter>
          </TooltipProvider>
        </LinkComponentProvider>
      </QueryClientProvider>
    </MastraReactProvider>,
  );
}

function commonHandlers({ packages = packagesWithObservability, schedules = noSchedules } = {}) {
  return [
    http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json({ [WORKFLOW_ID]: weatherWorkflow })),
    http.get(`${BASE_URL}/api/workflows/${WORKFLOW_ID}`, () => HttpResponse.json(weatherWorkflow)),
    http.get(`${BASE_URL}/api/schedules`, () => HttpResponse.json(schedules)),
    http.get(`${BASE_URL}/api/system/packages`, () => HttpResponse.json(packages)),
    http.get(`${BASE_URL}/api/auth/capabilities`, () => HttpResponse.json({ enabled: false })),
  ];
}

const tabNames = () => screen.getAllByRole('tab').map(tab => tab.textContent);

afterEach(() => {
  cleanup();
  navigateSpy.mockReset();
});

describe('WorkflowPageTabs', () => {
  describe('when the layout renders on the traces route', () => {
    it('renders Graph, Traces and Schedules tabs with Traces selected', async () => {
      server.use(...commonHandlers());
      renderLayout(`/workflows/${WORKFLOW_ID}/traces`);

      const traces = await screen.findByRole('tab', { name: 'Traces' });

      expect(tabNames()).toEqual(['Graph', 'Traces', 'Schedules']);
      expect(traces.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Graph' }).getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('when the layout renders on the schedules route', () => {
    it('selects the Schedules tab', async () => {
      server.use(...commonHandlers());
      renderLayout(`/workflows/${WORKFLOW_ID}/schedules`);

      const schedules = await screen.findByRole('tab', { name: 'Schedules' });

      expect(schedules.getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('when the workflow has schedules', () => {
    it('shows the count in the Schedules tab label', async () => {
      server.use(...commonHandlers({ schedules: twoSchedules }));
      renderLayout();

      expect(await screen.findByRole('tab', { name: 'Schedules (2)' })).not.toBeNull();
    });
  });

  describe('when observability is not installed', () => {
    it('disables the Traces tab', async () => {
      server.use(...commonHandlers({ packages: packagesWithoutObservability }));
      renderLayout(`/workflows/${WORKFLOW_ID}/schedules`);

      const traces = await screen.findByRole('tab', { name: 'Traces' });

      await waitFor(() =>
        expect(traces.hasAttribute('disabled') || traces.getAttribute('aria-disabled') === 'true').toBe(true),
      );
    });
  });

  describe('when a tab is clicked', () => {
    it('navigates to the matching workflow route', async () => {
      server.use(...commonHandlers());
      renderLayout(`/workflows/${WORKFLOW_ID}/traces`);

      fireEvent.click(await screen.findByRole('tab', { name: 'Schedules' }));

      await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(`/workflows/${WORKFLOW_ID}/schedules`));
    });
  });
});
