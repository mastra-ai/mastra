import type { MastraClient } from '@mastra/client-js';
import { TooltipProvider } from '@mastra/playground-ui/components/Tooltip';
import { LinkComponentProvider } from '@mastra/playground-ui/lib/framework';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import WorkflowsPage from '..';
import {
  currentWorkflowRuns,
  fourWorkflows,
  noWorkflowLatency,
  noWorkflows,
  oneRunWaitingForInput,
  previousWorkflowRunsWithoutFailures,
  workflowRunsOverTime,
} from './fixtures/workflows-overview';
import { paths } from '@/lib/app-routing';
import { Link } from '@/lib/link';
import {
  observabilityOff,
  observabilityOn,
  storageWithMetrics,
} from '@/pages/agents/__tests__/fixtures/agents-overview';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type Breakdown = Awaited<ReturnType<MastraClient['getMetricBreakdown']>>;

const ONE_HOUR_MS = 60 * 60 * 1000;
const workflowNames = ['digest-flow', 'order-flow', 'approval-flow', 'archive-flow'];

function endsInThePast(body: unknown) {
  const end = JSON.stringify(body).match(/"end":"([^"]+)"/)?.[1];
  return end !== undefined && new Date(end).getTime() < Date.now() - ONE_HOUR_MS;
}

function serveRunMetrics({ previousRuns }: { previousRuns: Breakdown }) {
  server.use(
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, async ({ request }) =>
      HttpResponse.json(endsInThePast(await request.json()) ? previousRuns : currentWorkflowRuns),
    ),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, () => HttpResponse.json(workflowRunsOverTime)),
  );
}

function renderWorkflows() {
  const router = createMemoryRouter(
    [
      { path: '/workflows', element: <WorkflowsPage /> },
      { path: '/workflows/:workflowId', element: <output>workflow</output> },
    ],
    { initialEntries: ['/workflows'] },
  );
  renderWithProviders(
    <TooltipProvider>
      <LinkComponentProvider Link={Link} paths={paths} navigate={to => void router.navigate(to)}>
        <RouterProvider router={router} />
      </LinkComponentProvider>
    </TooltipProvider>,
  );
}

function rosterRows() {
  return screen.getAllByRole('link').filter(link => link.closest('[data-slot=data-list]'));
}

function rosterOrder() {
  return rosterRows().map(link => workflowNames.find(name => link.textContent?.includes(name)));
}

function rosterRow(workflowName: string) {
  const row = rosterRows().find(link => link.textContent?.includes(workflowName));
  if (!row) throw new Error(`No roster row for ${workflowName}`);
  return row;
}

beforeEach(() => {
  server.use(
    http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(fourWorkflows)),
    http.get(`${TEST_BASE_URL}/api/workflows/run-counts`, () => HttpResponse.json(oneRunWaitingForInput)),
    http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(observabilityOn)),
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(storageWithMetrics)),
    http.post(`${TEST_BASE_URL}/api/observability/traces/aggregate`, () => HttpResponse.json(noWorkflowLatency)),
  );
  serveRunMetrics({ previousRuns: currentWorkflowRuns });
});

describe('Workflows overview', () => {
  describe('when workflows ran in the period', () => {
    it('lists busy and waiting workflows before idle ones', async () => {
      renderWorkflows();
      await waitFor(() =>
        expect(rosterOrder()).toEqual(['digest-flow', 'order-flow', 'approval-flow', 'archive-flow']),
      );
      expect(rosterRow('order-flow').getAttribute('href')).toBe('/workflows/orderWorkflow');
      expect(rosterRow('order-flow').textContent).toContain('2 steps');
      expect(rosterRow('archive-flow').textContent).toContain('No runs in last 24 hours');
    });

    it('counts runs waiting for input', async () => {
      renderWorkflows();
      const totals = await screen.findByLabelText('Period totals');
      await waitFor(() =>
        expect(within(totals).getByText('Waiting for input').closest('div')?.textContent).toContain('1'),
      );
      expect(screen.getByRole('button', { name: /^Suspended, not sorted/ })).toBeTruthy();
    });

    it('links to schedules', async () => {
      renderWorkflows();
      expect((await screen.findByRole('link', { name: 'Schedules' })).getAttribute('href')).toBe(
        '/workflows/schedules',
      );
    });
  });

  describe('when a workflow starts failing', () => {
    it('flags it with the old and new failure rates', async () => {
      serveRunMetrics({ previousRuns: previousWorkflowRunsWithoutFailures });
      renderWorkflows();
      const attention = await screen.findByRole('region', { name: 'Needs attention' });
      expect(within(attention).getByRole('link', { name: 'order-flow' }).getAttribute('href')).toBe(
        '/workflows/orderWorkflow',
      );
      expect(attention.textContent).toMatch(/failure rate 40.*was 0/);
    });
  });

  describe('when nothing got worse', () => {
    it('shows no attention strip', async () => {
      renderWorkflows();
      await waitFor(() => expect(rosterOrder()).toHaveLength(4));
      expect(screen.queryByRole('region', { name: 'Needs attention' })).toBeNull();
    });
  });

  describe('when observability is off', () => {
    it('still lists every workflow with its step count', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/system/packages`, () => HttpResponse.json(observabilityOff)));
      renderWorkflows();
      expect(await screen.findByText('Run activity is off')).toBeTruthy();
      await waitFor(() => expect(rosterRow('approval-flow').textContent).toContain('1 step'));
      expect(screen.queryByLabelText('Period totals')).toBeNull();
    });
  });

  describe('when the project has no workflows', () => {
    it('explains how to add one', async () => {
      server.use(http.get(`${TEST_BASE_URL}/api/workflows`, () => HttpResponse.json(noWorkflows)));
      renderWorkflows();
      expect(await screen.findByText('No Workflows yet')).toBeTruthy();
    });
  });
});
