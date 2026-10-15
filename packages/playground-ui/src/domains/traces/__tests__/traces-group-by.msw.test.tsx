// @vitest-environment jsdom
import type { AggregateTracesArgs, AggregateTracesResponse } from '@mastra/client-js';
import { MastraClientError } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { TracesGroupByMenu } from '../components/traces-group-by-menu';
import { TracesGroupedView } from '../components/traces-grouped-view';
import { useTraceGroupBy } from '../hooks/use-trace-group-by';
import type { TraceGroupDrillDown } from '../trace-group-by';
import { buildTraceQueryRequest } from '../trace-query-filters';
import { groupedByEntityName, groupedByStatus } from './fixtures/trace-group-by';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const AGGREGATE_URL = `${TEST_BASE_URL}/api/observability/traces/aggregate`;
const NOW = new Date('2026-10-15T12:00:00.000Z');

const onAggregate = vi.fn<(body: AggregateTracesArgs) => void>();

const serveAggregate = (respond: (body: AggregateTracesArgs) => Response | AggregateTracesResponse) => {
  onAggregate.mockClear();
  server.use(
    http.post(AGGREGATE_URL, async ({ request }) => {
      const body: AggregateTracesArgs = await request.json();
      onAggregate(body);
      const result = respond(body);
      return result instanceof Response ? result : HttpResponse.json(result);
    }),
  );
};

let lastError: Error | null = null;
const onProjectDrillDown = vi.fn<(projectId: string) => void>();

function Harness({ enabled = true }: { enabled?: boolean }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const groups = useTraceGroupBy({
    searchParams,
    setSearchParams,
    dimensions: ['entityName', 'status', 'environment', 'entityType'],
    query: () => buildTraceQueryRequest({ tokens: [{ fieldId: 'environment', value: 'production' }], now: NOW }),
    enabled,
  });
  lastError = groups.error;
  const location = useLocation();
  const onDrillDown = (drillDown: TraceGroupDrillDown) =>
    drillDown.kind === 'filter' ? groups.applyFilterDrillDown(drillDown) : onProjectDrillDown(drillDown.projectId);
  return (
    <>
      {enabled && (
        <TracesGroupByMenu
          value={groups.groupBy}
          dimensions={['entityName', 'status', 'environment', 'entityType']}
          onChange={groups.setGroupBy}
        />
      )}
      {groups.groupBy && (
        <TracesGroupedView
          dimension={groups.groupBy}
          rows={groups.rows}
          truncated={groups.truncated}
          isLoading={groups.isLoading}
          filtersApplied
          sort={groups.sort}
          onSortChange={groups.setSort}
          onDrillDown={onDrillDown}
        />
      )}
      <div data-testid="location">{location.search}</div>
    </>
  );
}

const renderHarness = (search = '', props: { enabled?: boolean } = {}) =>
  renderWithProviders(
    <MemoryRouter initialEntries={[`/traces${search}`]}>
      <Harness {...props} />
    </MemoryRouter>,
  );

const locationParams = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');
const rowFor = (label: string) => screen.getByRole('button', { name: `Show traces for ${label}` });

