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

/** `widget` as the model writes it, which `toObservabilityDashboard` turns back into `widget`. */
export function draftOf({ kind, views, ...widget }: DashboardWidget): ObservabilityWidgetDraft {
  const [first, ...tabs] = views.map(({ queries, columns, ...view }) => ({
    ...view,
    queries: queries.map(({ source, request, id, compare, ...read }: DashboardQuery & { request?: string }) => ({
      ...(id === undefined ? {} : { id }),
      ...(compare === undefined ? {} : { compare }),
      [readKey({ source, request })]: read,
    })),
    ...(columns
      ? {
          columns: columns.map(({ options: { type, ...options } = {}, ...column }) => ({
            ...column,
            options: { [type as string]: options },
          })),
        }
      : {}),
  }));
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
          id: 'runs',
          source: 'metrics',
          request: 'aggregate',
          name: ['mastra_agent_duration_ms'],
          aggregation: 'count',
          compare: 'previousWindow',
        },
      ],
      options: {
        items: [
          { label: 'Agent runs', icon: 'bot', format: 'count', value: { query: 'runs' }, detail: 'in this range' },
        ],
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
          id: 'runs',
          source: 'metrics',
          request: 'timeSeries',
          name: ['mastra_agent_duration_ms'],
          aggregation: 'count',
          groupBy: ['status'],
        },
      ],
      options: {
        chart: 'stackedBar',
        format: 'count',
        series: [{ dataKey: 'runs', label: 'Runs', color: 'green', value: { query: 'runs' } }],
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
