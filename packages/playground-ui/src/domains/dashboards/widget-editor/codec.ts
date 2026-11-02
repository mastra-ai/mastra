import type { DashboardColumn, DashboardQuery, DashboardWidget, DashboardWidgetView } from '@mastra/client-js';
import { kpisOptionsSchema } from '../kinds/kpis/options';
import { scoresOptionsSchema } from '../kinds/scores/options';
import type { Scorer } from '../lib/scores';
import { tableColumnOptionsSchema, tableOptionsSchema } from '../lib/table';
import { timeseriesOptionsSchema } from '../lib/timeseries';
import { exprRefs } from '../lib/values';
import type { ValueExpr, ValueFormat, ValueRef } from '../lib/values';
import {
  AGGREGATION_LABELS,
  DIMENSIONS,
  EDITOR_KINDS,
  FAILED_STATUSES,
  PERCENTILES,
  STATIC_ENTRIES,
  aggregationsFor,
  dimensionLabel,
  findEntry,
  isAdditive,
  isPercentile,
  isTimeseriesKind,
  scoreEntry,
  scoreEntryId,
} from './catalogue';
import type { Aggregation, CatalogueEntry, EditorKind } from './catalogue';
import { combineKey } from './draft';
import type {
  ChartColor,
  CombineDraft,
  CombineOp,
  FilterDraft,
  KpiIcon,
  MetricDraft,
  ViewDraft,
  WidgetDraft,
} from './draft';

/**
 * Draft ↔ widget. `draftToWidget` maps "metrics + split + display" onto each kind's queries and
 * options; `widgetToDraft` reads a widget back only when re-encoding it gives the same widget, so
 * the editor never offers to edit what it can't express.
 */

const EMPTY_MESSAGE = 'No data in this range.';
const SERIES_COLORS: ChartColor[] = ['sky', 'green', 'violet', 'teal', 'indigo', 'warning', 'error', 'neutral'];
export const seriesColor = (index: number) => SERIES_COLORS[index % SERIES_COLORS.length] ?? 'neutral';

const kindLabel = (kind: EditorKind) => EDITOR_KINDS.find(k => k.value === kind)?.label ?? kind;

const FORMAT_LABELS: Record<ValueFormat, string> = {
  count: 'counts',
  usd: 'cost',
  duration: 'durations',
  percent: 'percentages',
  score: 'scores',
};

export const defaultMetricLabel = (entry: CatalogueEntry, aggregation: Aggregation | undefined) =>
  entry.source === 'metrics' && entry.aggregations.length > 1 && aggregation
    ? `${entry.label} (${AGGREGATION_LABELS[aggregation]})`
    : entry.label;

export const defaultIcon = (entry: CatalogueEntry): KpiIcon => {
  if (entry.format === 'usd') return 'coins';
  if (entry.source === 'metrics' && entry.aggregations[0] === 'count') return 'bot';
  return 'hash';
};

export const defaultComboLabel = (op: CombineOp, a: string, b: string) =>
  op === 'minus' ? `${a} − ${b}` : `Share of ${a}`;

/** A metric the view's kind can show, with what it reads as. */
type Shown = {
  draft: MetricDraft;
  entry: CatalogueEntry;
  aggregation?: Aggregation;
  format: ValueFormat;
  label: string;
};

type ShownCombo = { draft: CombineDraft; a: Shown; b: Shown; format: ValueFormat; label: string };

export type EncodedView = {
  /** Absent while the view has an issue. */
  view?: DashboardWidgetView;
  issues: string[];
  /** Why a metric or combination, by key, isn't shown in this kind. Flagged items are kept in the form. */
  flags: Record<string, string>;
};

export type EncodedWidget = {
  /** Absent while any view, or the widget, has an issue. */
  widget?: DashboardWidget;
  views: EncodedView[];
  issues: string[];
};

