import type { Aggregation, EditorKind } from './catalogue';
import { emptyView, metricKey } from './draft';
import type { MetricDraft, ViewDraft } from './draft';

/** A metric the empty state adds in one click; the editor then suggests how to draw it. */
export type QuickMetric = { entry: string; aggregation?: Aggregation; label: string };

export const QUICK_METRICS: QuickMetric[] = [
  { entry: 'total-tokens', label: 'Total tokens' },
  { entry: 'agent-runs', label: 'Agent runs' },
  { entry: 'model-cost', label: 'Model cost' },
  { entry: 'agent-error-rate', label: 'Agent error rate' },
  { entry: 'agent-latency', aggregation: 'p95', label: 'P95 agent latency' },
];

/** A ready-made widget the empty state starts from; everything stays editable. */
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
      ...emptyView('Default view'),
      metrics: [metric('total-tokens'), metric('agent-runs'), metric('model-cost')],
    }),
  },
  {
    id: 'token-mix',
    title: 'Token mix',
    description: 'Input and output tokens over time',
    kind: 'stackedBar',
    view: () => ({ ...emptyView('Default view'), metrics: [metric('input-tokens'), metric('output-tokens')] }),
  },
  {
    id: 'agent-latency',
    title: 'Agent latency',
    description: 'P50, P95 and P99 over time',
    kind: 'line',
    view: () => ({
      ...emptyView('Default view'),
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
      ...emptyView('Default view'),
      splitBy: 'entityName',
      compare: true,
      metrics: [metric('agent-runs'), metric('agent-latency', { aggregation: 'avg', lowerIsBetter: true })],
    }),
  },
];
