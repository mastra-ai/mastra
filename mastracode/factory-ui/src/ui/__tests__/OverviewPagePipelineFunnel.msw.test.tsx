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

/**
 * A window where 8 cards entered the pipeline: 2 abandoned in triage, 3 are
 * still sitting in review, 3 shipped.
 */
const METRICS: FactoryMetrics = {
  ...EMPTY_METRICS,
  daysCovered: 30,
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
    edges: [
      { from: 'triage', to: 'planning', count: 6, byAgent: 6, dwellMedianMs: 2 * HOUR, dwellP90Ms: 4 * HOUR },
      { from: 'planning', to: 'execute', count: 6, byAgent: 3, dwellMedianMs: HOUR, dwellP90Ms: 2 * HOUR },
      { from: 'review', to: 'execute', count: 1, byAgent: 0, dwellMedianMs: 5 * HOUR, dwellP90Ms: 5 * HOUR },
    ],
    rework: { cards: 1, medianExtraMs: 3 * HOUR, percent: 13 },
  },
  stageDwell: [
    { stage: 'triage', medianMs: 2 * HOUR, p90Ms: 4 * HOUR },
    { stage: 'planning', medianMs: HOUR, p90Ms: 2 * HOUR },
    { stage: 'execute', medianMs: 3 * HOUR, p90Ms: 6 * HOUR },
    { stage: 'review', medianMs: 8 * HOUR + 20 * 60_000, p90Ms: 20 * HOUR },
  ],
  agentCoverage: [
    { stage: 'triage', passes: 8, byAgent: 8, outcomes: { done: 3, canceled: 2, reworked: 1, inFlight: 2 } },
    { stage: 'execute', passes: 6, byAgent: 0, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 6 } },
  ],
  agentCoveragePercent: 62,
  series: { leadTimeHours: [], agentCoveragePercent: [], reworkPercent: [] },
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
  it('reads the cohort down to where it stopped', async () => {
    stubOverviewEndpoints(METRICS);
    renderOverview();

    // Each bar is the share of the cohort that got at least this far, so the
    // step down from one to the next is exactly what the upper one held on to.
    expect(await screen.findByLabelText('Triage: 8 of 8, 2 abandoned')).toBeInTheDocument();
    expect(screen.getByLabelText('Review: 6 of 8, 3 still here')).toBeInTheDocument();
    expect(screen.getByLabelText('Done: 3 of 8')).toBeInTheDocument();
    // Where time pools is drawn under each flow, so the eye finds the slow stage
    // without a sentence naming it — and a redo shows what a lap costs.
    expect(screen.getByText('8h 20m')).toBeInTheDocument();
    expect(screen.getByText('1 sent back · +3h each')).toBeInTheDocument();

    // A flow's solid part is the share of that stage's passes an agent closed,
    // read off the coverage rows. Hop counts cannot answer it: a card that
    // skips a stage records no hop, so a stage nobody hopped through would
    // read as "a person did all of it" when nothing was measured at all.
    expect(
      screen.getByLabelText(
        'Triage to Planning: 6 of 8 moved on · 100% of Triage passes closed by an agent · Median 2h in Triage · p90 4h · 2 abandoned',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        'Building to Review: 6 of 6 moved on · 0% of Building passes closed by an agent · Median 3h in Building · p90 6h',
      ),
    ).toBeInTheDocument();
    // Planning closed no pass in the window: that is not the same as a person closing them all.
    expect(
      screen.getByLabelText(
        'Planning to Building: 6 of 6 moved on · No Planning pass closed in this window · Median 1h in Planning · p90 2h',
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('1 sent back from Review to Building · median 5h before the hop')).toBeInTheDocument();
  });

  // Five zeros and three em dashes is the same sentence written eight times.
  it('given a window nothing entered, then the page says it once instead of a wall of zeros', async () => {
    stubOverviewEndpoints({
      ...METRICS,
      intake: { arrived: 0, pickedUp: 0, waiting: 0 },
      funnel: {
        gates: METRICS.funnel.gates.map(gate => ({ ...gate, reached: 0, canceled: 0, stalled: 0 })),
        edges: [],
        rework: { cards: 0, medianExtraMs: null, percent: null },
      },
      stageDwell: [],
    });
    renderOverview();

    expect(await screen.findByText('No card was pulled in or shipped in this window.')).toBeInTheDocument();
    expect(screen.queryByText('Where work stops')).not.toBeInTheDocument();
    expect(screen.queryByText('Lead time')).not.toBeInTheDocument();
  });
});