function resolveMetrics(view: ViewDraft, kind: EditorKind, scorers: readonly Scorer[]) {
  const flags: Record<string, string> = {};
  const shown: Shown[] = [];
  const timeseries = isTimeseriesKind(kind);
  for (const draft of view.metrics) {
    const entry = findEntry(draft.entry, scorers);
    if (!entry) {
      flags[draft.key] = 'This metric no longer exists.';
      continue;
    }
    const allowed = aggregationsFor(entry, kind);
    if (!allowed) {
      flags[draft.key] = `Can't be shown as ${kindLabel(kind)}.`;
      continue;
    }
    let aggregation: Aggregation | undefined;
    if (entry.source === 'metrics') {
      aggregation = draft.aggregation ?? allowed[0];
      if (!aggregation || !allowed.includes(aggregation)) {
        const picks = allowed.map(a => AGGREGATION_LABELS[a]).join(', ');
        flags[draft.key] =
          `${aggregation ? AGGREGATION_LABELS[aggregation] : 'This'} can't be shown as ${kindLabel(kind)}. Pick ${picks}.`;
        continue;
      }
    }
    const lock = shown[0]?.format;
    if (timeseries && lock !== undefined && entry.format !== lock) {
      flags[draft.key] =
        `Charts ${FORMAT_LABELS[entry.format]}, not ${FORMAT_LABELS[lock]}. Add another view to chart it.`;
      continue;
    }
    if (timeseries && view.splitBy && (entry.source !== 'metrics' || isPercentile(aggregation))) {
      flags[draft.key] = "Can't be split into series.";
      continue;
    }
    if (kind === 'scores' && shown.length > 0) {
      flags[draft.key] = 'A Scores card shows one scorer.';
      continue;
    }
    shown.push({
      draft,
      entry,
      aggregation,
      format: entry.format,
      label: draft.label?.trim() || defaultMetricLabel(entry, aggregation),
    });
  }

  const combos: ShownCombo[] = [];
  const lock = shown[0]?.format;
  for (const draft of view.combos) {
    const a = shown.find(s => s.draft.key === draft.a);
    const b = shown.find(s => s.draft.key === draft.b);
    if (kind === 'scores') flags[draft.key] = "Can't be shown in a Scores card.";
    else if (timeseries && view.splitBy) flags[draft.key] = "Can't be combined once split.";
    else if (!a || !b) flags[draft.key] = 'Needs both metrics shown.';
    else if (a === b) flags[draft.key] = 'Pick two different metrics.';
    else if (a.format !== b.format) flags[draft.key] = 'Combines metrics with different units.';
    else {
      const format: ValueFormat = draft.op === 'minus' ? a.format : 'percent';
      if (kind === 'kpis' && format !== 'count' && format !== 'usd') flags[draft.key] = "Can't be shown as KPI.";
      else if (timeseries && lock && format !== lock)
        flags[draft.key] = `Charts ${FORMAT_LABELS[format]}, not ${FORMAT_LABELS[lock]}. Add another view to chart it.`;
      else
        combos.push({
          draft,
          a,
          b,
          format,
          label: draft.label?.trim() || defaultComboLabel(draft.op, a.label, b.label),
        });
    }
  }
  return { shown, combos, flags };
}

function valueOf(shown: Shown, group?: string): ValueExpr {
  const query = shown.draft.key;
  if (shown.entry.source === 'errorRate') {
    const failed: ValueRef = { query, groups: FAILED_STATUSES };
    const completed: ValueRef = { query, notGroups: FAILED_STATUSES };
    return { coalesce: [{ ratio: { of: failed, over: { sum: [completed, failed] } } }, { const: 0 }] };
  }
  const percentile = shown.aggregation ? PERCENTILES[shown.aggregation] : undefined;
  return {
    query,
    ...(shown.entry.source === 'metrics' && shown.entry.field ? { field: shown.entry.field } : {}),
    ...(percentile !== undefined ? { percentile } : {}),
    ...(group !== undefined ? { groups: [group] } : {}),
  };
}

const comboValue = (combo: ShownCombo): ValueExpr =>
  combo.draft.op === 'minus'
    ? { minus: [valueOf(combo.a), valueOf(combo.b)] }
    : { ratio: { of: valueOf(combo.a), over: { sum: [valueOf(combo.a), valueOf(combo.b)] } } };

