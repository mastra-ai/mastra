// @vitest-environment jsdom
import type { AggregateTracesArgs, AggregateTracesResponse } from '@mastra/client-js';
import { MastraClientError } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { FilterBar } from '../../../ds/components/FilterBar';
import type { FilterBarItem } from '../../../ds/components/FilterBar';
import { TracesGroupedView } from '../components/traces-grouped-view';
import { useTraceGroupBy } from '../hooks/use-trace-group-by';
import { TRACE_FILTER_BAR_OPERATORS } from '../trace-filters';
import type { TraceGroupByDimension } from '../trace-group-by';
import {
  createTraceGroupByFilterBarFields,
  splitTraceGroupingFromFilterBar,
  traceGroupingToFilterBarItems,
} from '../trace-group-by-filter-bar';
import { buildTraceQueryRequest } from '../trace-query-filters';
import { groupedByEntityName, groupedByStatus } from './fixtures/trace-group-by';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const AGGREGATE_URL = `${TEST_BASE_URL}/api/observability/traces/aggregate`;
const NOW = new Date('2026-10-15T12:00:00.000Z');
const DIMENSIONS: TraceGroupByDimension[] = ['entityName', 'status', 'environment', 'entityType'];

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
let lastGroups: ReturnType<typeof useTraceGroupBy> | undefined;
const onProjectDrillDown = vi.fn<(projectId: string) => void>();

type HarnessProps = {
  enabled?: boolean;
  entityIdFallback?: boolean;
  formatValue?: (dimension: TraceGroupByDimension, value: string) => string | undefined;
};

/** The grouped view as a page wires it: Group by chips in a FilterBar above the grouped table. */
function Harness({ enabled = true, entityIdFallback = false, formatValue }: HarnessProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const dimensions = enabled ? DIMENSIONS : [];
  const groups = useTraceGroupBy({
    searchParams,
    setSearchParams,
    dimensions,
    query: () => buildTraceQueryRequest({ tokens: [{ fieldId: 'environment', value: 'production' }], now: NOW }),
    enabled,
    entityIdFallback,
  });
  lastError = groups.error;
  lastGroups = groups;
  const location = useLocation();
  const handleChange = (items: FilterBarItem[]) =>
    groups.setGrouping(splitTraceGroupingFromFilterBar(items, dimensions).grouping);
  return (
    <>
      <FilterBar
        value={traceGroupingToFilterBarItems(groups.grouping)}
        onValueChange={handleChange}
        fields={createTraceGroupByFilterBarFields({ dimensions, grouped: groups.grouped })}
        operators={TRACE_FILTER_BAR_OPERATORS}
        createItemId={fieldId => fieldId}
      >
        <FilterBar.Chips />
        <FilterBar.Input placeholder="Filter traces…" />
      </FilterBar>
      {groups.grouped && (
        <TracesGroupedView
          dimensions={groups.grouping.groupBy}
          rows={groups.rows}
          truncated={groups.truncated}
          isLoading={groups.isLoading}
          filtersApplied
          sort={groups.sort}
          onSortChange={groups.setSort}
          formatValue={formatValue}
          onDrillDown={drillDown =>
            drillDown.projectId
              ? onProjectDrillDown(drillDown.projectId)
              : groups.applyFilterDrillDown(drillDown.filters)
          }
        />
      )}
      <div data-testid="location">{location.search}</div>
    </>
  );
}

const renderHarness = (search = '', props: HarnessProps = {}) =>
  renderWithProviders(
    <MemoryRouter initialEntries={[`/traces${search}`]}>
      <Harness {...props} />
    </MemoryRouter>,
  );

const locationParams = () => new URLSearchParams(screen.getByTestId('location').textContent ?? '');
const rowFor = (label: string) => screen.getByRole('button', { name: `Show traces for ${label}` });
const filterInput = () => screen.getByRole<HTMLInputElement>('combobox', { name: 'Add filter' });

/** Pick a field from the bar's typeahead, the way a user adds any filter. */
async function startFilter(field: string) {
  const input = filterInput();
  input.focus();
  fireEvent.change(input, { target: { value: field } });
  fireEvent.click(await screen.findByRole('option', { name: field }));
}

