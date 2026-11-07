import type { DashboardQuery, DashboardWidget } from '@mastra/core/storage/dashboards';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import type { AppResources } from '@mastra/mcp';
import { z } from 'zod';
import { QUERY_OBSERVABILITY_TOOL } from '../apps/observability-widget/tool';
import type { ObservabilityWidgetDraft } from '../observability-dashboard';
import {
  observabilityDashboardInputSchema,
  observabilityDashboardOutputSchema,
  toObservabilityDashboard,
} from '../observability-dashboard';

export const OBSERVABILITY_WIDGET_URI = 'ui://mastra/observability-widget';

export type ObservabilityCall = { action: string; args: Record<string, unknown> };
/** An action's data, or the error the tool fails with. */
type Answer = { data: unknown } | { error: string };

const readKey = ({ source, request }: { source: DashboardQuery['source']; request?: string }) =>
  request === undefined
    ? source
    : `${source === 'metrics' ? 'metric' : 'score'}${request[0]!.toUpperCase()}${request.slice(1)}`;

type Loose = Record<string, any>;
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** `query`'s read as the model writes it, with `pick` choosing the number; `groupBy` left out when it's `defaultGroupBy`. */
function readOf(query: Loose, pick: Loose = {}, defaultGroupBy?: string[]): Loose {
  const { source, request, id: _id, interval: _interval, measures: _m, percentiles: _p, ...args } = query;
  if (defaultGroupBy && same(args.groupBy, defaultGroupBy)) delete args.groupBy;
  return { [readKey({ source, request })]: { ...args, ...pick } };
}

/** `expr` with each ref replaced by the read it points at. */
function inline(expr: Loose, queries: Map<string, Loose>, defaultGroupBy?: string[]): Loose {
  const recurse = (e: Loose) => inline(e, queries, defaultGroupBy);
  if ('query' in expr) {
    const { query, ...pick } = expr;
    return readOf(queries.get(query)!, pick, defaultGroupBy);
  }
  if ('const' in expr) return expr;
  if ('minus' in expr) return { minus: expr.minus.map(recurse) };
  if ('ratio' in expr) return { ratio: { of: recurse(expr.ratio.of), over: recurse(expr.ratio.over) } };
  const [op] = Object.keys(expr) as [string];
  return { [op]: expr[op].map(recurse) };
}

function viewDraftOf(kind: string, { queries: list, columns, options = {}, ...view }: Loose): Loose {
  const queries = new Map<string, Loose>(list.map((query: Loose) => [query.id, query]));
  if (kind === 'kpis') {
    return {
      ...view,
      ...options,
      items: options.items.map((item: Loose) => ({ ...item, value: inline(item.value, queries) })),
    };
  }
  if (kind === 'timeseries') {
    const { series, totals: _totals, total, emptyWhenZero, ...rest } = options;
    return {
      ...view,
      ...rest,
      series: series.map(({ dataKey: _key, value, rangeTotal, ...line }: Loose) => ({
        ...line,
        value: inline(value, queries),
        ...(rangeTotal ? { rangeTotal: inline(rangeTotal, queries) } : {}),
      })),
      ...(total
        ? {
            total: {
              ...total,
              value: total.value === 'total' ? 'total' : 'peak' in total.value ? 'peak' : inline(total.value, queries),
            },
          }
        : {}),
      ...(emptyWhenZero ? { emptyWhenZero: inline(emptyWhenZero, queries) } : {}),
    };
  }
  if (kind === 'table') {
    const { defaultSort, ...rest } = options;
    return {
      ...view,
      ...rest,
      columns: columns.map(({ id, label, options: { type, ...body } }: Loose) => {
        if (type === 'value') {
          const { value, ...valueOptions } = body;
          body = { ...valueOptions, ...inline(value, queries, rest.groupBy) };
        }
        if (type === 'dimension' && body.query) {
          const { query, joinOn, ...dimension } = body;
          body = {
            ...dimension,
            lookup: { joinOn, ...readOf(queries.get(query)!, {}, [joinOn, dimension.dimension]) },
          };
        }
        return {
          id,
          ...(label === undefined ? {} : { label }),
          ...(defaultSort.column === id ? { sort: defaultSort.direction } : {}),
          [type]: body,
        };
      }),
    };
  }
  const { average, series, ...rest } = options;
  const { scorerId, scoreSource, ...averageArgs } = readOf(queries.get(average)!).scoreAggregate;
  const { scorerId: _s, scoreSource: _ss, ...seriesArgs } = readOf(queries.get(series)!).scoreTimeSeries;
  return {
    ...view,
    ...rest,
    ...(scorerId === undefined ? {} : { scorerId }),
    ...(scoreSource === undefined ? {} : { scoreSource }),
    average: averageArgs,
    series: seriesArgs,
  };
}

