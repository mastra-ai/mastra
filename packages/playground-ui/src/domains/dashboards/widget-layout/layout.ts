import { DASHBOARD_WIDGET_SPANS } from '@mastra/core/storage/dashboards';
import type { DashboardSpan } from '../components/dashboard-grid';

/** Every row fills the 12 columns: one widget spans 12, several share 12 between them. */
export const LAYOUT_COLUMNS = 12;
/** The narrowest a widget can get, so a row holds at most six widgets. */
export const MIN_SPAN = 2 satisfies DashboardSpan;
export const MAX_ROW_WIDGETS = LAYOUT_COLUMNS / MIN_SPAN;
/** The widths the layout hands out: the ones a dashboard stores, from `MIN_SPAN` up. */
export const LAYOUT_SPANS = DASHBOARD_WIDGET_SPANS.filter(span => span >= MIN_SPAN);

export type WidgetLayoutItem = { id: string; span: DashboardSpan };
export type WidgetLayoutRow = { widgets: WidgetLayoutItem[] };

/**
 * Where a dragged widget lands: on a new row before `rows[rowIndex]` (`rows.length` appends one),
 * or in `rows[rowIndex]` before `widgets[index]` (`widgets.length` appends to the row).
 */
export type WidgetDropTarget = { type: 'row'; rowIndex: number } | { type: 'slot'; rowIndex: number; index: number };

function replaceRow(rows: WidgetLayoutRow[], rowIndex: number, widgets: WidgetLayoutItem[]): WidgetLayoutRow[] {
  return rows.map((row, i) => (i === rowIndex ? { ...row, widgets } : row));
}

function locate(rows: WidgetLayoutRow[], widgetId: string) {
  for (const [rowIndex, row] of rows.entries()) {
    const index = row.widgets.findIndex(w => w.id === widgetId);
    const widget = row.widgets[index];
    if (widget) return { rowIndex, index, row, widget };
  }
  return undefined;
}

/** Every way, in order, for `count` widgets to fill `columns` with layout spans. */
function rowSplits(count: number, columns: number = LAYOUT_COLUMNS): DashboardSpan[][] {
  if (count === 0) return columns === 0 ? [[]] : [];
  return LAYOUT_SPANS.filter(span => span <= columns).flatMap(span =>
    rowSplits(count - 1, columns - span).map(rest => [span, ...rest]),
  );
}

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Orders costs by their first criterion, then the next one on a tie. */
function compareCosts(a: number[], b: number[]) {
  for (const [i, value] of a.entries()) {
    const other = b[i] ?? 0;
    if (value !== other) return value - other;
  }
  return 0;
}

/** Picks the option with the lowest cost; the first one wins a tie. */
function cheapest<T>(options: T[], cost: (option: T) => number[]): T | undefined {
  let best: { option: T; cost: number[] } | undefined;
  for (const option of options) {
    const next = { option, cost: cost(option) };
    if (!best || compareCosts(next.cost, best.cost) < 0) best = next;
  }
  return best?.option;
}

/**
 * Gives `widgets` the spans that fill the row while changing their current ones the least. On a
 * tie, widgets closer to where the row changed (by `distance`) give way first, then those on the left.
 * Returns `undefined` when no split fits that many widgets into `columns`.
 */
function fitRow(
  widgets: WidgetLayoutItem[],
  distance: (index: number) => number,
  columns: number = LAYOUT_COLUMNS,
): WidgetLayoutItem[] | undefined {
  const split = cheapest(rowSplits(widgets.length, columns), split => {
    const changes = widgets.map((w, i) => Math.abs((split[i] ?? 0) - w.span));
    return [sum(changes), sum(changes.map((c, i) => c * distance(i))), sum(changes.map((c, i) => c * i))];
  });
  return split && widgets.map((w, i) => ({ ...w, span: split[i] ?? w.span }));
}

/** Whether a new widget fits at `target`: a new row always does; a row while it has fewer than six widgets. */
export function canInsertAt(rows: WidgetLayoutRow[], target: WidgetDropTarget) {
  if (target.type === 'row') return true;
  const row = rows[target.rowIndex];
  return row !== undefined && row.widgets.length < MAX_ROW_WIDGETS;
}

/**
 * Inserts a widget at `target`. On a new row it spans the whole row; in a row it starts at
 * `MIN_SPAN` and the row is refitted, taking columns from its closest siblings first.
 * Returns `undefined` when the row has no room left.
 */