function filtersOf(view: ViewDraft) {
  const filters = Object.fromEntries(view.filters.filter(f => f.value).map(f => [f.dimension, f.value]));
  return Object.keys(filters).length ? { filters } : {};
}

function filterIssues(view: ViewDraft, shown: Shown[]) {
  const issues: string[] = [];
  const scores = shown.some(s => s.entry.source === 'scores');
  for (const f of view.filters) {
    const label = dimensionLabel(f.dimension);
    if (!f.value) issues.push(`Pick a value for the ${label} filter.`);
    if (scores && DIMENSIONS.find(d => d.id === f.dimension)?.metricsOnly)
      issues.push(`Scores can't be filtered by ${label}.`);
  }
  return issues;
}

function timeseriesQuery(shown: Shown, view: ViewDraft): DashboardQuery {
  const id = shown.draft.key;
  const filters = filtersOf(view);
  const { entry, aggregation } = shown;
  if (entry.source === 'scores')
    return { id, source: 'scores', request: 'timeSeries', scorerId: entry.scorerId, aggregation: 'avg', ...filters };
  if (entry.source === 'errorRate')
    return {
      id,
      source: 'metrics',
      request: 'timeSeries',
      name: [entry.name],
      aggregation: 'count',
      groupBy: ['status'],
      ...filters,
    };
  const percentile = aggregation ? PERCENTILES[aggregation] : undefined;
  if (percentile !== undefined)
    return {
      id,
      source: 'metrics',
      request: 'percentiles',
      name: entry.names[0],
      percentiles: [percentile],
      ...filters,
    };
  return {
    id,
    source: 'metrics',
    request: 'timeSeries',
    name: entry.names,
    aggregation: aggregation as Exclude<Aggregation, 'p50' | 'p95' | 'p99'>,
    ...(view.splitBy ? { groupBy: [view.splitBy] } : {}),
    ...filters,
  };
}

type ViewParts = Pick<DashboardWidgetView, 'queries' | 'options' | 'columns'>;

function encodeTimeseries(view: ViewDraft, chart: 'line' | 'stackedBar', shown: Shown[], combos: ShownCombo[]) {
  const issues: string[] = [];
  const series: Record<string, unknown>[] = [];
  if (view.splitBy) {
    if (!view.splitValues.length) issues.push(`Pick the ${dimensionLabel(view.splitBy)} values to chart.`);
    if (new Set(view.splitValues).size !== view.splitValues.length) issues.push('Each value can be charted once.');
    for (const s of shown) {
      view.splitValues.forEach((value, i) => {
        series.push({
          dataKey: `${s.draft.key}-${i}`,
          label: shown.length > 1 ? `${s.label} · ${value}` : value,
          color: seriesColor(series.length),
          value: valueOf(s, value),
        });
      });
    }
  } else {
    for (const s of shown)
      series.push({
        dataKey: s.draft.key,
        label: s.label,
        color: s.draft.color ?? seriesColor(series.length),
        value: valueOf(s),
      });
    for (const c of combos)
      series.push({
        dataKey: c.draft.key,
        label: c.label,
        color: c.draft.color ?? seriesColor(series.length),
        value: comboValue(c),
      });
  }
  const nonAdditive = shown.some(
    s => s.entry.source === 'scores' || (s.entry.source === 'metrics' && !isAdditive(s.aggregation)),
  );
  const parts: ViewParts = {
    queries: shown.map(s => timeseriesQuery(s, view)),
    options: {
      chart,
      format: shown[0]?.format,
      series,
      ...(nonAdditive ? { buckets: 'api' } : {}),
      emptyMessage: EMPTY_MESSAGE,
    },
  };
  return { parts, issues };
}

