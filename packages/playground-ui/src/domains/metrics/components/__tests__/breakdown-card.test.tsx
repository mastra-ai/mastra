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
  modelSpansByModel,
  previousAgentRunsByName,
  previousAgentUsage,
  previousWithRetiredAgent,
  threadResourcesFixture,
  tokensByEnvironment,
  toolCallsByName,
  tracesByEnvironment,
  tracesByProject,
  tracesByProjectAndThread,
  tracesByThread,
  truncatedToolCalls,
  usageByModel,
  usageByThread,
} from './fixtures/breakdown';
import { emptyBreakdownFixture } from './fixtures/metrics';
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

const BREAKDOWN_API = `${TEST_BASE_URL}/api/observability/metrics/breakdown`;

/** Whether a window ends now (the page's) rather than a window earlier (the previous one). */
const endsNow = (end: unknown) => Math.abs(Date.now() - new Date(String(end)).getTime()) < 3_600_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const field = (value: unknown, key: string) => (isRecord(value) ? value[key] : undefined);

type TotalsRequest = { groupBy: string[]; current: boolean; aggregation: string; filters: Record<string, unknown> };

/** Usage totals per group (tokens and cost, or counted model calls), recording each request. */
function serveUsageTotals(respond: (request: TotalsRequest) => object) {
  const requests: TotalsRequest[] = [];
  server.use(
    http.post(BREAKDOWN_API, async ({ request }) => {
      const body: unknown = await request.json();
      const groupBy = field(body, 'groupBy');
      const filters = field(body, 'filters');
      const parsed: TotalsRequest = {
        groupBy: Array.isArray(groupBy) ? groupBy.map(String) : [],
        current: endsNow(field(field(filters, 'timestamp'), 'end')),
        aggregation: String(field(body, 'aggregation')),
        filters: isRecord(filters) ? { ...filters } : {},
      };
      requests.push(parsed);
      return HttpResponse.json(respond(parsed));
    }),
  );
  return requests;
}

/** Agents' current tokens and cost; nothing for any other request. */
const agentTotals = ({ groupBy, current, aggregation }: TotalsRequest) =>
  current && aggregation === 'sum' && groupBy.join() === 'entityName' ? agentTokensByName : emptyBreakdownFixture;

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

/** Body rows' names; the first row is the header. */
const rowNames = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map(row => row.querySelector('[title]')?.getAttribute('title'));

/** The text a column header's tooltip gives screen readers. */
const headerDescription = (name: string) => {
  const id = screen.getByRole('button', { name }).getAttribute('aria-describedby');
  return id ? document.getElementById(id)?.textContent : undefined;
};

const rowOf = async (name: string) => {
  const row = (await screen.findByTitle(name)).closest<HTMLElement>('[role="row"]');
  if (!row) throw new Error(`${name} row not found`);
  return row;
};