export function insertWidget(
  rows: WidgetLayoutRow[],
  widgetId: string,
  target: WidgetDropTarget,
): WidgetLayoutRow[] | undefined {
  if (target.type === 'row') {
    const next = [...rows];
    next.splice(target.rowIndex, 0, { widgets: [{ id: widgetId, span: LAYOUT_COLUMNS }] });
    return next;
  }
  const row = rows[target.rowIndex];
  if (!row || row.widgets.length >= MAX_ROW_WIDGETS) return undefined;

  const widgets = [...row.widgets];
  widgets.splice(target.index, 0, { id: widgetId, span: MIN_SPAN });
  const fitted = fitRow(widgets, i => Math.abs(i - target.index));
  return fitted && replaceRow(rows, target.rowIndex, fitted);
}

/** Removes a widget; the row is refitted, its closest siblings taking the columns, and an emptied row goes away. */
export function removeWidget(rows: WidgetLayoutRow[], widgetId: string): WidgetLayoutRow[] {
  const at = locate(rows, widgetId);
  if (!at) return rows;
  if (at.row.widgets.length === 1) return rows.filter((_, i) => i !== at.rowIndex);

  const widgets = at.row.widgets.filter(w => w.id !== widgetId);
  const fitted = fitRow(widgets, i => (i < at.index ? at.index - i : i - at.index + 1));
  return replaceRow(rows, at.rowIndex, fitted ?? widgets);
}

/**
 * Moves a widget to `target`. Within its own row it only changes places and keeps every span;
 * to another row it leaves its columns to its siblings and is inserted as a new widget would be.
 * Returns `undefined` when the drop changes nothing or the target row has no room.
 */
export function moveWidget(
  rows: WidgetLayoutRow[],
  widgetId: string,
  target: WidgetDropTarget,
): WidgetLayoutRow[] | undefined {
  const from = locate(rows, widgetId);
  if (!from) return undefined;
  const sourceRow = from.row;

  if (target.type === 'slot' && target.rowIndex === from.rowIndex) {
    const to = target.index > from.index ? target.index - 1 : target.index;
    if (to === from.index) return undefined;
    const widgets = sourceRow.widgets.filter(w => w.id !== widgetId);
    widgets.splice(to, 0, from.widget);
    return replaceRow(rows, from.rowIndex, widgets);
  }

  const leavesEmptyRow = sourceRow.widgets.length === 1;
  const besideOwnRow = target.rowIndex === from.rowIndex || target.rowIndex === from.rowIndex + 1;
  if (target.type === 'row' && leavesEmptyRow && besideOwnRow) return undefined;

  const rowIndex = leavesEmptyRow && target.rowIndex > from.rowIndex ? target.rowIndex - 1 : target.rowIndex;
  return insertWidget(removeWidget(rows, widgetId), widgetId, { ...target, rowIndex });
}

/**
 * The spans `widgets[leftIndex]` can take by moving the boundary on its right, narrowest first:
 * the widgets before it keep theirs, the ones after it must still fill the rest of the row.
 */
export function resizeOptions(widgets: WidgetLayoutItem[], leftIndex: number): DashboardSpan[] {
  const before = sum(widgets.slice(0, leftIndex).map(w => w.span));
  const after = widgets.length - leftIndex - 1;
  if (after < 1) return [];
  return LAYOUT_SPANS.filter(span => rowSplits(after, LAYOUT_COLUMNS - before - span).length > 0);
}

/**
 * Moves the boundary after `widgets[leftIndex]` so that widget takes the option closest to
 * `leftSpan` (its current span on a tie). Widgets before it keep their spans; the ones after it
 * share what is left, the closest giving or taking columns first.
 * Returns `undefined` when the spans don't change.
 */
export function resizeWidgets(
  rows: WidgetLayoutRow[],
  rowIndex: number,
  leftIndex: number,
  leftSpan: number,
): WidgetLayoutRow[] | undefined {
  const widgets = rows[rowIndex]?.widgets;
  const left = widgets?.[leftIndex];
  if (!widgets || !left) return undefined;

  const span = cheapest(resizeOptions(widgets, leftIndex), option => [
    Math.abs(option - leftSpan),
    Math.abs(option - left.span),
  ]);
  if (span === undefined || span === left.span) return undefined;

  const before = widgets.slice(0, leftIndex);
  const rest = LAYOUT_COLUMNS - sum(before.map(w => w.span)) - span;
  const after = fitRow(widgets.slice(leftIndex + 1), i => i, rest);
  return after && replaceRow(rows, rowIndex, [...before, { ...left, span }, ...after]);
}
