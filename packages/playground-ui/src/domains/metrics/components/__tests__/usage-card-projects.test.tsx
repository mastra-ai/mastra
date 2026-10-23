// @vitest-environment jsdom
import type { MastraClient } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { BreakdownCard } from '../breakdown-card';
import { UsageCard } from '../usage-card';
import { tracesByProject } from './fixtures/breakdown';
import { aggregateCapabilities } from './fixtures/trace-aggregate';
import { renderInMetrics, serveCapabilities, serveOrgAggregate, seedMetrics } from './metrics-msw';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

type TimeSeriesResponse = Awaited<ReturnType<MastraClient['getMetricTimeSeries']>>;

const recent = () => new Date(Date.now() - 2 * 3_600_000).toISOString();

const tokensByProject: TimeSeriesResponse = {
  series: [
    { name: 'p1', costUnit: 'USD', points: [{ timestamp: recent(), value: 1000, estimatedCost: 3 }] },
    { name: 'p2', costUnit: 'USD', points: [{ timestamp: recent(), value: 500, estimatedCost: 9 }] },
  ],
};

const scope = { projectLabel: (id: string) => `Project ${id}` };

/** Answers tokens by project; counts those requests. */
function serveTokensByProject() {
  const sent = vi.fn();
  server.use(
    http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, async ({ request }) => {
      const body: unknown = await request.json();
      const byProject = JSON.stringify(body).includes('"groupBy":["projectId"]');
      if (byProject) sent();
      return HttpResponse.json(byProject ? tokensByProject : { series: [] });
    }),
  );
  return sent;
}

describe('UsageCard on an organization page', () => {
  describe('when the Projects tab opens', () => {
    it('ranks projects by cost, by name, and opens one from its row', async () => {
      seedMetrics();
      serveTokensByProject();
      const onProjectClick = vi.fn();
      renderInMetrics(<UsageCard onProjectClick={onProjectClick} />, { scope });

      fireEvent.click(screen.getByRole('tab', { name: 'Projects' }));
      fireEvent.click(await screen.findByTitle('Project p1'));
      const names = screen.getAllByRole('listitem').map(i => i.querySelector('[title]')?.getAttribute('title'));
      expect(names).toEqual(['Project p2', 'Project p1']);
      expect(screen.getByText('$12.00')).toBeDefined();
      expect(onProjectClick).toHaveBeenCalledWith('p1');
    });
  });

  describe('when the Breakdown card shows projects too', () => {
    it('shares one tokens-by-project request with it', async () => {
      seedMetrics();
      serveCapabilities(aggregateCapabilities);
      serveOrgAggregate('traces', () => tracesByProject(['p1', 'p2']));
      const sent = serveTokensByProject();
      renderInMetrics(
        <>
          <UsageCard />
          <BreakdownCard />
        </>,
        { scope },
      );
      fireEvent.click(screen.getByRole('tab', { name: 'Projects' }));
      await waitFor(() => expect(screen.getAllByTitle('Project p1')).toHaveLength(2));
      expect(sent).toHaveBeenCalledTimes(1);
    });
  });
});

describe('UsageCard on a project page', () => {
  describe('when it renders', () => {
    it('has no Projects tab', () => {
      seedMetrics();
      renderInMetrics(<UsageCard />);
      expect(screen.queryByRole('tab', { name: 'Projects' })).toBeNull();
    });
  });
});