const ALL_MEASURES = [
  'count',
  'errorRate',
  'duration.p50',
  'duration.p95',
  'tokens.input.sum',
  'tokens.output.sum',
  'cost.sum',
];

describe('Traces group by', () => {
  it('requests nothing and offers no Group by while grouping is off', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness('?groupBy=entityName', { enabled: false });

    filterInput().focus();
    fireEvent.change(filterInput(), { target: { value: 'Group' } });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onAggregate).not.toHaveBeenCalled();
    expect(screen.queryByRole('option', { name: 'Group by' })).toBeNull();
  });

  it('groups the list selection by the dimensions picked in the Group by filter', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness();

    await startFilter('Group by');
    fireEvent.click(await screen.findByRole('option', { name: 'Entity' }));
    fireEvent.click(screen.getByRole('option', { name: 'Environment' }));
    fireEvent.click(screen.getByRole('button', { name: /^Done/ }));

    await screen.findByRole('button', { name: /^Show traces for support-agent/ });
    expect(locationParams().get('groupBy')).toBe('entityName,environment');
    expect(onAggregate).toHaveBeenCalledWith({
      ...buildTraceQueryRequest({ tokens: [{ fieldId: 'environment', value: 'production' }], now: NOW }),
      groupBy: ['entityName', 'environment'],
      measures: ALL_MEASURES,
      orderBy: { field: 'count', direction: 'desc' },
      limit: 50,
    });
    // One label column per dimension, and the chip summarises both.
    expect(screen.getByText('Entity')).not.toBeNull();
    expect(screen.getByText('Environment')).not.toBeNull();
    expect(screen.getByRole('combobox', { name: 'Value: Entity, Environment' })).not.toBeNull();
  });

  describe('while a regrouped request is loading', () => {
    const byEntityAndEnvironment: AggregateTracesResponse = {
      rows: [
        { dimensions: { entityName: 'support-agent', environment: 'production' }, measures: { count: 7 } },
        { dimensions: { entityName: 'support-agent', environment: 'staging' }, measures: { count: 5 } },
      ],
      truncated: false,
    };
    const pending = () => new Promise<never>(() => {});

    it('drops the previous rows when a dimension is removed', async () => {
      let hold = false;
      server.use(
        http.post(AGGREGATE_URL, async () => {
          if (hold) await pending();
          return HttpResponse.json(byEntityAndEnvironment);
        }),
      );
      renderHarness('?groupBy=entityName,environment');
      expect(await screen.findAllByRole('button', { name: /^Show traces for support-agent/ })).toHaveLength(2);

      hold = true;
      act(() => lastGroups?.setGrouping({ groupBy: ['entityName'], having: [] }));

      await waitFor(() => expect(locationParams().get('groupBy')).toBe('entityName'));
      expect(screen.queryAllByRole('button', { name: /^Show traces for support-agent/ })).toHaveLength(0);
    });

    it('keeps the previous rows when only the sort changes', async () => {
      let hold = false;
      server.use(
        http.post(AGGREGATE_URL, async () => {
          if (hold) await pending();
          return HttpResponse.json(byEntityAndEnvironment);
        }),
      );
      renderHarness('?groupBy=entityName,environment');
      expect(await screen.findAllByRole('button', { name: /^Show traces for support-agent/ })).toHaveLength(2);

      hold = true;
      act(() => lastGroups?.setSort({ measure: 'errorRate', direction: 'desc' }));

      await waitFor(() => expect(locationParams().get('groupSort')).toBe('errorRate:desc'));
      expect(screen.getAllByRole('button', { name: /^Show traces for support-agent/ })).toHaveLength(2);
    });
  });

  it('filters the groups by a measure once grouped', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness('?groupBy=entityName');
    await screen.findByRole('button', { name: 'Show traces for support-agent' });

    await startFilter('Group error rate (%)');
    fireEvent.click(await screen.findByRole('option', { name: 'greater than' }));
    fireEvent.change(filterInput(), { target: { value: '25' } });
    fireEvent.keyDown(filterInput(), { key: 'Enter' });

    await waitFor(() => expect(locationParams().get('groupHaving')).toBe('errorRate:gt:0.25'));
    await waitFor(() =>
      expect(onAggregate).toHaveBeenLastCalledWith(
        expect.objectContaining({ having: { op: 'gt', left: { path: 'errorRate' }, right: { literal: 0.25 } } }),
      ),
    );
  });

  it('leaves the grouped view, and its group filters, when the Group by filter is removed', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness('?groupBy=entityName&groupHaving=count:gt:1');
    await screen.findByRole('button', { name: 'Show traces for support-agent' });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Group by filter' }));

    await waitFor(() => expect(locationParams().has('groupBy')).toBe(false));
    expect(locationParams().has('groupHaving')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Show traces for support-agent' })).toBeNull();
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

  it('labels groups with the page-supplied names, keeping drill-down on the raw value', async () => {
    serveAggregate(() => groupedByEntityName);
    renderHarness('?groupBy=entityName', {
      formatValue: (dimension, value) => (value === 'support-agent' ? 'Support' : undefined),
    });
    const support = await screen.findByRole('button', { name: 'Show traces for Support' });
    expect(screen.getByRole('button', { name: 'Show traces for billing-agent' })).not.toBeNull();
    fireEvent.click(support);
    await waitFor(() => expect(locationParams().getAll('filterEntityName')).toEqual(['support-agent']));
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

    expect(await screen.findByText(/Showing the top \d+ groups by p95 duration/)).not.toBeNull();
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
    expect(screen.queryByRole('button', { name: 'Remove Group by filter' })).toBeNull();
  });

  describe('when traces have no entity name', () => {
    const splitByEntityId: AggregateTracesResponse = {
      rows: [{ dimensions: { entityId: 'mastracode-outcome' }, measures: { count: 1, errorRate: 0 } }],
      truncated: false,
    };
    const serveWithSplit = () =>
      serveAggregate(body => (body.groupBy?.includes('entityId') ? splitByEntityId : groupedByEntityName));

    it('splits the unnamed group by entity ID and drills into it by ID', async () => {
      serveWithSplit();
      renderHarness('?groupBy=entityName', { entityIdFallback: true });

      const row = await screen.findByRole('button', { name: 'Show traces for mastracode-outcome' });
      expect(screen.queryByText('(not set)')).toBeNull();
      const groups = screen
        .getAllByRole('button', { name: /^Show traces for / })
        .map(button => button.getAttribute('aria-label'));
      expect(groups).toEqual(
        [...groupedByEntityName.rows.flatMap(entry => entry.dimensions?.entityName ?? []), 'mastracode-outcome'].map(
          name => `Show traces for ${name}`,
        ),
      );
      expect(onAggregate).toHaveBeenCalledTimes(2);
      expect(onAggregate.mock.calls[1]?.[0]).toMatchObject({
        groupBy: ['entityId'],
        where: { op: 'and', args: [onAggregate.mock.calls[0]?.[0].where, { op: 'notExists', path: 'entityName' }] },
      });
      fireEvent.click(row);
      await waitFor(() => expect(locationParams().get('filterEntityId')).toBe('mastracode-outcome'));
      expect(locationParams().get('groupBy')).toBeNull();
    });

    it('keeps one "(not set)" group, without an error, when the server rejects the split', async () => {
      serveAggregate(body =>
        body.groupBy?.includes('entityId')
          ? HttpResponse.json({ code: 'TRACE_QUERY_INVALID' }, { status: 422 })
          : groupedByEntityName,
      );
      renderHarness('?groupBy=entityName', { entityIdFallback: true });

      await waitFor(() => expect(onAggregate).toHaveBeenCalledTimes(2));
      expect(await screen.findByText('(not set)')).not.toBeNull();
      expect(lastError).toBeNull();
    });

    it('keeps one "(not set)" group when the server cannot group by entity ID', async () => {
      serveWithSplit();
      renderHarness('?groupBy=entityName');

      expect(await screen.findByText('(not set)')).not.toBeNull();
      expect(onAggregate).toHaveBeenCalledTimes(1);
    });
  });
});
