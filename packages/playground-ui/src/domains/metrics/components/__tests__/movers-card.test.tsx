// @vitest-environment jsdom
import { fireEvent, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { BreakdownCard } from '../breakdown-card';
import { MoversCard } from '../movers-card';
import { emptyBreakdownFixture, emptySeriesFixture } from './fixtures/metrics';
import {
  currentAgentCost,
  currentEntityRuns,
  currentProjectTraces,
  previousAgentCost,
  previousEntityRuns,
  previousProjectTraces,
  tinyErrorRateChange,
} from './fixtures/movers';
import { aggregateCapabilities, traceAggregateCapabilities } from './fixtures/trace-aggregate';
import { renderInMetrics, serveCapabilities, serveSpanAggregate } from './metrics-msw';
import type { SpanAggregateRequest } from './metrics-msw';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const METRICS_API = `${TEST_BASE_URL}/api/observability/metrics`;
const DAY = 24 * 3_600_000;

/** The page's window ends now; the previous one ends a window earlier. */
const isCurrent = (end: string | Date) => Date.now() - new Date(end).getTime() < 3_600_000;

type MetricRequest = { route: string; groupBy: unknown; filters: Record<string, unknown> };

function serveMetrics({ series = emptySeriesFixture, breakdown = emptyBreakdownFixture } = {}) {
  const requests: MetricRequest[] = [];
  const record = (route: string) =>
    http.post(`${METRICS_API}/${route}`, async ({ request }) => {
      const body: unknown = await request.json();
      const read = (key: string) =>
        typeof body === 'object' && body !== null && key in body ? body[key as keyof typeof body] : undefined;
      const filters = read('filters');
      requests.push({
        route,
        groupBy: read('groupBy'),
        filters: typeof filters === 'object' && filters !== null ? { ...filters } : {},
      });
      return HttpResponse.json(route === 'timeseries' ? series : breakdown);
    });
  server.use(record('timeseries'), record('breakdown'));
  return requests;
}

function serveEntityRuns() {
  const requests: SpanAggregateRequest[] = [];
  serveSpanAggregate(request => {
    requests.push(request);
    return isCurrent(request.timeRange.to) ? currentEntityRuns : previousEntityRuns;
  });
  return requests;
}

/** Projects' traces per window, as Platform's org page answers; records which window each request asked for. */
function serveProjectTraces() {
  const windows: boolean[] = [];
  server.use(
    http.post(`${TEST_BASE_URL}/api/observability/traces/aggregate`, async ({ request }) => {
      const body: unknown = await request.json();
      const timeRange = typeof body === 'object' && body !== null && 'timeRange' in body ? body.timeRange : undefined;
      const to = typeof timeRange === 'object' && timeRange !== null && 'to' in timeRange ? String(timeRange.to) : '';
      const current = isCurrent(to);
      windows.push(current);
      return HttpResponse.json(current ? currentProjectTraces : previousProjectTraces);
    }),
  );
  return windows;
}

const moverRows = () =>
  within(screen.getByRole('table', { name: 'Biggest movers' }))
    .getAllByRole('row')
    .slice(1)
    .map(row =>
      within(row)
        .getAllByRole('cell')
        .map(cell => cell.textContent),
    );

describe('MoversCard', () => {
  describe('when agents and workflows ran in both windows', () => {
    it('ranks them by how much their runs changed, new ones last', async () => {
      serveCapabilities(aggregateCapabilities);
      serveEntityRuns();
      serveMetrics();
      renderInMetrics(<MoversCard />);

      await screen.findByRole('table', { name: 'Biggest movers' });
      expect(moverRows()).toEqual([
        ['Code AgentAgent', '400', '100', '+300.0%'],
        ['ObserverAgent', '1.00K', '900', '+11.1%'],
        ['ingestWorkflow', '30', '60', '−50.0%'],
        ['FreshAgent', '5', '—', 'New'],
      ]);
      expect(
        screen.getByText('Agents and workflows that changed most compared with the previous 24 hours.'),
      ).toBeDefined();
    });

    it('asks once per window for agents and workflows together, the previous window being the 24 hours before', async () => {
      serveCapabilities(aggregateCapabilities);
      const spans = serveEntityRuns();
      serveMetrics();
      renderInMetrics(<MoversCard />);

      await screen.findByRole('table', { name: 'Biggest movers' });
      expect(spans).toHaveLength(2);
      const [current, previous] = [...spans].sort(
        (a, b) => Number(isCurrent(b.timeRange.to)) - Number(isCurrent(a.timeRange.to)),
      );
      expect(current).toMatchObject({
        groupBy: ['spanType', 'entityName'],
        where: { op: 'in', value: { path: 'spanType' }, set: ['agent_run', 'workflow_run'] },
      });
      expect(previous).toBeDefined();
      expect(new Date(previous?.timeRange.to).getTime()).toBe(new Date(current?.timeRange.from).getTime());
      expect(new Date(previous?.timeRange.from).getTime()).toBe(new Date(current?.timeRange.from).getTime() - DAY);
    });

    it('opens the traces an entity ran in from its row', async () => {
      serveCapabilities(aggregateCapabilities);
      serveEntityRuns();
      serveMetrics();
      const onRowClick = vi.fn();
      renderInMetrics(<MoversCard onRowClick={onRowClick} />);

      fireEvent.click(await screen.findByRole('button', { name: /ingest/ }));
      expect(onRowClick).toHaveBeenCalledWith({ span: { spanTypes: ['workflow_run'], entityName: 'ingest' } });
    });
  });

  describe('when the Errors tab is open', () => {
    it('reports error rate changes in points', async () => {
      serveCapabilities(aggregateCapabilities);
      serveEntityRuns();
      serveMetrics();
      renderInMetrics(<MoversCard />);

      fireEvent.click(await screen.findByRole('tab', { name: 'Errors' }));
      expect(moverRows()[0]).toEqual(['Code AgentAgent', '7.00%', '2.00%', '+5.0 pt']);
    });

    it('says a change under 0.05 points is under 0.1, not +0.0', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpanAggregate(request =>
        isCurrent(request.timeRange.to) ? tinyErrorRateChange.current : tinyErrorRateChange.previous,
      );
      serveMetrics();
      renderInMetrics(<MoversCard />);

      fireEvent.click(await screen.findByRole('tab', { name: 'Errors' }));
      expect(moverRows()[0]?.[3]).toBe('+<0.1 pt');
    });
  });

  describe('when the Cost tab is open', () => {
    it('compares agent spend, this window from the token series and the previous from a breakdown', async () => {
      serveCapabilities(aggregateCapabilities);
      serveEntityRuns();
      const metrics = serveMetrics({ series: currentAgentCost, breakdown: previousAgentCost });
      renderInMetrics(<MoversCard />);

      fireEvent.click(await screen.findByRole('tab', { name: 'Cost' }));
      await screen.findByText('+400.0%');
      expect(moverRows()).toEqual([['Code AgentAgent', '$12.50', '$2.50', '+400.0%']]);
      const previous = metrics.find(r => r.route === 'breakdown');
      expect(previous).toMatchObject({ groupBy: ['entityName'], filters: { entityType: 'agent' } });
    });
  });

  describe('when nothing changed', () => {
    it('says so, naming the window', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpanAggregate(() => previousEntityRuns);
      serveMetrics();
      renderInMetrics(<MoversCard />);

      expect(await screen.findByText('Nothing changed compared with the previous 24 hours.')).toBeDefined();
    });
  });

  describe('when the server can not aggregate spans', () => {
    it('renders nothing', async () => {
      serveCapabilities(traceAggregateCapabilities);
      const { container } = renderInMetrics(<MoversCard />);
      await new Promise(resolve => setTimeout(resolve, 50));
      expect(container.textContent).toBe('');
    });
  });

  describe('when the page spans an organization', () => {
    const scope = { projectLabel: (id: string) => `Project ${id}` };

    it('ranks projects by how much their traces changed and opens one from its row', async () => {
      serveCapabilities(aggregateCapabilities);
      serveProjectTraces();
      serveMetrics();
      const onRowClick = vi.fn();
      renderInMetrics(<MoversCard onRowClick={onRowClick} />, { scope });

      await screen.findByRole('table', { name: 'Biggest movers' });
      expect(moverRows()).toEqual([
        ['Project p2', '500', '200', '+150.0%'],
        ['Project p1', '110', '100', '+10.0%'],
      ]);
      expect(screen.getByText('Projects that changed most compared with the previous 24 hours.')).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Project p2' }));
      expect(onRowClick).toHaveBeenCalledWith({ projectId: 'p2' });
    });

    it('shares this window’s projects request with the Breakdown card', async () => {
      serveCapabilities(aggregateCapabilities);
      const windows = serveProjectTraces();
      serveMetrics();
      renderInMetrics(
        <>
          <BreakdownCard />
          <MoversCard />
        </>,
        { scope },
      );

      await screen.findByRole('table', { name: 'Biggest movers' });
      expect(windows.filter(Boolean)).toHaveLength(1);
      expect(windows.filter(w => !w)).toHaveLength(1);
    });
  });
});
