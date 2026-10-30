import type { DashboardColumn, DashboardQuery } from '@mastra/client-js';
import { z } from 'zod/v4';
import type { DrilldownScope } from '../../metrics/drilldown';
import { formatCount, formatDuration, formatPercent, formatUsd } from '../../metrics/lib/chart-format';
import { groupsOf, measureOf, rowsOf } from './answers';
import type { DashboardAnswer } from './requests';
import { answersById, evaluate, exprRefs, queryRefSchema, unknownQueryIssues, valueExprSchema } from './values';
import type { ValueRef } from './values';

/**
 * The `table` kind: one row per group, joined across the view's queries on `groupBy`. Each column
 * shows the row's name, a dimension, a value read from the row's answers, or a value's change
 * against the previous window.
 */

const TRACK = String.raw`(?:auto|max-content|\d+(?:\.\d+)?(?:rem|fr))`;
/** A CSS grid track: `auto`, `max-content`, `12rem`, `3fr`, or `minmax()` of two of those. */
const widthSchema = z
  .string()
  .regex(
    new RegExp(String.raw`^(?:${TRACK}|minmax\(\s*${TRACK}\s*,\s*${TRACK}\s*\))$`),
    'Expected auto, max-content, Nrem, Nfr or minmax(a, b) of those',
  );

const shared = {
  /** The header's tooltip. */
  description: z.string().optional(),
  width: widthSchema.optional(),
  sortable: z.boolean().optional(),
};

const nameColumnSchema = z.strictObject({
  type: z.literal('name'),
  /** `project` shows the host's name for a project id. */
  as: z.literal('project').optional(),
  /** What a row without a name reads as. Defaults to "Unnamed". */
  unnamed: z.string().optional(),
  /** Before the name: an entity's icon, or the provider logo with the name read as `provider › model`. */
  mark: z
    .union([
      z.strictObject({ icon: z.enum(['agent', 'workflow', 'tool']) }),
      z.strictObject({ providerDimension: z.string().min(1) }),
    ])
    .optional(),
  ...shared,
});

const dimensionColumnSchema = z.strictObject({
  type: z.literal('dimension'),
  dimension: z.string().min(1),
  as: z.literal('project').optional(),
  /** A lookup: that query's `dimension`, matched on the row's `joinOn` dimension. */
  query: queryRefSchema.optional(),
  joinOn: z.string().min(1).optional(),
  ...shared,
});

export const TABLE_VALUE_FORMATS = ['count', 'usd', 'duration', 'percent'] as const;

const valueColumnSchema = z.strictObject({
  type: z.literal('value'),
  /** Refs read this row's entry in the query: a `measure` of an aggregate, or a group's `field`. */
  value: valueExprSchema,
  format: z.enum(TABLE_VALUE_FORMATS),
  /** The figure the table ranks by, in full tone; the others are muted. */
  emphasis: z.boolean().optional(),
  /** Shown when the row has no value, e.g. 0 for a count. */
  missing: z.number().optional(),
  /** A total: a dropped row shows 0, and a value with none before is "New". */
  additive: z.boolean().optional(),
  /** Which way % Change is good news. */
  better: z.enum(['higher', 'lower']).optional(),
  /** `usd` only: "Not priced" when the row has no value but this column's is above 0. */
  unpricedWhen: z.string().min(1).optional(),
  ...shared,
});

const changeColumnSchema = z.strictObject({
  type: z.literal('change'),
  description: z.string().optional(),
});

export const tableColumnOptionsSchema = z.discriminatedUnion('type', [
  nameColumnSchema,
  dimensionColumnSchema,
  valueColumnSchema,
  changeColumnSchema,
]);

export type TableColumnOptions = z.infer<typeof tableColumnOptionsSchema>;
type ColumnOf<O extends TableColumnOptions> = { id: string; label: string; options: O };
/** A column, told apart by `options.type`. */
export type TableColumn = {
  [T in TableColumnOptions['type']]: ColumnOf<Extract<TableColumnOptions, { type: T }>>;
}[TableColumnOptions['type']];
export type ValueColumn = Extract<TableColumn, { options: { type: 'value' } }>;