function encodeTable(view: ViewDraft, shown: Shown[], combos: ShownCombo[]) {
  const split = view.splitBy;
  if (!split) return { issues: ['Pick what each row is.'] };
  const groupBy = [split];
  const compare = view.compare ? { compare: 'previousWindow' as const } : {};
  const queries: DashboardQuery[] = shown.map(s => {
    const entry = s.entry as Extract<CatalogueEntry, { source: 'metrics' }>;
    return {
      id: s.draft.key,
      source: 'metrics',
      request: 'breakdown',
      name: entry.names,
      aggregation: s.aggregation as Exclude<Aggregation, 'p50' | 'p95' | 'p99'>,
      groupBy,
      ...filtersOf(view),
      limit: 100,
      ...compare,
    };
  });
  const better = (lowerIsBetter: boolean | undefined) => (lowerIsBetter ? { better: 'lower' } : {});
  const values: DashboardColumn[] = [
    ...shown.map(s => ({
      id: s.draft.key,
      label: s.label,
      options: {
        type: 'value',
        value: valueOf(s),
        format: s.format,
        ...(isAdditive(s.aggregation) ? { additive: true } : {}),
        ...better(s.draft.lowerIsBetter),
      },
    })),
    ...combos.map(c => ({
      id: c.draft.key,
      label: c.label,
      options: { type: 'value', value: comboValue(c), format: c.format, ...better(c.draft.lowerIsBetter) },
    })),
  ];
  const sorted = values.find(c => c.id === view.sort) ?? values[0];
  const parts: ViewParts = {
    queries,
    columns: [
      { id: 'name', label: dimensionLabel(split), options: { type: 'name' } },
      ...values,
      ...(view.compare ? [{ id: 'change', label: 'Change', options: { type: 'change' } }] : []),
    ],
    options: {
      groupBy,
      defaultSort: { column: sorted?.id ?? '', direction: view.sortDirection },
      emptyMessage: EMPTY_MESSAGE,
    },
  };
  return { parts, issues: [] };
}

function encodeKpis(view: ViewDraft, shown: Shown[], combos: ShownCombo[]): ViewParts {
  const lower = (lowerIsBetter: boolean | undefined) => (lowerIsBetter ? { lowerIsBetter: true } : {});
  return {
    queries: shown.map(s => {
      const entry = s.entry as Extract<CatalogueEntry, { source: 'metrics' }>;
      return {
        id: s.draft.key,
        source: 'metrics',
        request: 'aggregate',
        name: entry.names,
        aggregation: s.aggregation as Exclude<Aggregation, 'p50' | 'p95' | 'p99'>,
        ...filtersOf(view),
        compare: 'previousWindow',
      } satisfies DashboardQuery;
    }),
    options: {
      items: [
        ...shown.map(s => ({
          label: s.label,
          icon: s.draft.icon ?? defaultIcon(s.entry),
          format: s.format,
          value: valueOf(s),
          detail: s.entry.description,
          ...lower(s.draft.lowerIsBetter),
        })),
        ...combos.map(c => ({
          label: c.label,
          icon: c.draft.icon ?? 'hash',
          format: c.format,
          value: comboValue(c),
          detail: defaultComboLabel(c.draft.op, c.a.label, c.b.label),
          ...lower(c.draft.lowerIsBetter),
        })),
      ],
    },
  };
}

const seriesId = (key: string) => `${key}-series`;

function encodeScores(view: ViewDraft, shown: Shown): ViewParts {
  const entry = shown.entry as Extract<CatalogueEntry, { source: 'scores' }>;
  const id = shown.draft.key;
  const common = { source: 'scores', scorerId: entry.scorerId, aggregation: 'avg', ...filtersOf(view) } as const;
  return {
    queries: [
      { id, request: 'aggregate', ...common },
      { id: seriesId(id), request: 'timeSeries', ...common },
    ],
    options: { average: id, series: seriesId(id), emptyMessage: EMPTY_MESSAGE },
  };
}

