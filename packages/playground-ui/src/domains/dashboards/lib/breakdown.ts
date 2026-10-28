import type { DashboardColumn, DashboardQuery } from '@mastra/client-js';
import { z } from 'zod/v4';
import type { DrilldownScope } from '../../metrics/drilldown';
import type { BreakdownRow, PreviousFigures } from '../../metrics/lib/breakdown';
import { withDropped } from '../../metrics/lib/breakdown';
import { queryRefSchema } from './values';

/**
 * The `breakdown` kind: one row per group, joined across the view's queries on `groupBy`. Columns come
 * from a fixed vocabulary, each naming the query (and measure, field or dimension) it reads.
 */

export const BREAKDOWN_COLUMN_IDS = ['project', 'resource', 'errorRate', 'p95', 'tokens', 'cost', 'count'] as const;
export type BreakdownColumnId = (typeof BREAKDOWN_COLUMN_IDS)[number];

const columnOptionsSchema = z.strictObject({
  /** Id of the query the column reads; unset for `project`, which reads the row's own key. */
  query: queryRefSchema.optional(),
  /** A trace or span aggregate measure, e.g. `countDistinct.traceId`. */
  measure: z.string().min(1).optional(),
  /** A metrics breakdown group's `value` or `estimatedCost`. */
  field: z.enum(['value', 'estimatedCost']).optional(),
  /** A dimension of the query's rows: `projectId`, or a lookup's answer (`resourceId`). */
  dimension: z.string().min(1).optional(),
  /** For a lookup: the query's dimension matching the row's name, e.g. `threadId`. */
  joinOn: z.string().min(1).optional(),
  /** What the count column counts, for its tooltip. */
  unit: z.enum(['traces', 'spans']).optional(),
});

export type BreakdownColumnOptions = z.infer<typeof columnOptionsSchema>;
export type BreakdownColumn = { id: BreakdownColumnId; label?: string; options: BreakdownColumnOptions };

export const breakdownOptionsSchema = z.strictObject({
  /** The dimensions a row is keyed on; the last one names the row. */
  groupBy: z.array(z.string().min(1)).min(1),
  /** `project` labels rows with the page's project name for their key. */
  rowLabel: z.enum(['name', 'project']).optional(),
  /** What a row without a name reads as. */
  unnamed: z.string().optional(),
  /** Leaves out rows without a name. */
  hideUnnamed: z.boolean().optional(),
  /** Lists groups that had activity last window but none now, at zero. Defaults to on. */
  dropped: z.boolean().optional(),
  /** What a row click adds to the drilldown: the row's spans, or its name as a filter field. */
  rowScope: z
    .union([
      z.strictObject({ spanTypes: z.array(z.string().min(1)).min(1) }),
      z.strictObject({ field: z.enum(['environment', 'threadId', 'model']), keepEmpty: z.boolean().optional() }),
    ])
    .optional(),
  emptyMessage: z.string(),
  /** Opens on this view only when its count query has two or more rows; otherwise on the next. */
  openWhen: z.literal('twoOrMoreRows').optional(),
});

export type BreakdownOptions = z.infer<typeof breakdownOptionsSchema>;

/** The view's columns, checked against the vocabulary; `issues` reports what doesn't parse. */
export function parseColumns(columns: DashboardColumn[] | undefined): { columns: BreakdownColumn[]; issues: string[] } {
  const parsed: BreakdownColumn[] = [];
  const issues: string[] = [];
  for (const [i, column] of (columns ?? []).entries()) {
    if (!(BREAKDOWN_COLUMN_IDS as readonly string[]).includes(column.id)) {
      issues.push(`columns.${i}: unknown column '${column.id}'`);
      continue;
    }
    const options = columnOptionsSchema.safeParse(column.options ?? {});
    if (!options.success) {
      issues.push(`columns.${i}.options: ${options.error.issues[0]?.message ?? 'invalid'}`);
      continue;
    }
    parsed.push({
      id: column.id as BreakdownColumnId,
      ...(column.label === undefined ? {} : { label: column.label }),
      options: options.data,
    });
  }
  return { columns: parsed, issues };
}