function columnOf(id: string, label: string, options: TableColumnOptions): TableColumn {
  switch (options.type) {
    case 'name':
      return { id, label, options };
    case 'dimension':
      return { id, label, options };
    case 'value':
      return { id, label, options };
    case 'change':
      return { id, label, options };
  }
}

export const DRILLDOWN_FIELDS = [
  'projectId',
  'entityName',
  'threadId',
  'resourceId',
  'environment',
  'sessionId',
  'userId',
  'model',
  'provider',
] as const;

export const tableOptionsSchema = z.strictObject({
  /** The dimensions a row is keyed on; the last one names the row. */
  groupBy: z.array(z.string().min(1)).min(1),
  /** The starting sort, and where a third click on a header returns. */
  defaultSort: z.strictObject({ column: z.string().min(1), direction: z.enum(['asc', 'desc']) }),
  /** Rows per page. Without it every row shows. */
  pageSize: z.number().int().min(1).optional(),
  emptyMessage: z.string(),
  ariaLabel: z.string().optional(),
  /** Leaves out rows without a name. */
  hideUnnamed: z.boolean().optional(),
  /** Lists groups active in the previous window but absent now, at zero. Defaults to on. */
  dropped: z.boolean().optional(),
  /** Opens on this view only once it has this many rows; otherwise on the next. */
  openWhen: z.strictObject({ minRows: z.number().int().min(1) }).optional(),
  /** What a row click adds to the view's `click` drilldown. */
  rowDrilldown: z
    .strictObject({
      /** Row dimension → drilldown field. Empty values are left out. */
      fields: z.record(z.string(), z.enum(DRILLDOWN_FIELDS)),
      /** Set: `entityName` goes in as a filter on spans of these types. */
      spanTypes: z.array(z.string().min(1)).min(1).optional(),
      /** The row's name goes in even when empty. */
      keepEmpty: z.boolean().optional(),
    })
    .optional(),
});

export type TableOptions = z.infer<typeof tableOptionsSchema>;

/** The view's columns with their options parsed; `issues` reports what doesn't parse. */
export function parseColumns(columns: readonly DashboardColumn[] | undefined): {
  columns: TableColumn[];
  issues: string[];
} {
  const parsed: TableColumn[] = [];
  const issues: string[] = [];
  for (const [i, column] of (columns ?? []).entries()) {
    const options = tableColumnOptionsSchema.safeParse(column.options ?? {});
    if (!options.success) {
      const issue = options.error.issues[0];
      const path = issue?.path.length ? `.${issue.path.join('.')}` : '';
      issues.push(`columns.${i}.options${path}: ${issue?.message ?? 'invalid'}`);
      continue;
    }
    parsed.push(columnOf(column.id, column.label ?? '', options.data));
  }
  return { columns: parsed, issues };
}

export const isValueColumn = (column: TableColumn): column is ValueColumn => column.options.type === 'value';

/** What the schema can't say: columns that name each other and queries the view has. */
export function tableIssues(
  columns: readonly DashboardColumn[] | undefined,
  options: TableOptions,
  queries: readonly DashboardQuery[],
): string[] {
  const parsed = parseColumns(columns);
  const issues = [...parsed.issues];
  const byId = new Map(parsed.columns.map(c => [c.id, c]));
  const values = parsed.columns.filter(isValueColumn);
  if (!values.length) issues.push('columns: a table needs a value column');
  if (columns && !columns.some(c => c.id === options.defaultSort.column))
    issues.push(`options.defaultSort: no column '${options.defaultSort.column}'`);
  const read: string[] = [];
  for (const column of parsed.columns) {
    const o = column.options;
    if (o.type === 'value') {
      read.push(...exprRefs(o.value).map(r => r.query));
      if (o.unpricedWhen !== undefined && !(byId.get(o.unpricedWhen)?.options.type === 'value'))
        issues.push(`columns: '${column.id}' is unpriced by '${o.unpricedWhen}', which isn't a value column`);
    }
    if (o.type === 'dimension') {
      if ((o.query === undefined) !== (o.joinOn === undefined))
        issues.push(`columns: '${column.id}' needs both 'query' and 'joinOn', or neither`);
      if (o.query !== undefined) read.push(o.query);
      const own = o.joinOn ?? o.dimension;
      if (!options.groupBy.includes(own))
        issues.push(`columns: '${column.id}' reads '${own}', which rows aren't keyed on`);
    }
  }
  issues.push(...unknownQueryIssues(read, queries, 'columns'));
  return issues;
}

