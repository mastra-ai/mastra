import type { EditorKind } from './catalogue';
import { DEFAULT_VIEW_LABEL, emptyView, metricKey } from './draft';
import type { MetricDraft, ViewDraft } from './draft';

/** A ready-made widget the metric menu suggests for an empty view; everything stays editable. */
export type WidgetPreset = {
  id: string;
  title: string;
  description: string;
  kind: EditorKind;
  view: () => ViewDraft;
};

const metric = (entry: string, rest: Omit<MetricDraft, 'key' | 'entry'> = {}): MetricDraft => ({
  key: metricKey(),
  entry,
  ...rest,
});

export const WIDGET_PRESETS: WidgetPreset[] = [
  {
    id: 'usage-glance',
    title: 'Usage at a glance',
    description: 'Tokens, runs and cost against the previous period',
    kind: 'kpis',
    view: () => ({
      ...emptyView(DEFAULT_VIEW_LABEL),
      metrics: [metric('total-tokens'), metric('agent-runs'), metric('model-cost')],
    }),
  },
  {
    id: 'token-mix',
    title: 'Token mix',
    description: 'Input and output tokens over time',
    kind: 'stackedBar',
    view: () => ({ ...emptyView(DEFAULT_VIEW_LABEL), metrics: [metric('input-tokens'), metric('output-tokens')] }),
  },
  {
    id: 'agent-latency',
    title: 'Agent latency',
    description: 'P50, P95 and P99 over time',
    kind: 'line',
    view: () => ({
      ...emptyView(DEFAULT_VIEW_LABEL),
      metrics: [
        metric('agent-latency', { aggregation: 'p50' }),
        metric('agent-latency', { aggregation: 'p95' }),
        metric('agent-latency', { aggregation: 'p99' }),
      ],
    }),
  },
  {
    id: 'runs-per-entity',
    title: 'Runs per entity',
    description: 'Runs and average latency per agent, with change',
    kind: 'table',
    view: () => ({
      ...emptyView(DEFAULT_VIEW_LABEL),
      splitBy: 'entityName',
      compare: true,
      metrics: [metric('agent-runs'), metric('agent-latency', { aggregation: 'avg', lowerIsBetter: true })],
    }),
  },
];