/** What the schema can't say: a count column, query ids the view has, and Errors with P95. */
export function breakdownIssues(columns: DashboardColumn[] | undefined, queries: DashboardQuery[]): string[] {
  const parsed = parseColumns(columns);
  const issues = [...parsed.issues];
  const ids = new Set(parsed.columns.map(c => c.id));
  if (!ids.has('count')) issues.push(`columns: a breakdown needs a 'count' column`);
  if (ids.has('errorRate') !== ids.has('p95')) issues.push(`columns: 'errorRate' and 'p95' come together`);
  if (ids.has('tokens') !== ids.has('cost')) issues.push(`columns: 'tokens' and 'cost' come together`);
  for (const column of parsed.columns) {
    const { query } = column.options;
    if (column.id !== 'project' && query === undefined) issues.push(`columns: '${column.id}' needs a query`);
    if (query !== undefined && !queries.some(q => q.id === query))
      issues.push(`columns: '${column.id}' reads query '${query}', which the view doesn't have`);
  }
  return issues;
}

type AggregateRow = { dimensions?: Record<string, unknown> | null; measures: Record<string, unknown> };
type BreakdownGroup = {
  dimensions: Record<string, unknown>;
  value: number;
  estimatedCost?: number | null;
  costUnit?: string | null;
};
/** A trace or span aggregate's answer, or a metrics breakdown's. */
export type BreakdownResponse = { rows: AggregateRow[]; truncated?: boolean } | { groups: BreakdownGroup[] };

const text = (value: unknown) => (value == null ? '' : String(value));
/** A row's key: its `groupBy` values, kept apart however they're spelled. */
const rowKey = (values: string[]) => JSON.stringify(values);
const keyValues = (key: string) => JSON.parse(key) as string[];
const finite = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/** One response's rows as key, dimensions and readings. */
function entries(response: BreakdownResponse | undefined, groupBy: readonly string[]) {
  if (!response) return [];
  if ('groups' in response) {
    return response.groups.map(g => ({
      key: rowKey(groupBy.map(d => text(g.dimensions[d]))),
      dimensions: g.dimensions,
      read: (o: BreakdownColumnOptions) =>
        o.field === 'estimatedCost' ? (g.estimatedCost ?? undefined) : o.field === 'value' ? g.value : undefined,
      costUnit: g.costUnit ?? undefined,
    }));
  }
  return response.rows.map(r => ({
    key: rowKey(groupBy.map(d => text(r.dimensions?.[d]))),
    dimensions: r.dimensions ?? {},
    read: (o: BreakdownColumnOptions) => (o.measure ? finite(r.measures[o.measure]) : undefined),
    costUnit: undefined,
  }));
}

/** Columns that hold a figure, in the order rows take them: count first, then errors, then usage. */
const FIGURES = ['count', 'errorRate', 'p95', 'tokens', 'cost'] as const;
type Figure = (typeof FIGURES)[number];

const figureColumns = (columns: BreakdownColumn[]) =>
  FIGURES.flatMap(id => columns.filter(c => c.id === id)) as (BreakdownColumn & { id: Figure })[];

/** Ids of the queries the figures come from; the table waits on these, and not on lookups. */
export const figureQueries = (columns: BreakdownColumn[]) => [
  ...new Set(figureColumns(columns).flatMap(c => (c.options.query === undefined ? [] : [c.options.query]))),
];

/**
 * The rows, joined on `groupBy` across the queries the figure columns read, in the order the
 * Breakdown card builds them. A lookup column (`resource`) fills in by the row's name.
 */