describe('BreakdownCard', () => {
  beforeEach(() => serveUsageTotals(agentTotals));

  describe('when the page covers one project', () => {
    it('opens on agents, ranks them by the traces they ran in, nested ones included, and has no Projects tab', async () => {
      serveCapabilities(aggregateCapabilities);
      const spans = serveSpans();
      renderInMetrics(<BreakdownCard onRowClick={() => {}} />);

      expect(await screen.findByTitle('Explore Subagent')).toBeDefined();
      expect(rowNames()).toEqual(['Explore Subagent', 'Code Agent', 'Reflector']);
      expect(within(await rowOf('Explore Subagent')).getByText('30')).toBeDefined();
      expect(screen.queryByRole('tab', { name: 'Projects' })).toBeNull();
      expect(spans[0]).toMatchObject({
        groupBy: ['entityName'],
        where: { op: 'eq', left: { path: 'spanType' }, right: { literal: 'agent_run' } },
        measures: expect.arrayContaining(['countDistinct.traceId']),
      });
    });

    it('shows each agent’s errors, P95 latency, tokens and cost, and says when a model has no price', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      const totals = serveUsageTotals(agentTotals);
      renderInMetrics(<BreakdownCard onRowClick={() => {}} />);

      const code = await rowOf('Code Agent');
      expect(within(code).getByText('20.0%')).toBeDefined();
      expect(within(code).getByText('42.0s')).toBeDefined();
      expect(within(code).getByText('$12.50')).toBeDefined();
      expect(screen.getByText('Not priced')).toBeDefined();
      expect(screen.getByRole('button', { name: 'P95 latency' })).toBeDefined();
      expect(totals).toContainEqual(
        expect.objectContaining({ groupBy: ['entityName'], filters: expect.objectContaining({ entityType: 'agent' }) }),
      );
    });

    it('has no Before, Trend, Share or Project column, no bars or colours, and ends with the count then % Change', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      renderInMetrics(<BreakdownCard />);
      await screen.findByTitle('Code Agent');

      const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
      expect(headers).toEqual(['Agent', 'Errors', 'P95 latency', 'Tokens', 'Cost', 'Traces', '% Change']);
      // A plain table: no share strip, and no colour swatch on the rows.
      expect(screen.queryAllByTestId('share-bar-segment')).toHaveLength(0);
      expect((await rowOf('Code Agent')).querySelector('.size-2')).toBeNull();
    });

    it('explains traces on the count column, and what % Change compares, with both ranges', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      renderInMetrics(<BreakdownCard />);
      await screen.findByTitle('Code Agent');

      expect(headerDescription('Traces')).toBe('A trace is one end-to-end request, with every step it took.');
      expect(screen.queryByText(/A span is/)).toBeNull();
      expect(headerDescription('% Change')).toMatch(/^Change in traces/);
      expect(screen.getByText(/^Change in traces from the previous range of the same length/)).toBeDefined();
      expect(screen.getByText(/^Selected: /)).toBeDefined();
      expect(screen.getByText(/^Previous: /)).toBeDefined();
    });
  });

  describe('when a column header is clicked', () => {
    it('sorts the rows by that column, then the other way on a second click', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      renderInMetrics(<BreakdownCard onRowClick={() => {}} />);
      await screen.findByTitle('Code Agent');

      fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
      expect(rowNames()).toEqual(['Code Agent', 'Explore Subagent', 'Reflector']);
      fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
      expect(rowNames()).toEqual(['Reflector', 'Explore Subagent', 'Code Agent']);
    });
  });

  describe('when the Tools tab opens', () => {
    it('counts every tool and MCP tool call as a span, without usage columns or a usage request', async () => {
      serveCapabilities(aggregateCapabilities);
      const spans = serveSpans();
      const totals = serveUsageTotals(agentTotals);
      renderInMetrics(<BreakdownCard onRowClick={() => {}} />);
      await screen.findByTitle('Code Agent');
      const sentBefore = totals.length;

      fireEvent.click(screen.getByRole('tab', { name: 'Tools' }));
      const search = await rowOf('search');
      expect(within(search).getByText('300')).toBeDefined();
      expect(headerDescription('Spans')).toMatch(/^A span is one step inside a trace/);
      expect(screen.queryByText(/A trace is one end-to-end request/)).toBeNull();
      expect(spans.at(-1)?.where).toEqual({
        op: 'in',
        value: { path: 'spanType' },
        set: ['tool_call', 'mcp_tool_call'],
      });
      expect(spans.at(-1)?.measures).not.toContain('countDistinct.traceId');
      expect(screen.queryByRole('button', { name: 'Cost' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Spans' })).toBeDefined();
      expect(totals).toHaveLength(sentBefore);
    });
  });

  describe('when a row is clicked', () => {
    it('opens the traces where that tool ran, nested or not', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
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
      serveUsageTotals(request =>
        request.current && request.groupBy[0] === 'environment' ? tokensByEnvironment : agentTotals(request),
      );
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />);
      await screen.findByTitle('Code Agent');

      fireEvent.click(screen.getByRole('tab', { name: 'Environments' }));
      fireEvent.click(await screen.findByTitle('staging'));
      expect(rowNames()).toEqual(['production', 'staging']);
      expect(within(await rowOf('production')).getByText('$1.00')).toBeDefined();
      expect(screen.getByRole('button', { name: '% Change' })).toBeDefined();
      expect(onRowClick).toHaveBeenCalledWith({ environment: 'staging' });
    });
  });

  describe('when the server returns only the busiest groups', () => {
    it('says sorting covers only those', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpanAggregate(() => truncatedToolCalls);
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
    it('shows each row’s change in traces, and New for a row without a previous figure', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      renderInMetrics(<BreakdownCard />);

      const explore = await rowOf('Explore Subagent');
      expect(await within(explore).findByText('+100.0%')).toBeDefined();
      expect(within(await rowOf('Reflector')).getByText('New')).toBeDefined();
      expect(screen.getByText(/^Change in traces /)).toBeDefined();
    });

    it('compares the sorted column: cost when sorted by cost, error rate in points', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      serveUsageTotals(request =>
        !request.current && request.groupBy[0] === 'entityName' ? previousAgentUsage : agentTotals(request),
      );
      renderInMetrics(<BreakdownCard />);
      await screen.findByTitle('Code Agent');

      fireEvent.click(screen.getByRole('button', { name: 'Cost' }));
      expect(await within(await rowOf('Code Agent')).findByText('+150.0%')).toBeDefined();
      expect(screen.getByText(/^Change in cost /)).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Errors' }));
      expect(within(await rowOf('Code Agent')).getByText('+15.0 pt')).toBeDefined();
    });

    it('ranks by the change shown, rises first, then falls first, new rows last', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      renderInMetrics(<BreakdownCard />);
      await screen.findByText('+100.0%');

      // Explore Subagent +100%, Code Agent 0%, Reflector is new.
      fireEvent.click(screen.getByRole('button', { name: '% Change' }));
      expect(rowNames()).toEqual(['Explore Subagent', 'Code Agent', 'Reflector']);
      fireEvent.click(screen.getByRole('button', { name: '% Change' }));
      expect(rowNames()).toEqual(['Code Agent', 'Explore Subagent', 'Reflector']);
    });
  });

  describe('when a row ran in the previous window but not in this one', () => {
    it('still lists it, at zero and −100%', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans(previousWithRetiredAgent);
      renderInMetrics(<BreakdownCard />);

      const retired = await rowOf('Retired Agent');
      expect(within(retired).getByText('−100.0%')).toBeDefined();
      expect(within(retired).getAllByText('0').length).toBeGreaterThan(0);
      expect(rowNames().at(-1)).toBe('Retired Agent');
    });
  });

  describe('when the Models tab opens', () => {
    it('ranks models by their spans with tokens and cost, names each one’s provider, and opens one from its row', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      const totals = serveUsageTotals(request => {
        if (!request.current || !request.groupBy.includes('model')) return agentTotals(request);
        return request.aggregation === 'count' ? modelSpansByModel : usageByModel;
      });
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />);
      await screen.findByTitle('Code Agent');

      fireEvent.click(screen.getByRole('tab', { name: 'Models' }));
      fireEvent.click(await screen.findByTitle('gpt-5'));
      expect(rowNames()).toEqual(['claude-haiku-4-5', 'gpt-5']);
      const haiku = await rowOf('claude-haiku-4-5');
      expect(within(haiku).getByText('900')).toBeDefined();
      expect(within(haiku).getByText('$4.00')).toBeDefined();
      expect(haiku.textContent).toContain('anthropic›claude-haiku-4-5');
      expect(screen.getByRole('button', { name: 'Spans' })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Errors' })).toBeNull();
      expect(totals).toContainEqual(
        expect.objectContaining({ groupBy: ['provider', 'model'], aggregation: 'count', current: false }),
      );
      expect(onRowClick).toHaveBeenCalledWith({ model: 'gpt-5' });
    });
  });

  describe('when the Threads tab opens', () => {
    it('lists threads with their resource, traces and spend, leaves out usage outside any thread, and opens one', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpans();
      const requests: TraceAggregateRequest[] = [];
      serveTraceAggregate(request => {
        requests.push(request);
        return tracesByThread;
      });
      serveUsageTotals(request =>
        request.current && request.groupBy[0] === 'threadId' ? usageByThread : agentTotals(request),
      );
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />);
      await screen.findByTitle('Code Agent');

      fireEvent.click(screen.getByRole('tab', { name: 'Threads' }));
      const thread = await rowOf('thread-a');
      expect(within(thread).getByText('$0.40')).toBeDefined();
      expect(within(thread).getByText('user-1')).toBeDefined();
      expect(rowNames()).toEqual(['thread-a', 'thread-b']);
      // The resource rides on the threads request: one request, no resource lookup.
      expect(new Set(requests.map(r => r.groupBy.join()))).toEqual(new Set(['resourceId,threadId']));
      fireEvent.click(screen.getByTitle('thread-a'));
      expect(onRowClick).toHaveBeenCalledWith({ threadId: 'thread-a' });
    });
  });

  describe('when the page spans an organization with several projects', () => {
    const scope = { projectLabel: (id: string) => `Project ${id}` };

    it('opens on projects, with their names and no Project column, and opens a project from its row', async () => {
      serveCapabilities(aggregateCapabilities);
      serveOrgAggregate('traces', () => tracesByProject(['p1', 'p2']));
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />, { scope });

      fireEvent.click(await screen.findByTitle('Project p2'));
      expect(rowNames()).toEqual(['Project p1', 'Project p2']);
      expect(screen.getByRole('tab', { name: 'Projects', selected: true })).toBeDefined();
      // Only the name column: the rows are the projects.
      expect(screen.getAllByRole('columnheader', { name: 'Project' })).toHaveLength(1);
      expect(onRowClick).toHaveBeenCalledWith({ projectId: 'p2' });
    });

    it('groups agents by project and name, names the project in its own column, and opens them in it', async () => {
      serveCapabilities(aggregateCapabilities);
      serveOrgAggregate('traces', () => tracesByProject(['p1', 'p2']));
      const groupings: string[][] = [];
      serveOrgAggregate('spans', ({ groupBy }) => {
        groupings.push(groupBy);
        return agentRunsByProjectAndName;
      });
      const totals = serveUsageTotals(() => emptyBreakdownFixture);
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />, { scope });
      await screen.findByTitle('Project p1');

      fireEvent.click(screen.getByRole('tab', { name: 'Agents' }));
      const code = await rowOf('Code Agent');
      // Right after the name: the row's texts start with the name, then its project.
      expect(code.textContent?.startsWith('Code AgentProject p1')).toBe(true);
      expect(screen.getAllByRole('columnheader')[1]?.textContent).toBe('Project');
      expect(within(code).getByTitle('Project p1')).toBeDefined();
      fireEvent.click(screen.getByTitle('Code Agent'));
      expect(new Set(groupings.map(g => g.join()))).toEqual(new Set(['projectId,entityName']));
      expect(totals.map(t => t.groupBy)).toContainEqual(['projectId', 'entityName']);
      expect(onRowClick).toHaveBeenCalledWith({
        projectId: 'p1',
        span: { spanTypes: ['agent_run'], entityName: 'Code Agent' },
      });
    });

    it('lists threads by project, and looks up their resources in one more request', async () => {
      serveCapabilities(aggregateCapabilities);
      const groupings: string[] = [];
      serveOrgAggregate('traces', ({ groupBy }) => {
        groupings.push(groupBy.join());
        if (groupBy.join() === 'projectId') return tracesByProject(['p1', 'p2']);
        return groupBy[0] === 'resourceId' ? threadResourcesFixture : tracesByProjectAndThread;
      });
      const onRowClick = vi.fn();
      renderInMetrics(<BreakdownCard onRowClick={onRowClick} />, { scope });
      await screen.findByTitle('Project p1');

      fireEvent.click(screen.getByRole('tab', { name: 'Threads' }));
      const thread = await rowOf('thread-a');
      expect(within(thread).getByText('Project p1')).toBeDefined();
      expect(await within(thread).findByText('user-1')).toBeDefined();
      expect(
        screen
          .getAllByRole('columnheader')
          .map(h => h.textContent)
          .slice(1, 3),
      ).toEqual(['Project', 'Resource']);
      expect(new Set(groupings)).toEqual(new Set(['projectId', 'projectId,threadId', 'resourceId,threadId']));
      fireEvent.click(screen.getByTitle('thread-a'));
      expect(onRowClick).toHaveBeenCalledWith({ projectId: 'p1', threadId: 'thread-a' });
    });
  });

  describe('when the page spans an organization with one project', () => {
    it('opens on agents, since there is nothing to compare', async () => {
      serveCapabilities(aggregateCapabilities);
      serveOrgAggregate('traces', () => tracesByProject(['p1']));
      serveOrgAggregate('spans', () => agentRunsByProjectAndName);
      renderInMetrics(<BreakdownCard />, { scope: { projectLabel: id => id } });

      expect(await screen.findByTitle('Code Agent')).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Agents', selected: true })).toBeDefined();
    });
  });

  describe('when the data fails to load', () => {
    it('keeps the tabs and says so', async () => {
      serveCapabilities(aggregateCapabilities);
      serveSpanAggregate(() => HttpResponse.json({ error: 'boom' }, { status: 500 }));
      renderInMetrics(<BreakdownCard />);
      expect(await screen.findByText(/Couldn't load this data/)).toBeDefined();
      expect(screen.getByRole('tab', { name: 'Tools' })).toBeDefined();
    });
  });
});
