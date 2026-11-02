import { nanoid } from 'nanoid';
import type { Scorer } from '../lib/scores';
import type { CHART_COLOR_NAMES } from '../lib/values';
import { aggregationsFor, findEntry, isTimeseriesKind } from './catalogue';
import type { Aggregation, EditorKind } from './catalogue';

/** What the widget editor's form holds; `codec.ts` turns it into a `DashboardWidget` and back. */

export type ChartColor = (typeof CHART_COLOR_NAMES)[number];
export type KpiIcon = 'bot' | 'coins' | 'hash' | 'threads';

export type MetricDraft = {
  /** The metric's query id, and its series' data key, column id or tile ref. */
  key: string;
  /** A catalogue entry id. */
  entry: string;
  aggregation?: Aggregation;
  label?: string;
  color?: ChartColor;
  icon?: KpiIcon;
  lowerIsBetter?: boolean;
};

export type CombineOp = 'minus' | 'share';

export const COMBINE_OPS: { value: CombineOp; label: string; formula: string; description: string }[] = [
  { value: 'minus', label: 'Difference', formula: 'A − B', description: 'One metric minus another (A − B)' },
  {
    value: 'share',
    label: 'Share of total',
    formula: 'A ÷ (A + B)',
    description: 'One metric as a % of both (A ÷ (A + B))',
  },
];

/** A preset formula over two of the view's metrics, by key. */
export type CombineDraft = {
  key: string;
  op: CombineOp;
  a: string;
  b: string;
  label?: string;
  color?: ChartColor;
  icon?: KpiIcon;
  lowerIsBetter?: boolean;
};

export type FilterDraft = { dimension: string; value: string };

export type ViewDraft = {
  label: string;
  metrics: MetricDraft[];
  combos: CombineDraft[];
  splitBy?: string;
  /** Timeseries only: the split's values, one series each. */
  splitValues: string[];
  filters: FilterDraft[];
  /** Table only: adds a change column against the previous period. */
  compare: boolean;
  /** Table only: the column sorted by, by key; the first value column when unset. */
  sort?: string;
  sortDirection: 'asc' | 'desc';
};

export type WidgetDraft = {
  id: string;
  span: 1 | 2 | 3 | 4 | 6 | 12;
  title: string;
  kind: EditorKind;
  /** Until the user picks a kind, the editor suggests one from the first view. */
  kindPicked: boolean;
  views: ViewDraft[];
};

export const MAX_METRICS_PER_VIEW = 8;
export const DEFAULT_VIEW_LABEL = 'Default view';

export const metricKey = () => `m${nanoid(8)}`;
export const combineKey = () => `c${nanoid(8)}`;

export const emptyView = (label: string): ViewDraft => ({
  label,
  metrics: [],
  combos: [],
  splitValues: [],
  filters: [],
  compare: false,
  sortDirection: 'desc',
});

/** "New widget N" with the first N no other widget's title uses. */
export function newWidgetTitle(titles: readonly (string | undefined)[]) {
  const used = new Set(titles);
  let n = 1;
  while (used.has(`New widget ${n}`)) n++;
  return `New widget ${n}`;
}

export const emptyWidget = (title: string): WidgetDraft => ({
  id: nanoid(),
  span: 6,
  title,
  kind: 'line',
  kindPicked: false,
  views: [emptyView(DEFAULT_VIEW_LABEL)],
});

/** "View N" with the first N no other view uses. */
export function nextViewLabel(views: readonly ViewDraft[]) {
  const used = new Set(views.map(v => v.label));
  let n = views.length + 1;
  while (used.has(`View ${n}`)) n++;
  return `View ${n}`;
}

/**
 * The kind a view reads best as: a scorer's card for a score, a table once split into rows, KPI
 * tiles for one count or cost, and a line over time for the rest.
 */
export function suggestKind(view: ViewDraft, scorers: readonly Scorer[]): EditorKind {
  const entries = view.metrics.flatMap(m => findEntry(m.entry, scorers) ?? []);
  const [first] = entries;
  if (!first) return 'line';
  if (entries.length === 1 && first.source === 'scores') return 'scores';
  if (view.splitBy) return 'table';
  if (entries.length === 1 && aggregationsFor(first, 'kpis')) return 'kpis';
  return 'line';
}

/** The default span a new widget of a kind takes on the page. */
export const defaultSpan = (kind: EditorKind): WidgetDraft['span'] => (kind === 'table' || kind === 'kpis' ? 12 : 6);

/** What "Split by" reads as for a kind; `undefined` when the kind can't split. */
export function splitLabel(kind: EditorKind) {
  if (isTimeseriesKind(kind)) return 'One series per';
  if (kind === 'table') return 'Rows';
  return undefined;
}
