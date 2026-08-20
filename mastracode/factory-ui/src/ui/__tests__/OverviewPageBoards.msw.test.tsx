import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { FactoryMetrics } from '../domains/factory/services/metrics';
import type { WorkItem } from '../domains/factory/services/workItems';
import { EMPTY_METRICS } from './factoryMetrics';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const HOUR = 3_600_000;

const METRICS: FactoryMetrics = {
  ...EMPTY_METRICS,
  leadTime: { medianMs: 49 * HOUR, p90Ms: null, samples: 12 },
  intake: { arrived: 20, pickedUp: 8, waiting: 12 },
};

/** A covered day per point, every completion landing on the last one. */
function dailyCounts(completed: number): FactoryMetrics['throughput'] {
  return Array.from({ length: 30 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 6, index + 1)).toISOString().slice(0, 10),
    count: index === 29 ? completed : 0,
  }));
}

/** A synced pull request nobody has started a run on. */
function unstartedThread(id: string): WorkItem {
  const filed = new Date(Date.now() - HOUR).toISOString();
  return {
    id,
    orgId: 'org-1',
    createdBy: 'user-1',
    githubProjectId: FACTORY_ID,
    source: 'github-pr',
    sourceKey: `mastra-ai/mastra:${id}`,
    parentWorkItemId: null,
    title: `Pull request ${id}`,
    url: null,
    stages: ['intake'],
    stageHistory: [{ stage: 'intake', enteredAt: filed, by: 'github' }],
    sessions: {},
    metadata: {},
    revision: 1,
    createdAt: filed,
    updatedAt: filed,
  };
}

function stubOverviewEndpoints(metrics: FactoryMetrics, workItems: WorkItem[] = []) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/metrics`, () => HttpResponse.json({ metrics })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () => HttpResponse.json({ workItems })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/health/thresholds`, () =>
      HttpResponse.json({ thresholdsSeconds: [14400, 86400, 259200] }),
    ),
  );
}

function renderOverview() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/overview`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

function section(name: string): HTMLElement {
  return screen.getByRole('region', { name });
}

describe('Overview boards', () => {
  // The two boards run on different clocks — minutes to review a pull request,
  // days to build a card — so one median over both answers neither question.
  it('counts review threads on their own clock instead of folding them into delivery', async () => {
    stubOverviewEndpoints({
      ...METRICS,
      review: {
        intake: { arrived: 30, pickedUp: 22, waiting: 8 },
        throughput: dailyCounts(22),
        completed: 22,
        leadTime: { medianMs: 18 * 60_000, p90Ms: 42 * 60_000, samples: 22 },
      },
    });
    renderOverview();

    await screen.findByRole('heading', { name: 'Review threads' });
    const review = section('Review threads');
    expect(within(review).getByText('18m')).toBeInTheDocument();
    expect(within(review).getByText('p90 42m')).toBeInTheDocument();
    expect(within(review).getByText('8')).toBeInTheDocument();
    // The same ribbon the work board reads on, over what the review board files.
    expect(within(review).getByLabelText('Filed: 30 of 30, 8 never started')).toBeInTheDocument();
    expect(within(review).getByLabelText('Reviewed: 22 of 30')).toBeInTheDocument();

    expect(within(review).queryByText('2d 1h')).not.toBeInTheDocument();
    expect(screen.getByText('2d 1h')).toBeInTheDocument();
  });

  // "1 shipped · 0 / day" denies the very card the value above it counts.
  it('drops a per-day rate that rounds down to zero', async () => {
    stubOverviewEndpoints({ ...METRICS, throughput: dailyCounts(1) });
    renderOverview();

    await screen.findByRole('heading', { name: 'Delivered' });
    expect(within(section('Delivered')).queryByText(/\/ day/)).not.toBeInTheDocument();
  });

  // Delivery is read per board; what the board is holding this second is not.
  // A factory whose cards are all pull requests used to read "0 waiting to
  // start" while its review board was full of them.
  it('counts what is waiting across both boards, not just the work board', async () => {
    stubOverviewEndpoints(
      {
        ...EMPTY_METRICS,
        review: {
          intake: { arrived: 3, pickedUp: 0, waiting: 3 },
          throughput: [],
          completed: 0,
          leadTime: { medianMs: null, p90Ms: null, samples: 0 },
        },
      },
      [unstartedThread('pr-1'), unstartedThread('pr-2'), unstartedThread('pr-3')],
    );
    renderOverview();

    await screen.findByRole('heading', { name: 'Right now' });
    const now = section('Right now');
    expect(within(now).getByText('Waiting to start')).toBeInTheDocument();
    expect(within(now).getByText('3')).toBeInTheDocument();
  });
});