export function encodeView(view: ViewDraft, kind: EditorKind, scorers: readonly Scorer[]): EncodedView {
  const { shown, combos, flags } = resolveMetrics(view, kind, scorers);
  const issues = [...filterIssues(view, shown)];
  if (!view.label.trim()) issues.push('Name this view.');
  if (!shown.length) issues.push(view.metrics.length ? 'None of the metrics can be shown here.' : 'Add a metric.');
  let parts: ViewParts | undefined;
  const [first] = shown;
  if (first) {
    if (isTimeseriesKind(kind)) {
      const encoded = encodeTimeseries(view, kind, shown, combos);
      issues.push(...encoded.issues);
      parts = encoded.parts;
    } else if (kind === 'table') {
      const encoded = encodeTable(view, shown, combos);
      issues.push(...encoded.issues);
      parts = encoded.parts;
    } else if (kind === 'kpis') parts = encodeKpis(view, shown, combos);
    else parts = encodeScores(view, first);
  }
  if (issues.length || !parts) return { issues, flags };
  return { view: { label: view.label.trim(), ...parts }, issues, flags };
}

const WIDGET_KIND: Record<EditorKind, string> = {
  kpis: 'kpis',
  line: 'timeseries',
  stackedBar: 'timeseries',
  table: 'table',
  scores: 'scores',
};

export function draftToWidget(draft: WidgetDraft, scorers: readonly Scorer[]): EncodedWidget {
  const views = draft.views.map(v => encodeView(v, draft.kind, scorers));
  const issues: string[] = [];
  if (!draft.title.trim()) issues.push('Add a title.');
  const labels = draft.views.map(v => v.label.trim());
  if (new Set(labels).size !== labels.length) issues.push('Each view needs its own name.');
  views.forEach((v, i) => {
    for (const issue of v.issues)
      issues.push(draft.views.length > 1 ? `${labels[i] || `View ${i + 1}`}: ${issue}` : issue);
  });
  const encoded = views.flatMap(v => v.view ?? []);
  if (issues.length || encoded.length !== views.length) return { views, issues };
  return {
    views,
    issues,
    widget: {
      id: draft.id,
      span: draft.span,
      kind: WIDGET_KIND[draft.kind],
      title: draft.title.trim(),
      views: encoded,
    },
  };
}

// --- Decoding ---

/** Equal as JSON, whatever the key order. */
function sameJson(a: unknown, b: unknown) {
  const canonical = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(canonical);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.keys(v)
          .filter(k => (v as Record<string, unknown>)[k] !== undefined)
          .sort()
          .map(k => [k, canonical((v as Record<string, unknown>)[k])]),
      );
    return v;
  };
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

const sameNames = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((n, i) => n === b[i]);

const isRef = (expr: ValueExpr | undefined): expr is ValueRef => !!expr && 'query' in expr;

/** The catalogue entry and aggregation a query was encoded from; `field` is what its values read. */
function decodeQuery(
  query: DashboardQuery,
  field: string | undefined,
): { entry: CatalogueEntry; aggregation?: Aggregation } | undefined {
  if (query.source === 'scores') {
    const scorerId = 'scorerId' in query ? query.scorerId : undefined;
    return scorerId ? { entry: scoreEntry({ scorerId, name: scorerId }) } : undefined;
  }
  if (query.source !== 'metrics') return undefined;
  if (query.request === 'percentiles') {
    const aggregation = (Object.keys(PERCENTILES) as Aggregation[]).find(a => PERCENTILES[a] === query.percentiles[0]);
    const entry = STATIC_ENTRIES.find(
      e =>
        e.source === 'metrics' &&
        sameNames(e.names, [query.name]) &&
        !!aggregation &&
        e.aggregations.includes(aggregation),
    );
    return entry && aggregation ? { entry, aggregation } : undefined;
  }
  const names = Array.isArray(query.name) ? query.name : [query.name];
  if (query.request === 'timeSeries' && query.groupBy?.[0] === 'status') {
    const entry = STATIC_ENTRIES.find(e => e.source === 'errorRate' && sameNames([e.name], names));
    return entry ? { entry } : undefined;
  }
  const aggregation = query.aggregation as Aggregation;
  const entry = STATIC_ENTRIES.find(
    e =>
      e.source === 'metrics' && sameNames(e.names, names) && e.field === field && e.aggregations.includes(aggregation),
  );
  return entry ? { entry, aggregation } : undefined;
}

