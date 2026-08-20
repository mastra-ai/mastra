import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { FactoryMetrics } from '../domains/factory/services/metrics';
import { EMPTY_METRICS } from './factoryMetrics';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';
const HOUR = 3_600_000;

/** A window that shipped more than the one before it, and shipped it faster. */
const METRICS: FactoryMetrics = {
  ...EMPTY_METRICS,
  daysCovered: 2,
  throughput: [
    { date: '2026-07-01', count: 5 },
    { date: '2026-07-02', count: 7 },
  ],
  leadTime: { medianMs: 6 * HOUR, p90Ms: 9 * HOUR, samples: 12 },
  intake: { arrived: 12, pickedUp: 12, waiting: 0 },
  previous: { completed: 8, leadTimeMedianMs: 8 * HOUR, agentCoveragePercent: null, reworkPercent: null },
  series: {
    leadTimeHours: [null, 6],
    agentCoveragePercent: [null, null],
    reworkPercent: [null, null],
  },
};

function stubOverviewEndpoints(metrics: FactoryMetrics) {
  server.use(
    http.get(`${TEST_BASE_URL}/auth/me`, () =>
      HttpResponse.json({ authenticated: true, authEnabled: true, user: { userId: 'user-1' } }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects`, () =>
      HttpResponse.json({ projects: [{ id: FACTORY_ID, name: 'Acme Factory' }] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/metrics`, () => HttpResponse.json({ metrics })),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/work-items`, () =>
      HttpResponse.json({ workItems: [] }),
    ),
    http.get(`${TEST_BASE_URL}/web/factory/projects/${FACTORY_ID}/health/thresholds`, () =>
      HttpResponse.json({ thresholdsSeconds: [14400, 86400, 259200] }),
    ),
  );
}

function renderOverview() {
  const router = createMemoryRouter(createAppRoutes(), { initialEntries: [`/factories/${FACTORY_ID}/overview`] });
  return renderWithProviders(<RouterProvider router={router} />);
}

describe('Overview trend', () => {
  it('reads each figure against the period before it, with falling lead time as the good direction', async () => {
    stubOverviewEndpoints(METRICS);
    renderOverview();

    expect(await screen.findByLabelText('50% up on the previous period')).toBeInTheDocument();
    // Shipping faster is an improvement even though the number went down.
    expect(screen.getByLabelText('25% down on the previous period')).toHaveClass('text-positive1');
  });

  it('given a board too young to have a period before it, then no figure claims a trend', async () => {
    stubOverviewEndpoints({ ...METRICS, previous: null });
    renderOverview();

    expect(await screen.findByText('12')).toBeInTheDocument();
    expect(screen.queryByLabelText(/on the previous period/)).not.toBeInTheDocument();
  });
});
