import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { describe, expect, it } from 'vitest';

import { server } from '../../../e2e/ui/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '../../../e2e/ui/render';
import type { FactoryMetrics } from '../domains/factory/services/metrics';
import { createAppRoutes } from '../router';

const FACTORY_ID = 'fp-1';

/**
 * A window where 8 cards entered the pipeline: 2 abandoned in triage, 3 are
 * still sitting in review, 3 shipped — and 12 synced cards nobody ever started.
 */
const METRICS: FactoryMetrics = {
  daysCovered: 30,
  wipTotal: 5,
  throughput: [],
  leadTime: { medianMs: null, p90Ms: null, samples: 0 },
  sourceMix: [],
  intake: { arrived: 20, pickedUp: 8, waiting: 12 },
  funnel: {
    gates: [
      { stage: 'triage', reached: 8, canceled: 2, stalled: 0 },
      { stage: 'planning', reached: 6, canceled: 0, stalled: 0 },
      { stage: 'execute', reached: 6, canceled: 0, stalled: 0 },
      { stage: 'review', reached: 6, canceled: 0, stalled: 3 },
      { stage: 'done', reached: 3, canceled: 0, stalled: 0 },
    ],
    sentBack: 1,
  },
  agentCoverage: [],
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

describe('Overview pipeline', () => {
  it('reads the cohort down to where it stopped, and names the queue in front of it', async () => {
    stubOverviewEndpoints(METRICS);
    renderOverview();

    // Each bar is the share of the cohort that got at least this far, so the
    // step down from one to the next is exactly what the upper one held on to.
    expect(await screen.findByLabelText('Triage: 8 of 8, 2 abandoned')).toBeInTheDocument();
    expect(screen.getByLabelText('Review: 6 of 8, 3 still here')).toBeInTheDocument();
    expect(screen.getByLabelText('Done: 3 of 8')).toBeInTheDocument();
    expect(
      screen.getByText('3 of the 8 pulled in this window shipped · 1 came back for another pass.'),
    ).toBeInTheDocument();

    // The synced cards no run ever started on are hidden from every other
    // figure on the page — this readout is the only place they surface.
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('8 of 20 filed this window picked up')).toBeInTheDocument();
  });

  it('given a window nothing entered, then the funnel says so instead of drawing empty bars', async () => {
    stubOverviewEndpoints({
      ...METRICS,
      intake: { arrived: 0, pickedUp: 0, waiting: 0 },
      funnel: {
        gates: METRICS.funnel.gates.map(gate => ({ ...gate, reached: 0, canceled: 0, stalled: 0 })),
        sentBack: 0,
      },
    });
    renderOverview();

    expect(await screen.findByText('Nothing entered the pipeline in this window.')).toBeInTheDocument();
    expect(screen.getByText('Synced cards no run has started')).toBeInTheDocument();
  });
});