/**
 * `widget` as the model writes it: each value holding the read its query makes. Opening it with
 * `toObservabilityDashboard` gives back `widget` up to query ids, series keys and column ids, which
 * the converter assigns.
 */
export function draftOf({ kind, views, ...widget }: DashboardWidget): ObservabilityWidgetDraft {
  const [first, ...tabs] = views.map(view => viewDraftOf(kind, view as Loose));
  return { ...widget, [kind]: tabs.length ? { ...first, tabs } : first } as ObservabilityWidgetDraft;
}

/** One KPI counting agent runs, compared with the window before. */
export const agentRunsKpi: DashboardWidget = {
  id: 'agent-runs',
  span: 12,
  kind: 'kpis',
  views: [
    {
      queries: [
        {
          source: 'metrics',
          request: 'aggregate',
          id: 'q1',
          name: ['mastra_agent_duration_ms'],
          aggregation: 'count',
          compare: 'previousWindow',
        },
      ],
      options: {
        items: [{ label: 'Agent runs', icon: 'bot', format: 'count', value: { query: 'q1' }, detail: 'in this range' }],
      },
    },
  ],
};

/** A bar chart of agent runs over time, split by status. */
export const agentRunsChart: DashboardWidget = {
  id: 'agent-runs-chart',
  span: 6,
  kind: 'timeseries',
  title: 'Agent runs over time',
  views: [
    {
      queries: [
        {
          source: 'metrics',
          request: 'timeSeries',
          id: 'q1',
          name: ['mastra_agent_duration_ms'],
          aggregation: 'count',
          groupBy: ['status'],
        },
      ],
      options: {
        chart: 'stackedBar',
        format: 'count',
        series: [{ label: 'Runs', color: 'green', dataKey: 'series1', value: { query: 'q1' } }],
      },
    },
  ],
};

/**
 * The server a host writes around the observability widget: `showObservabilityDashboard` opens it
 * with a dashboard built by `toObservabilityDashboard`, and the app-only `queryObservability`
 * answers each action the app asks for from `answers` (keyed by action), recording every call in
 * `calls`.
 */
export function observabilityServer({
  appResources = {},
  answers = {},
}: { appResources?: AppResources; answers?: Record<string, Answer> } = {}) {
  const calls: ObservabilityCall[] = [];
  const server = new MCPServer({
    id: 'observability',
    name: 'Observability',
    version: '1.0.0',
    appResources,
    tools: {
      showObservabilityDashboard: createTool({
        id: 'showObservabilityDashboard',
        description: 'Shows an observability dashboard',
        inputSchema: observabilityDashboardInputSchema,
        // Declaring an output schema is what makes MCPServer send the result as `structuredContent`.
        outputSchema: observabilityDashboardOutputSchema,
        mcp: { _meta: { ui: { resourceUri: OBSERVABILITY_WIDGET_URI } } },
        execute: async input => toObservabilityDashboard(input),
      }),
      [QUERY_OBSERVABILITY_TOOL]: createTool({
        id: QUERY_OBSERVABILITY_TOOL,
        description: 'Runs one observability read',
        inputSchema: z.object({ action: z.string(), args: z.record(z.string(), z.unknown()) }),
        outputSchema: z.object({ data: z.unknown() }),
        mcp: { _meta: { ui: { resourceUri: OBSERVABILITY_WIDGET_URI, visibility: ['app'] } } },
        execute: async call => {
          calls.push(call);
          const answer = answers[call.action];
          if (!answer) throw new Error(`No answer for ${call.action}`);
          if ('error' in answer) throw new Error(answer.error);
          return answer;
        },
      }),
    },
  });
  return { server, calls };
}