export function buildTableRows(
  options: BreakdownOptions,
  columns: BreakdownColumn[],
  responses: ReadonlyMap<string, BreakdownResponse | undefined>,
): BreakdownRow[] {
  const { groupBy } = options;
  const rows = new Map<string, BreakdownRow>();
  const projectAt = groupBy.indexOf('projectId');
  const usage = columns.some(c => c.id === 'tokens');
  const rowFor = (key: string) => {
    let row = rows.get(key);
    if (!row) {
      const values = keyValues(key);
      row = {
        key,
        ...(projectAt >= 0 ? { projectId: values[projectAt] ?? '' } : {}),
        name: values[values.length - 1] ?? '',
        count: 0,
        ...(usage ? { tokens: 0 } : {}),
      };
      rows.set(key, row);
    }
    return row;
  };

  // A query feeds several columns (count, errors and P95 come from one aggregate): visit each once,
  // in the order of its first column, so rows are created in the card's order.
  const byQuery = new Map<string, (BreakdownColumn & { id: Figure })[]>();
  for (const column of figureColumns(columns)) {
    const query = column.options.query;
    if (query === undefined) continue;
    byQuery.set(query, [...(byQuery.get(query) ?? []), column]);
  }
  for (const [query, feeds] of byQuery) {
    for (const entry of entries(responses.get(query), groupBy)) {
      const row = rowFor(entry.key);
      for (const column of feeds) {
        const value = entry.read(column.options);
        if (column.id === 'count') row.count = value ?? 0;
        else if (column.id === 'cost') {
          row.cost = value;
          row.costUnit = value === undefined ? undefined : entry.costUnit;
        } else row[column.id] = value;
      }
    }
  }

  const lookup = columns.find(c => c.id === 'resource');
  if (lookup?.options.query !== undefined && lookup.options.dimension && lookup.options.joinOn) {
    const named = new Map<string, string>();
    for (const entry of entries(responses.get(lookup.options.query), groupBy)) {
      const value = text(entry.dimensions[lookup.options.dimension]);
      if (value) named.set(text(entry.dimensions[lookup.options.joinOn]), value);
    }
    for (const row of rows.values()) {
      const resource = named.get(row.name);
      if (resource) row.resource = resource;
    }
  }
  return [...rows.values()];
}

/** The previous window's figures per row key, from the same columns. */
export function previousTableFigures(
  options: BreakdownOptions,
  columns: BreakdownColumn[],
  responses: ReadonlyMap<string, BreakdownResponse | undefined>,
): Map<string, PreviousFigures> {
  const figures = new Map<string, PreviousFigures>();
  for (const column of figureColumns(columns)) {
    const query = column.options.query;
    if (query === undefined) continue;
    for (const entry of entries(responses.get(query), options.groupBy)) {
      let f = figures.get(entry.key);
      if (!f) figures.set(entry.key, (f = {}));
      const value = entry.read(column.options);
      f[column.id] = column.id === 'count' ? (value ?? 0) : value;
    }
  }
  return figures;
}

/** The rows to list: unnamed ones left out when asked, dropped ones added when the list is whole. */
export function listedRows(
  options: BreakdownOptions,
  built: BreakdownRow[],
  previous: Map<string, PreviousFigures> | undefined,
  truncated: boolean,
  usage: boolean,
) {
  const rows = options.hideUnnamed ? built.filter(r => r.name !== '') : built;
  if (options.dropped === false || !previous || truncated) return rows;
  return withDropped(rows, previous, options.groupBy, usage, keyValues);
}

/** A row's drilldown: its project, then its spans or its name. */
export function rowDrilldown(options: BreakdownOptions, row: BreakdownRow): DrilldownScope {
  const project = row.projectId ? { projectId: row.projectId } : {};
  const scope = options.rowScope;
  if (!scope) return project;
  if ('spanTypes' in scope) return { ...project, span: { spanTypes: scope.spanTypes, entityName: row.name } };
  return row.name || scope.keepEmpty ? { ...project, [scope.field]: row.name } : project;
}

/** A row's label: its project's name, its own, or what an unnamed row reads as. */
export function tableRowLabel(options: BreakdownOptions, row: BreakdownRow, projectLabel?: (id: string) => string) {
  if (options.rowLabel === 'project') return projectLabel?.(row.name) ?? row.name;
  return row.name || (options.unnamed ?? 'Unnamed');
}
