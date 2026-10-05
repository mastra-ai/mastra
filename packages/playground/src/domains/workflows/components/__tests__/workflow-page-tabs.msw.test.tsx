import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import type { LinkComponentProviderProps } from '@mastra/playground-ui/lib/framework';
import { MastraReactProvider } from '@mastra/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  const view = render(
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
  return { ...view, queryClient };
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
    it('keeps Graph and Traces as tabs when Schedules is unavailable', async () => {
      server.use(...commonHandlers());
      const { queryClient } = renderLayout(`/workflows/${WORKFLOW_ID}/traces`);

      const traces = await screen.findByRole('tab', { name: 'Traces' });
      await waitFor(() =>
        expect(queryClient.getQueryState(['schedules', { workflowId: WORKFLOW_ID }])?.status).toBe('success'),
      );
      expect(tabNames()).toEqual(['Graph', 'Traces']);
      expect(screen.getByRole('button', { name: 'Schedules' }).getAttribute('aria-disabled')).toBe('true');
      expect(traces.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Graph' }).getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('when the layout renders on the schedules route', () => {
    it('selects the Schedules tab', async () => {
      server.use(...commonHandlers({ schedules: twoSchedules }));
      renderLayout(`/workflows/${WORKFLOW_ID}/schedules`);

      const schedules = await screen.findByRole('tab', { name: 'Schedules' });

      expect(schedules.getAttribute('aria-selected')).toBe('true');
    });
  });

  describe('when the workflow has schedules', () => {
    it('shows the count in the Schedules tab label', async () => {
      server.use(...commonHandlers({ schedules: twoSchedules }));
      renderLayout();

      const schedules = await screen.findByRole('tab', { name: 'Schedules (2)' });
      await waitFor(() => expect(schedules.getAttribute('aria-disabled')).not.toBe('true'));
    });
  });

  describe('when the workflow has no schedules', () => {
    it('replaces the Schedules tab with a disabled icon button', async () => {
      server.use(...commonHandlers());
      const { queryClient } = renderLayout();

      await screen.findByRole('tab', { name: 'Schedules' });
      await waitFor(() =>
        expect(queryClient.getQueryState(['schedules', { workflowId: WORKFLOW_ID }])?.status).toBe('success'),
      );
      const disabledSchedules = screen.getByRole('button', { name: 'Schedules' });
      expect(screen.queryByRole('tab', { name: 'Schedules' })).toBeNull();
      expect(disabledSchedules.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(disabledSchedules);
      expect(navigateSpy).not.toHaveBeenCalled();
    });

    it('explains how to enable Schedules when focused', async () => {
      server.use(...commonHandlers());
      const { queryClient } = renderLayout();

      await screen.findByRole('tab', { name: 'Schedules' });
      await waitFor(() =>
        expect(queryClient.getQueryState(['schedules', { workflowId: WORKFLOW_ID }])?.status).toBe('success'),
      );
      const disabledSchedules = screen.getByRole('button', { name: 'Schedules' });
      expect(disabledSchedules.getAttribute('aria-disabled')).toBe('true');
      fireEvent.focus(disabledSchedules);
      const tooltip = await screen.findByRole('tooltip');
      expect(within(tooltip).queryByText('Schedules')).toBeNull();
      expect(tooltip.textContent).toContain('Configure a schedule');
    });

    it('links to the scheduled workflows documentation from the tooltip', async () => {
      server.use(...commonHandlers());
      const { queryClient } = renderLayout();
      await waitFor(() =>
        expect(queryClient.getQueryState(['schedules', { workflowId: WORKFLOW_ID }])?.status).toBe('success'),
      );
      const schedules = screen.getByRole('button', { name: 'Schedules' });
      fireEvent.focus(schedules);

      const docsLink = within(await screen.findByRole('tooltip')).getByRole('link', { name: 'Learn more' });
      expect(docsLink.getAttribute('href')).toBe('https://mastra.ai/docs/workflows/scheduled-workflows');
      expect(docsLink.getAttribute('target')).toBe('_blank');
      expect(docsLink.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });

  describe('when the schedules query is pending', () => {
    it('keeps the Schedules tab enabled until availability is known', async () => {
      server.use(
        http.get(`${BASE_URL}/api/schedules`, async () => {
          await new Promise<void>(() => {});
          return HttpResponse.json(noSchedules);
        }),
        ...commonHandlers(),
      );
      const { queryClient } = renderLayout();

      const schedules = await screen.findByRole('tab', { name: 'Schedules' });
      await waitFor(() =>
        expect(queryClient.getQueryState(['schedules', { workflowId: WORKFLOW_ID }])?.fetchStatus).toBe('fetching'),
      );
      expect(schedules.getAttribute('aria-disabled')).not.toBe('true');
    });
  });

  describe('when the schedules query fails', () => {
    it('keeps the Schedules tab enabled when availability is unknown', async () => {
      server.use(
        http.get(`${BASE_URL}/api/schedules`, () => HttpResponse.json({}, { status: 503 })),
        ...commonHandlers(),
      );
      const { queryClient } = renderLayout();

      await waitFor(() =>
        expect(queryClient.getQueryState(['schedules', { workflowId: WORKFLOW_ID }])?.status).toBe('error'),
      );
      expect(screen.getByRole('tab', { name: 'Schedules' }).getAttribute('aria-disabled')).not.toBe('true');
    });
  });

  describe('when observability is not installed', () => {
    it('shows a disabled Traces icon button instead of a tab', async () => {
      server.use(...commonHandlers({ packages: packagesWithoutObservability }));
      renderLayout(`/workflows/${WORKFLOW_ID}/schedules`);

      const traces = await screen.findByRole('button', { name: 'Traces' });
      expect(traces.getAttribute('aria-disabled')).toBe('true');
      expect(screen.queryByRole('tab', { name: 'Traces' })).toBeNull();
    });

    it('keeps Schedules in the tab list when Traces is unavailable', async () => {
      server.use(...commonHandlers({ packages: packagesWithoutObservability, schedules: twoSchedules }));
      renderLayout();

      await screen.findByRole('tab', { name: 'Schedules (2)' });
      expect(tabNames()).toEqual(['Graph', 'Schedules (2)']);
      expect(screen.getByRole('button', { name: 'Traces' }).getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('when a tab is clicked', () => {
    it('navigates to the matching workflow route', async () => {
      server.use(...commonHandlers({ schedules: twoSchedules }));
      renderLayout(`/workflows/${WORKFLOW_ID}/traces`);

      fireEvent.click(await screen.findByRole('tab', { name: 'Schedules (2)' }));

      await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(`/workflows/${WORKFLOW_ID}/schedules`));
    });
  });

  describe('when the workflow id is itself named "traces"', () => {
    it('selects the tab from the route segment, not from a substring of the workflow id', async () => {
      server.use(
        http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json({ traces: weatherWorkflow })),
        http.get(`${BASE_URL}/api/workflows/traces`, () => HttpResponse.json(weatherWorkflow)),
        ...commonHandlers().slice(2),
      );
      renderLayout('/workflows/traces/schedules');

      const schedules = await screen.findByRole('tab', { name: 'Schedules' });

      expect(schedules.getAttribute('aria-selected')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Traces' }).getAttribute('aria-selected')).toBe('false');
    });
  });

  describe('when the workflow id contains reserved URL characters', () => {
    it('URL-encodes the id in the tab target', async () => {
      const rawId = 'team/ship?v2';
      const encodedId = encodeURIComponent(rawId);
      server.use(
        http.get(`${BASE_URL}/api/workflows`, () => HttpResponse.json({ [rawId]: weatherWorkflow })),
        http.get(`${BASE_URL}/api/workflows/team/ship`, () => HttpResponse.json(weatherWorkflow)),
        ...commonHandlers({ schedules: twoSchedules }).slice(2),
      );
      renderLayout(`/workflows/${encodedId}/traces`);

      fireEvent.click(await screen.findByRole('tab', { name: 'Schedules (2)' }));

      await waitFor(() => expect(navigateSpy).toHaveBeenCalledWith(`/workflows/${encodedId}/schedules`));
    });
  });
});
