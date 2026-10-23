// @vitest-environment jsdom
import type { AggregateTracesResponse } from '@mastra/client-js';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BreakdownCard } from '../breakdown-card';
import {
  agentRunsByName,
  agentRunsByProjectAndName,
  agentTokensByName,
  previousAgentRunsByName,
  previousAgentUsage,
  previousWithRetiredAgent,
  tokensByEnvironment,
  toolCallsByName,
  tracesByEnvironment,
  tracesByProject,
  tracesByThread,
  truncatedToolCalls,
  usageByModel,
  usageByThread,
} from './fixtures/breakdown';
import { emptyBreakdownFixture, emptySeriesFixture } from './fixtures/metrics';
import { aggregateCapabilities, traceAggregateCapabilities } from './fixtures/trace-aggregate';
import {
  renderInMetrics,
  serveCapabilities,
  serveOrgAggregate,
  serveSpanAggregate,
  serveTraceAggregate,
} from './metrics-msw';
import type { SpanAggregateRequest, TraceAggregateRequest } from './metrics-msw';
import { server } from '@/test/msw-server';
import { TEST_BASE_URL } from '@/test/render';

const TIMESERIES_API = `${TEST_BASE_URL}/api/observability/metrics/timeseries`;
const BREAKDOWN_API = `${TEST_BASE_URL}/api/observability/metrics/breakdown`;

/** Whether a window ends now (the page's) rather than a window earlier (the previous one). */
const endsNow = (end: unknown) => Math.abs(Date.now() - new Date(String(end)).getTime()) < 3_600_000;

type TotalsRequest = { groupBy: string[]; current: boolean };

/** Tokens and cost per group as totals (Models, Threads, and every previous window). */
function serveUsageTotals(respond: (request: TotalsRequest) => object) {
  server.use(
    http.post(BREAKDOWN_API, async ({ request }) => {
      const body: unknown = await request.json();
      const read = (key: string) =>
        typeof body === 'object' && body !== null && key in body ? body[key as keyof typeof body] : undefined;
      const groupBy = read('groupBy');
      const filters = read('filters');
      const timestamp =
        typeof filters === 'object' && filters !== null && 'timestamp' in filters ? filters.timestamp : undefined;
      const end = typeof timestamp === 'object' && timestamp !== null && 'end' in timestamp ? timestamp.end : undefined;
      return HttpResponse.json(
        respond({ groupBy: Array.isArray(groupBy) ? groupBy.map(String) : [], current: endsNow(end) }),
      );
    }),
  );
}

type SeriesRequest = { groupBy: string[]; filters: Record<string, unknown> };

/** Token series per group, and every series request the card sends. */
function serveTokenSeries(respond: (request: SeriesRequest) => object = () => emptySeriesFixture) {
  const requests: SeriesRequest[] = [];
  server.use(
    http.post(TIMESERIES_API, async ({ request }) => {
      const body: unknown = await request.json();
      const read = (key: string) =>
        typeof body === 'object' && body !== null && key in body ? body[key as keyof typeof body] : undefined;
      const groupBy = read('groupBy');
      const filters = read('filters');
      const parsed: SeriesRequest = {
        groupBy: Array.isArray(groupBy) ? groupBy.map(String) : [],
        filters: typeof filters === 'object' && filters !== null ? { ...filters } : {},
      };
      requests.push(parsed);
      return HttpResponse.json(respond(parsed));
    }),
  );
  return requests;
}

/** Answers span aggregates by span type, recording each request. */
function serveSpans(previous: AggregateTracesResponse = previousAgentRunsByName) {
  const requests: SpanAggregateRequest[] = [];
  serveSpanAggregate(request => {
    requests.push(request);
    if (JSON.stringify(request.where).includes('tool_call')) return toolCallsByName;
    return endsNow(request.timeRange.to) ? agentRunsByName : previous;
  });
  return requests;
}

const rowNames = () =>
  screen.getAllByRole('listitem').map(item => item.querySelector('[title]')?.getAttribute('title'));