describe('Traces group by', () => {
  it('requests nothing while grouping is off', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness('?groupBy=entityName', { enabled: false });

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onAggregate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Group by/ })).toBeNull();
  });

  it('groups the list selection by the chosen dimension', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness();

    expect(screen.getByRole('button', { name: 'Group by: None' })).not.toBeNull();
    expect(onAggregate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Group by: None' }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Agent / workflow' }));

    await screen.findByRole('button', { name: 'Show traces for support-agent' });
    expect(locationParams().get('groupBy')).toBe('entityName');
    expect(onAggregate).toHaveBeenCalledWith({
      ...buildTraceQueryRequest({ tokens: [{ fieldId: 'environment', value: 'production' }], now: NOW }),
      groupBy: ['entityName'],
      measures: [
        'count',
        'errorRate',
        'duration.p50',
        'duration.p95',
        'tokens.input.sum',
        'tokens.output.sum',
        'cost.sum',
      ],
      orderBy: { field: 'count', direction: 'desc' },
      limit: 50,
    });
    expect(screen.getByRole('button', { name: 'Group by: Agent / workflow' })).not.toBeNull();
  });

  it('shows measures and explains missing or partial tokens and cost', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness('?groupBy=entityName');

    const supportAgent = within(await screen.findByRole('button', { name: 'Show traces for support-agent' }));
    expect(supportAgent.getByText('12')).not.toBeNull();
    expect(supportAgent.getByText('25%')).not.toBeNull();
    expect(supportAgent.getByText('850ms')).not.toBeNull();
    expect(supportAgent.getByText('2.4s')).not.toBeNull();
    expect(supportAgent.getByText('15.2K')).not.toBeNull();
    expect(supportAgent.getByText('~$1.23')).not.toBeNull();

    const triage = within(rowFor('triage-workflow'));
    expect(triage.getAllByText('—')).toHaveLength(3);

    const billing = within(rowFor('billing-agent'));
    expect(billing.getByText('—')).not.toBeNull();

    fireEvent.mouseEnter(supportAgent.getByText('~$1.23'));
    fireEvent.focus(supportAgent.getByText('~$1.23'));
    expect(await screen.findByText('Priced for 62% of traces with usage')).not.toBeNull();
  });

  it('sorts groups by a measure on the server', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness('?groupBy=entityName');
    await screen.findByRole('button', { name: 'Show traces for support-agent' });

    fireEvent.click(screen.getByRole('button', { name: /^Cost, not sorted/ }));

    await waitFor(() => expect(locationParams().get('groupSort')).toBe('cost.sum:asc'));
    await waitFor(() =>
      expect(onAggregate).toHaveBeenLastCalledWith(
        expect.objectContaining({ orderBy: { field: 'cost.sum', direction: 'asc' } }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: /^Cost, sorted ascending/ }));
    await waitFor(() => expect(locationParams().get('groupSort')).toBe('cost.sum:desc'));
  });

  it('drills down into a group: sets its filter and returns to the trace list', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness('?groupBy=entityName&filterEntityName=other&filterEntityName.op=isNot&traceId=t-1');
    fireEvent.click(await screen.findByRole('button', { name: 'Show traces for support-agent' }));

    await waitFor(() => expect(locationParams().has('groupBy')).toBe(false));
    expect(locationParams().getAll('filterEntityName')).toEqual(['support-agent']);
    expect(locationParams().has('filterEntityName.op')).toBe(false);
  });

  it('does not offer a drill-down for a group the filters cannot select', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness('?groupBy=entityName');
    await screen.findByRole('button', { name: 'Show traces for support-agent' });

    expect(screen.getByText('(not set)')).not.toBeNull();
    expect(screen.queryByRole('button', { name: 'Show traces for (not set)' })).toBeNull();
  });

  it('says when more groups exist than it shows', async () => {
    serveAggregate(() => groupedByStatus);
    renderHarness('?groupBy=status&groupSort=duration.p95:desc');

    expect(await screen.findByText(/Showing the top 50 groups by p95 duration/)).not.toBeNull();
    expect(onAggregate).toHaveBeenCalledWith(
      expect.objectContaining({ groupBy: ['status'], orderBy: { field: 'duration.p95', direction: 'desc' } }),
    );
    fireEvent.click(rowFor('Success'));
    await waitFor(() => expect(locationParams().get('status')).toBe('success'));
  });

  it('shows an empty state when no traces match', async () => {
    serveAggregate(() => ({ rows: [], truncated: false }));
    renderHarness('?groupBy=environment');

    expect(await screen.findByText('No traces match these filters')).not.toBeNull();
  });

  it('fails once on a rejected request and hands the error to the page', async () => {
    serveAggregate(() => HttpResponse.json({ type: 'query_too_expensive', message: 'too large' }, { status: 422 }));
    renderHarness('?groupBy=entityName');

    await waitFor(() => expect(lastError).toBeInstanceOf(MastraClientError));
    expect(lastError instanceof MastraClientError && lastError.status).toBe(422);
    expect(onAggregate).toHaveBeenCalledTimes(1);
  });

  it('ignores a groupBy the page does not offer', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness('?groupBy=projectId');

    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onAggregate).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Group by: None' })).not.toBeNull();
  });
});