type Entry = {
  key: string;
  dimensions: Record<string, unknown>;
  read: (ref: ValueRef) => number | undefined;
  costUnit?: string;
};

const text = (value: unknown) => (value == null ? '' : String(value));
const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);
/** A row's key: its `groupBy` values, kept apart however they're spelled. */
const rowKey = (values: string[]) => JSON.stringify(values);
const keyValues = (key: string): string[] => {
  const parsed: unknown = JSON.parse(key);
  return Array.isArray(parsed) ? parsed.map(text) : [];
};

function entries(answer: DashboardAnswer | undefined, groupBy: readonly string[]): Entry[] {
  const groups = groupsOf(answer);
  if (groups) {
    return groups.map(g => ({
      key: rowKey(groupBy.map(d => text(g.dimensions[d]))),
      dimensions: g.dimensions,
      read: ref => (ref.field === 'estimatedCost' ? (g.estimatedCost ?? undefined) : g.value),
      costUnit: g.costUnit ?? undefined,
    }));
  }
  return (rowsOf(answer)?.rows ?? []).map(r => ({
    key: rowKey(groupBy.map(d => text(r.dimensions?.[d]))),
    dimensions: r.dimensions ?? {},
    read: ref => (ref.measure ? finite(measureOf(r.measures, ref.measure)) : undefined),
  }));
}

export type TableRow = {
  key: string;
  /** The row's `groupBy` values. */
  dimensions: Record<string, string>;
  /** The last `groupBy` value; `''` when the group has none. */
  name: string;
  /** Per value column. */
  values: Record<string, number | undefined>;
  /** Per `usd` column, when the answer names a currency. */
  units: Record<string, string | undefined>;
  /** Per lookup column. */
  lookups: Record<string, string | undefined>;
};

type Answers = ReadonlyMap<string, DashboardAnswer | undefined>;

/** The queries rows come from, in the view's order: those a value column reads. */
export function rowQueries(columns: TableColumn[], queries: readonly DashboardQuery[]) {
  const read = new Set(columns.filter(isValueColumn).flatMap(c => exprRefs(c.options.value).map(r => r.query)));
  return queries.flatMap(q => (q.id !== undefined && read.has(q.id) ? [q.id] : []));
}

function newRow(key: string, groupBy: readonly string[]): TableRow {
  const values = keyValues(key);
  return {
    key,
    dimensions: Object.fromEntries(groupBy.map((d, i) => [d, values[i] ?? ''])),
    name: values[values.length - 1] ?? '',
    values: {},
    units: {},
    lookups: {},
  };
}

/** Each row-query's entries by row key. */
function indexEntries(ids: string[], answers: Answers, groupBy: readonly string[]) {
  return new Map(ids.map(id => [id, new Map(entries(answers.get(id), groupBy).map(e => [e.key, e]))]));
}

const readAt = (indexed: Map<string, Map<string, Entry>>, key: string) => (ref: ValueRef) =>
  indexed.get(ref.query)?.get(key)?.read(ref);

/**
 * The rows: one per group in any query a value column reads, created in the view's query order, then
 * each column's value read from the row's entries. A lookup column fills in by its `joinOn` dimension.
 */