describe('BreakdownCard', () => {
  beforeEach(() => serveUsageTotals(() => emptyBreakdownFixture));

  describe('when the page covers one project', () => {
    it('opens on agents, ranks every agent run, nested ones included, and has no Projects tab', async () => {
      serveCapabilities(aggregateCapabilities);
      const spans = serveSpans();
      serveTokenSeries(() => agentTokensByName);
      renderInMetrics(<BreakdownCard onRowClick={() => {}} />);

      expect(await screen.findByTitle('Explore Subagent')).toBeDefined();
      expect(rowNames()).toEqual(['Explore Subagent', 'Code Agent', 'Reflector']);
      expect(screen.queryByRole('tab', { name: 'Projects' })).toBeNull();
      expect(spans[0]).toMatchObject({
        groupBy: ['entityName'],
        where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'agent_run' } },
      });
    });

    it('shows each agent’s errors, P95, tokens and cost, and says when a model has no price', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      const series = serveTokenSeries(() => agentTokensByName);
      renderInMetrics(<BreakdownCard onRowClick={() => {}} />);

      const code = (await screen.findByTitle('Code Agent')).closest('li');
      if (!code) throw new Error('Code Agent row not found');
      expect(within(code).getByText('20.0%')).toBeDefined();
      expect(within(code).getByText('42.0s')).toBeDefined();
      expect(within(code).getByText('$12.50')).toBeDefined();
      expect(screen.getByText('Not priced')).toBeDefined();
      expect(series).toContainEqual(
        expect.objectContaining({ groupBy: ['entityName'], filters: expect.objectContaining({ entityType: 'agent' }) }),
      );
    });
  });

  describe('when a column header is clicked', () => {
    it('sorts the rows by that column, then the other way on a second click', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      serveTokenSeries(() => agentTokensByName);
      renderInMetrics(<BreakdownCard onRowClick={() => {}} />);
      await screen.findByTitle('Code Agent');

      fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
      expect(rowNames()).toEqual(['Code Agent', 'Explore Subagent', 'Reflector']);
      fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
      expect(rowNames()).toEqual(['Reflector', 'Explore Subagent', 'Code Agent']);
    });
  });

  describe('when the Tools tab opens', () => {
    it('counts tool and MCP tool calls, without usage columns or a token request', async () => {
      serveCapabilities(aggregateCapabilities);
      const spans = serveSpans();
      const series = serveTokenSeries(() => agentTokensByName);
      renderInMetrics(<BreakdownCard onRowClick={() => {}} />);
      await screen.findByTitle('Code Agent');
      const sentBefore = series.length;

      fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));
      expect(await screen.findByTitle('search')).toBeDefined();
      expect(spans.at(-1)?.where).toEqual({
        op: 'in',
        value: { path: 'spanType' },
        set: ['tool_call', 'mcp_tool_call'],
      });
      expect(screen.queryByRole('button', { name: 'Cost' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Calls' })).toBeDefined();
      expect(series).toHaveLength(sentBefore);
    });
  });

  describe('when a row is clicked', () => {
    it('opens the traces where that tool ran, nested or not', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      serveTokenSeries();
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />);
      await screen.findByTitle('Code Agent');
      fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));
      fireEvent.click(await screen.findByTitle('search'));
      expect(onRowClick).toHaveBeenCalledWith({
        span: { spanTypes: ['tool_call', 'mcp_tool_call'], entityName: 'search' },
      });
    });
  });

  describe('when the Environments tab opens', () => {
    it('lists traces per environment, from trace aggregates, and opens one from its row', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      serveTraceAggregate(() => tracesByEnvironment);
      serveTokenSeries(({ groupBy }) => (groupBy[0] === 'environment' ? tokensByEnvironment : agentTokensByName));
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />);
      await screen.findByTitle('Code Agent');

      fireEvent.click(screen.getByRole('tab', { name: 'Environments' }));
      fireEvent.click(await screen.findByTitle('staging'));
      expect(rowNames()).toEqual(['production', 'staging']);
      expect(screen.getByRole('button', { name: 'Traces before' })).toBeDefined();
      expect(onRowClick).toHaveBeenCalledWith({ environment: 'staging' });
    });
  });

  describe('when the server returns only the busiest groups', () => {
    it('says sorting covers only those', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpanAggregate(() => truncatedToolCalls);
      serveTokenSeries();
      renderInMetrics(<BreakdownCard />);
      expect(await screen.findByText(/Showing the 500 busiest; sorting covers only these./)).toBeDefined();
    });
  });

  describe('when the server can not aggregate spans', () => {
    it('renders nothing, as the page keeps its earlier cards', async () => {
      serveCapabilities(traceAggregateCapabilities);
      const { container } = renderInMetrics(<BreakdownCard />);
      await waitFor(() => expect(screen.queryByText('Breakdown')).toBeNull());
      expect(container.textContent).toBe('');
    });
  });

  describe('when the previous window has figures', () => {
    it('shows each row’s runs before and the change, and says what they compare', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      serveTokenSeries(() => agentTokensByName);
      renderInMetrics(<BreakdownCard />);

      const explore = (await screen.findByTitle('Explore Subagent')).closest('li');
      if (!explore) throw new Error('Explore Subagent row not found');
      expect(await within(explore).findByText('+100.0%')).toBeDefined();
      expect(within(explore).getByText('60')).toBeDefined();
      const reflector = screen.getByTitle('Reflector').closest('li');
      expect(reflector && within(reflector).getByText('New')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Runs before' })).toBeDefined();
      expect(screen.getByText('Before and change: the previous 24 hours. Sort a column to compare it.')).toBeDefined();
    });

    it('compares the sorted column: cost when sorted by cost, error rate in points', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      serveTokenSeries(() => agentTokensByName);
      serveUsageTotals(({ groupBy, current }) =>
        !current && groupBy[0] === 'entityName' ? previousAgentUsage : emptyBreakdownFixture,
      );
      renderInMetrics(<BreakdownCard />);
      await screen.findByTitle('Code Agent');

      fireEvent.click(screen.getByRole('button', { name: 'Cost' }));
      const code = () => {
        const li = screen.getByTitle('Code Agent').closest('li');
        if (!li) throw new Error('Code Agent row not found');
        return li;
      };
      expect(await within(code()).findByText('+150.0%')).toBeDefined();
      expect(within(code()).getByText('$5.00')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Cost change' })).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
      expect(within(code()).getByText('+15.0 pt')).toBeDefined();
    });

    it('ranks by the change shown, rises first, then falls first, new rows last', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      serveTokenSeries(() => agentTokensByName);
      renderInMetrics(<BreakdownCard />);
      await screen.findByText('+100.0%');

      // Explore Subagent +100%, Code Agent 0%, Reflector is new.
      fireEvent.click(screen.getByRole('button', { name: 'Runs change' }));
      expect(rowNames()).toEqual(['Explore Subagent', 'Code Agent', 'Reflector']);
      fireEvent.click(screen.getByRole('button', { name: 'Runs change' }));
      expect(rowNames()).toEqual(['Code Agent', 'Explore Subagent', 'Reflector']);
    });
  });

  describe('when a row ran in the previous window but not in this one', () => {
    it('still lists it, at zero and −100%', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans(previousWithRetiredAgent);
      serveTokenSeries(() => agentTokensByName);
      renderInMetrics(<BreakdownCard />);

      const retired = (await screen.findByTitle('Retired Agent')).closest('li');
      if (!retired) throw new Error('Retired Agent row not found');
      expect(within(retired).getByText('−100.0%')).toBeDefined();
      expect(within(retired).getByText('25')).toBeDefined();
      expect(rowNames().at(-1)).toBe('Retired Agent');
    });
  });

  describe('when the Models tab opens', () => {
    it('ranks models by tokens with their cost, without run columns, and opens one from its row', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      serveTokenSeries(() => agentTokensByName);
      serveUsageTotals(({ groupBy, current }) =>
        current && groupBy[0] === 'model' ? usageByModel : emptyBreakdownFixture,
      );
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />);
      await screen.findByTitle('Code Agent');

      fireEvent.click(screen.getByRole('tab', { name: 'Models' }));
      fireEvent.click(await screen.findByTitle('gpt-5'));
      expect(rowNames()).toEqual(['claude-haiku-4-5', 'gpt-5']);
      expect(screen.queryByRole('button', { name: 'Errors' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Cost' })).toBeDefined();
      expect(onRowClick).toHaveBeenCalledWith({ model: 'gpt-5' });
    });
  });

  describe('when the Threads tab opens', () => {
    it('lists threads with traces and spend, leaves out usage outside any thread, and opens one', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      serveTokenSeries(() => agentTokensByName);
      const requests: TraceAggregateRequest[] = [];
      serveTraceAggregate(request => {
        requests.push(request);
        return tracesByThread;
      });
      serveUsageTotals(({ groupBy, current }) =>
        current && groupBy[0] === 'threadId' ? usageByThread : emptyBreakdownFixture,
      );
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />);
      await screen.findByTitle('Code Agent');

      fireEvent.click(screen.getByRole('tab', { name: 'Threads' }));
      const thread = (await screen.findByTitle('thread-a')).closest('li');
      expect(thread && within(thread).getByText('$0.40')).toBeDefined();
      expect(rowNames()).toEqual(['thread-a', 'thread-b']);
      expect(requests[0]?.groupBy).toEqual(['threadId']);
      fireEvent.click(screen.getByTitle('thread-a'));
      expect(onRowClick).toHaveBeenCalledWith({ threadId: 'thread-a' });
    });
  });

  describe('when the page spans an organization with several projects', () => {
    const scope = {
      projectLabel: (id: string) => `Project ${id}`,
      projectColor: (id: string) => (id === 'p1' ? 'red' : undefined),
    };

    it('opens on projects, with their names and colours, and opens a project from its row', async () => {
      serveCapabilities(aggregateCapabilities);
      serveOrgAggregate('traces', () => tracesByProject(['p1', 'p2']));
      serveTokenSeries();
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />, { scope });

      fireEvent.click(await screen.findByTitle('Project p2'));
      expect(rowNames()).toEqual(['Project p1', 'Project p2']);
      const swatch = screen.getByTitle('Project p1').closest('li')?.querySelector<HTMLElement>('.size-2');
      expect(swatch?.style.backgroundColor).toBe('red');
      expect(screen.getByRole('tab', { name: 'Projects', selected: true })).toBeDefined();
      expect(onRowClick).toHaveBeenCalledWith({ projectId: 'p2' });
    });

    it('groups agents by project and name, and opens them in their project', async () => {
      serveCapabilities(aggregateCapabilities);
      serveOrgAggregate('traces', () => tracesByProject(['p1', 'p2']));
      const groupings: string[][] = [];
      serveOrgAggregate('spans', ({ groupBy }) => {
        groupings.push(groupBy);
        return agentRunsByProjectAndName;
      });
      const series = serveTokenSeries();
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />, { scope });
      await screen.findByTitle('Project p1');

      fireEvent.click(screen.getByRole('tab', { name: 'Agents' }));
      fireEvent.click(await screen.findByTitle('Code Agent'));
      expect(new Set(groupings.map(g => g.join()))).toEqual(new Set(['projectId,entityName']));
      expect(series.map(s => s.groupBy)).toContainEqual(['projectId', 'entityName']);
      expect(onRowClick).toHaveBeenCalledWith({
        projectId: 'p1',
        span: { spanTypes: ['agent_run'], entityName: 'Code Agent' },
      });
    });
  });

  describe('when the page spans an organization with one project', () => {
    it('opens on agents, since there is nothing to compare', async () => {
      serveCapabilities(aggregateCapabilities);
      serveOrgAggregate('traces', () => tracesByProject(['p1']));
      serveOrgAggregate('spans', () => agentRunsByProjectAndName);
      serveTokenSeries();
      renderInMetrics(<BreakdownCard />, { scope: { projectLabel: id => id } });

      expect(await screen.findByTitle('Code Agent')).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Agents', selected: true })).toBeDefined();
    });
  });

  describe('when the data fails to load', () => {
    it('keeps the tabs and says so', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpanAggregate(() => HttpResponse.json({ error: 'boom' }, { status: 500 }));
      serveTokenSeries();
      renderInMetrics(<BreakdownCard />);
      expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Tools' })).toBeDefined();
    });
  });
});