function decodeFilters(query: DashboardQuery | undefined): FilterDraft[] | undefined {
  const filters = query && 'filters' in query ? (query.filters as Record<string, unknown> | undefined) : undefined;
  if (!filters) return [];
  const drafts: FilterDraft[] = [];
  for (const [dimension, value] of Object.entries(filters)) {
    if (typeof value !== 'string' || !DIMENSIONS.some(d => d.id === dimension)) return undefined;
    drafts.push({ dimension, value });
  }
  return drafts;
}

/** A shown item read back: the label and color left unset when they're the defaults. */
type DecodedItem = {
  key: string;
  expr: ValueExpr;
  label: string;
  color?: string;
  icon?: string;
  lowerIsBetter?: boolean;
};

function decodeItems(
  view: DashboardWidgetView,
  items: DecodedItem[],
  scorers: readonly Scorer[],
): Pick<ViewDraft, 'metrics' | 'combos'> | undefined {
  const firstRef = (id: string) =>
    items.flatMap(i => exprRefs(i.expr)).find(r => r.query === id && !r.groups?.length) ??
    items.flatMap(i => exprRefs(i.expr)).find(r => r.query === id);
  const metrics: MetricDraft[] = [];
  const labels = new Map<string, string>();
  for (const query of view.queries) {
    if (!query.id || query.id.endsWith('-series')) continue;
    const decoded = decodeQuery(query, firstRef(query.id)?.field);
    if (!decoded) return undefined;
    const entry = findEntry(decoded.entry.id, scorers) ?? decoded.entry;
    const item = items.find(i => i.key === query.id);
    const fallback = defaultMetricLabel(entry, decoded.aggregation);
    const label = item && item.label !== fallback ? item.label : undefined;
    labels.set(query.id, label ?? fallback);
    metrics.push({
      key: query.id,
      entry: entry.id,
      ...(decoded.aggregation ? { aggregation: decoded.aggregation } : {}),
      ...(label ? { label } : {}),
      ...(item?.color ? { color: item.color as ChartColor } : {}),
      ...(item?.icon && item.icon !== defaultIcon(entry) ? { icon: item.icon as KpiIcon } : {}),
      ...(item?.lowerIsBetter ? { lowerIsBetter: true } : {}),
    });
  }
  const combos: CombineDraft[] = [];
  for (const item of items) {
    if (metrics.some(m => m.key === item.key)) continue;
    const op: CombineOp | undefined = 'minus' in item.expr ? 'minus' : 'ratio' in item.expr ? 'share' : undefined;
    const [a, b] = exprRefs(item.expr).map(r => r.query);
    const combineB = op === 'share' ? exprRefs(item.expr)[2]?.query : b;
    if (!op || !a || !combineB) return undefined;
    const fallback = defaultComboLabel(op, labels.get(a) ?? '', labels.get(combineB) ?? '');
    combos.push({
      key: item.key,
      op,
      a,
      b: combineB,
      ...(item.label !== fallback ? { label: item.label } : {}),
      ...(item.color ? { color: item.color as ChartColor } : {}),
      ...(item.icon && item.icon !== 'hash' ? { icon: item.icon as KpiIcon } : {}),
      ...(item.lowerIsBetter ? { lowerIsBetter: true } : {}),
    });
  }
  return { metrics, combos };
}

const withoutDefaultColor = (color: string, index: number) => (color === seriesColor(index) ? undefined : color);