export function buildTableRows(
  options: TableOptions,
  columns: TableColumn[],
  queries: readonly DashboardQuery[],
  answers: Answers,
): TableRow[] {
  const { groupBy } = options;
  const ids = rowQueries(columns, queries);
  const indexed = indexEntries(ids, answers, groupBy);
  const rows = new Map<string, TableRow>();
  for (const id of ids) {
    for (const key of indexed.get(id)?.keys() ?? []) if (!rows.has(key)) rows.set(key, newRow(key, groupBy));
  }

  const lookups = columns.flatMap(c => {
    const o = c.options;
    if (o.type !== 'dimension' || o.query === undefined || o.joinOn === undefined) return [];
    const named = new Map<string, string>();
    for (const entry of entries(answers.get(o.query), groupBy)) {
      const value = text(entry.dimensions[o.dimension]);
      if (value) named.set(text(entry.dimensions[o.joinOn]), value);
    }
    return [{ id: c.id, joinOn: o.joinOn, named }];
  });

  for (const row of rows.values()) {
    const read = readAt(indexed, row.key);
    for (const column of columns.filter(isValueColumn)) {
      const value = evaluate(column.options.value, read);
      row.values[column.id] = value ?? column.options.missing;
      if (column.options.format === 'usd' && value !== undefined) {
        const [ref] = exprRefs(column.options.value);
        row.units[column.id] = ref ? indexed.get(ref.query)?.get(row.key)?.costUnit : undefined;
      }
    }
    for (const lookup of lookups) row.lookups[lookup.id] = lookup.named.get(row.dimensions[lookup.joinOn] ?? '');
  }
  return [...rows.values()];
}

export type PreviousValues = Map<string, Record<string, number | undefined>>;

/** The previous window's values per row key, read the same way. */
export function previousTableValues(
  options: TableOptions,
  columns: TableColumn[],
  queries: readonly DashboardQuery[],
  answers: Answers,
): PreviousValues {
  const ids = rowQueries(columns, queries);
  const indexed = indexEntries(ids, answers, options.groupBy);
  const previous: PreviousValues = new Map();
  for (const id of ids) {
    for (const key of indexed.get(id)?.keys() ?? []) {
      if (previous.has(key)) continue;
      const read = readAt(indexed, key);
      previous.set(
        key,
        Object.fromEntries(columns.filter(isValueColumn).map(c => [c.id, evaluate(c.options.value, read)])),
      );
    }
  }
  return previous;
}

/**
 * The rows to list: unnamed ones left out when asked, and, when the list is whole, a row at zero for
 * each group a total was above 0 for in the previous window but that has no row now.
 */
export function listedRows(
  options: TableOptions,
  columns: TableColumn[],
  built: TableRow[],
  previous: PreviousValues | undefined,
  truncated: boolean,
): TableRow[] {
  const named = (rows: TableRow[]) => (options.hideUnnamed ? rows.filter(r => r.name !== '') : rows);
  if (options.dropped === false || !previous || truncated) return named(built);
  const values = columns.filter(isValueColumn);
  const totals = values.filter(c => c.options.additive);
  const listed = new Set(built.map(r => r.key));
  const dropped: TableRow[] = [];
  for (const [key, before] of previous) {
    if (listed.has(key) || !totals.some(c => (before[c.id] ?? 0) > 0)) continue;
    const row = newRow(key, options.groupBy);
    for (const c of values) {
      row.values[c.id] = c.options.additive && before[c.id] !== undefined ? 0 : c.options.missing;
    }
    dropped.push(row);
  }
  return named([...built, ...dropped]);
}

export type TableContent = {
  rows: TableRow[];
  /** The previous window's values by row key, once they're passed in. */
  before: PreviousValues | undefined;
  truncated: boolean;
  /** The cap the first truncated aggregate hit, when it names one. */
  limit: number | undefined;
};

/**
 * What the table lists once its row queries answer. `current` and `previous` hold one answer per
 * query, in the view's order; leave `previous` out until the previous window has settled.
 */
export function tableContent(
  options: TableOptions,
  columns: TableColumn[],
  queries: readonly DashboardQuery[],
  current: readonly (DashboardAnswer | undefined)[],
  previous: readonly (DashboardAnswer | undefined)[] | undefined,
): TableContent {
  const rowIds = new Set(rowQueries(columns, queries));
  // Only aggregates cap their groups; the first that did names its cap.
  const capped = queries.find(
    (q, i) => q.id !== undefined && rowIds.has(q.id) && rowsOf(current[i])?.truncated === true,
  );
  const truncated = capped !== undefined;
  const built = buildTableRows(options, columns, queries, answersById(queries, current));
  const before = previous && previousTableValues(options, columns, queries, answersById(queries, previous));
  return {
    rows: listedRows(options, columns, built, before, truncated),
    before,
    truncated,
    limit: capped && 'limit' in capped ? capped.limit : undefined,
  };
}

/**
 * Groups whose value in `column` is above zero, once the requests of every query it reads answer.
 * `answers` holds one answer per query, in order.
 */
export function countRows(
  options: TableOptions,
  column: ValueColumn,
  queries: readonly DashboardQuery[],
  answers: readonly (DashboardAnswer | undefined)[],
): OpenerRows {
  if (answers.length < queries.length || answers.some(a => a === undefined)) return 'loading';
  const rows = buildTableRows(options, [column], queries, answersById(queries, answers));
  return rows.filter(r => (r.values[column.id] ?? 0) > 0).length;
}

export type Change = {
  /** Now minus before; unset when there's nothing to compare. */
  delta?: number;
  /** Relative change (0.5 = +50%); for a percent, the difference itself (0.02 = +2 points). */
  change?: number;
  isNew: boolean;
};

/** How a row's value in `column` moved against the previous window. */
export function valueChange(column: ValueColumn, now: number | undefined, before: number | undefined): Change {
  if (now === undefined) return { isNew: false };
  if (before === undefined) return { isNew: column.options.additive === true && now > 0 };
  const delta = now - before;
  const change = column.options.format === 'percent' ? delta : before > 0 ? delta / before : undefined;
  return { delta, change, isNew: false };
}

export function changeTrend(change: Change, column: ValueColumn): 'good' | 'bad' | undefined {
  const { better } = column.options;
  if (!better || change.delta === undefined || change.delta === 0) return undefined;
  return change.delta > 0 === (better === 'higher') ? 'good' : 'bad';
}

export const DASH = '—';

export function formatChange(change: Change, column: ValueColumn) {
  const points = column.options.format === 'percent';
  if (change.isNew) return 'New';
  if (change.change === undefined) return DASH;
  if (change.change === 0) return points ? '0 pt' : '0%';
  const sign = change.change > 0 ? '+' : '−';
  const size = Math.abs(change.change);
  if (!points) return `${sign}${formatPercent(size)}`;
  // Under 0.05 points rounds to "+0.0 pt", which reads as no change.
  return size < 0.0005 ? `${sign}<0.1 pt` : `${sign}${(size * 100).toFixed(1)} pt`;
}

/** A value in its column's format; dollars unless the answer names another currency. */
export function formatValue(column: ValueColumn, value: number, unit: string | undefined) {
  switch (column.options.format) {
    case 'usd':
      return unit && unit.toUpperCase() !== 'USD' ? `${formatCount(value)} ${unit}` : formatUsd(value);
    case 'duration':
      return formatDuration(value);
    case 'percent':
      return formatPercent(value);
    default:
      return formatCount(value);
  }
}

/** What a row click adds: its dimensions as drilldown fields; an entity name as a span filter when asked. */
export function rowDrilldown(options: TableOptions, row: TableRow): DrilldownScope {
  const drill = options.rowDrilldown;
  if (!drill) return {};
  const nameDimension = options.groupBy[options.groupBy.length - 1];
  const scope: Record<string, unknown> = {};
  for (const [dimension, field] of Object.entries(drill.fields)) {
    const value = row.dimensions[dimension] ?? '';
    if (!value && !(drill.keepEmpty && dimension === nameDimension)) continue;
    if (field === 'entityName' && drill.spanTypes) scope.span = { spanTypes: drill.spanTypes, entityName: value };
    else scope[field] = value;
  }
  return scope;
}

/** The opener view's row count: still loading, not countable (a page filter blocks it, or its sort column reads no query), or counted. */
export type OpenerRows = number | 'loading' | 'uncountable';

/**
 * The view a table opens on. Without an `openWhen` view, the first. The `openWhen` view opens while
 * its rows load, so the tabs don't jump, and once it has `minRows` of them; it's passed over when it
 * can't count them or has too few.
 */
export function openingView(views: readonly { options: TableOptions }[], rows: OpenerRows): number {
  const opener = views.findIndex(v => v.options.openWhen);
  if (opener < 0) return 0;
  // Passed over, it opens on the view after it, or the first when it's last.
  const next = (opener + 1) % views.length;
  if (rows === 'uncountable') return next;
  if (rows === 'loading') return opener;
  const minRows = views[opener]?.options.openWhen?.minRows ?? 0;
  return rows >= minRows ? opener : next;
}