function decodeView(view: DashboardWidgetView, kind: EditorKind, scorers: readonly Scorer[]): ViewDraft | undefined {
  const filters = decodeFilters(view.queries[0]);
  if (!filters) return undefined;
  const base = { label: view.label ?? '', filters, splitValues: [], compare: false, sortDirection: 'desc' as const };

  if (isTimeseriesKind(kind)) {
    const options = timeseriesOptionsSchema.safeParse(view.options);
    if (!options.success) return undefined;
    const split = view.queries.find(q => 'groupBy' in q && q.groupBy?.length && q.groupBy[0] !== 'status');
    const splitBy = split && 'groupBy' in split ? split.groupBy?.[0] : undefined;
    if (splitBy) {
      const firstKey = view.queries[0]?.id;
      const splitValues = options.data.series
        .filter(s => s.dataKey.startsWith(`${firstKey}-`))
        .map(s => (isRef(s.value) ? s.value.groups?.[0] : undefined));
      if (splitValues.some(v => v === undefined)) return undefined;
      // Split series are keyed `<query>-<i>`; decode them against their query so they read as metrics.
      const items = options.data.series.map(s => ({
        key: isRef(s.value) ? s.value.query : s.dataKey,
        expr: s.value,
        label: s.label,
      }));
      const decoded = decodeItems(view, items, scorers);
      if (!decoded) return undefined;
      // Split series are labelled by value, so the metrics keep their default labels and colors.
      return {
        ...base,
        metrics: decoded.metrics.map(({ label: _l, color: _c, ...m }) => m),
        combos: [],
        splitBy,
        splitValues: splitValues as string[],
      };
    }
    const items = options.data.series.map((s, i) => ({
      key: s.dataKey,
      expr: s.value,
      label: s.label,
      color: withoutDefaultColor(s.color, i),
    }));
    const decoded = decodeItems(view, items, scorers);
    return decoded && { ...base, ...decoded };
  }

  if (kind === 'table') {
    const options = tableOptionsSchema.safeParse(view.options);
    if (!options.success) return undefined;
    const items: DecodedItem[] = [];
    let compare = false;
    for (const column of view.columns ?? []) {
      const parsed = tableColumnOptionsSchema.safeParse(column.options);
      if (!parsed.success) return undefined;
      if (parsed.data.type === 'change') compare = true;
      if (parsed.data.type === 'value')
        items.push({
          key: column.id,
          expr: parsed.data.value,
          label: column.label ?? '',
          lowerIsBetter: parsed.data.better === 'lower',
        });
    }
    const decoded = decodeItems(view, items, scorers);
    if (!decoded) return undefined;
    const sort = options.data.defaultSort.column;
    return {
      ...base,
      ...decoded,
      splitBy: options.data.groupBy[0],
      compare,
      ...(sort !== items[0]?.key ? { sort } : {}),
      sortDirection: options.data.defaultSort.direction,
    };
  }

  if (kind === 'kpis') {
    const options = kpisOptionsSchema.safeParse(view.options);
    if (!options.success) return undefined;
    // Tiles have no ids: a metric's tile is the one reading its query alone.
    const items = options.data.items.map(item => ({
      key: isRef(item.value) ? item.value.query : combineKey(),
      expr: item.value,
      label: item.label,
      icon: item.icon,
      lowerIsBetter: item.lowerIsBetter,
    }));
    const decoded = decodeItems(view, items, scorers);
    return decoded && { ...base, ...decoded };
  }

  const options = scoresOptionsSchema.safeParse(view.options);
  if (!options.success) return undefined;
  const decoded = decodeItems(view, [], scorers);
  return decoded && { ...base, ...decoded };
}

function editorKindOf(widget: DashboardWidget): EditorKind | undefined {
  if (widget.kind === 'timeseries') {
    const chart = (widget.views[0]?.options as { chart?: unknown } | undefined)?.chart;
    return chart === 'line' || chart === 'stackedBar' ? chart : undefined;
  }
  return EDITOR_KINDS.find(k => k.value === widget.kind)?.value;
}

/** The draft a widget was made from, or `undefined` when the editor can't express it exactly. */
export function widgetToDraft(widget: DashboardWidget, scorers: readonly Scorer[]): WidgetDraft | undefined {
  const kind = editorKindOf(widget);
  if (!kind) return undefined;
  const views: ViewDraft[] = [];
  for (const view of widget.views) {
    const decoded = decodeView(view, kind, scorers);
    if (!decoded) return undefined;
    views.push(decoded);
  }
  const draft: WidgetDraft = {
    id: widget.id,
    span: widget.span,
    title: widget.title ?? '',
    kind,
    kindPicked: true,
    views,
  };
  const encoded = draftToWidget(draft, scorers);
  return encoded.widget && sameJson(encoded.widget, widget) ? draft : undefined;
}
