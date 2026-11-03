/** Every row fills the 12 columns: one widget spans 12, several share 12 between them. */
export const LAYOUT_COLUMNS = 12;
/** The narrowest a widget can get, so a row holds at most six widgets. */
export const MIN_SPAN = 2;

export type WidgetLayoutItem = { id: string; span: number };
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

/** Columns the row can give up without any widget going below `MIN_SPAN`. */
function spareColumns(row: WidgetLayoutRow) {
  return row.widgets.reduce((sum, w) => sum + w.span - MIN_SPAN, 0);
}

/** Whether a new widget fits at `target`: a new row always does; a row needs `MIN_SPAN` spare columns. */
export function canInsertAt(rows: WidgetLayoutRow[], target: WidgetDropTarget) {
  if (target.type === 'row') return true;
  const row = rows[target.rowIndex];
  return row !== undefined && spareColumns(row) >= MIN_SPAN;
}

/**
 * Inserts a widget at `target`. On a new row it spans the whole row; in a row it takes `MIN_SPAN`
 * columns from its closest siblings, the wider one first when two are as close.
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
  if (!row || spareColumns(row) < MIN_SPAN) return undefined;

  const widgets = row.widgets.map(w => ({ ...w }));
  let needed = MIN_SPAN;
  for (let distance = 0; needed > 0; distance++) {
    const left = widgets[target.index - 1 - distance];
    const right = widgets[target.index + distance];
    const closest = [left, right].filter(w => w !== undefined).sort((a, b) => b.span - a.span);
    for (const sibling of closest) {
      const taken = Math.min(needed, sibling.span - MIN_SPAN);
      sibling.span -= taken;
      needed -= taken;
    }
  }
  widgets.splice(target.index, 0, { id: widgetId, span: MIN_SPAN });
  return replaceRow(rows, target.rowIndex, widgets);
}

/** Removes a widget; its columns go to its left sibling (right when first), and an emptied row goes away. */
export function removeWidget(rows: WidgetLayoutRow[], widgetId: string): WidgetLayoutRow[] {
  const at = locate(rows, widgetId);
  if (!at) return rows;
  const { row, widget: removed } = at;
  if (row.widgets.length === 1) return rows.filter((_, i) => i !== at.rowIndex);

  const heir = at.index > 0 ? at.index - 1 : 1;
  const widgets = row.widgets
    .map((w, i) => (i === heir ? { ...w, span: w.span + removed.span } : w))
    .filter(w => w.id !== widgetId);
  return replaceRow(rows, at.rowIndex, widgets);
}

/**
 * Moves a widget to `target`. Within its own row it only changes places and keeps every span;
 * to another row it leaves its columns to a sibling and is inserted as a new widget would be.
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
 * Moves the boundary between `widgets[leftIndex]` and the widget after it so the left one spans
 * `leftSpan`; the right one gets the rest of their columns, neither going below `MIN_SPAN`.
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
  const right = widgets?.[leftIndex + 1];
  if (!widgets || !left || !right) return undefined;

  const pair = left.span + right.span;
  const span = Math.min(Math.max(leftSpan, MIN_SPAN), pair - MIN_SPAN);
  if (span === left.span) return undefined;
  return replaceRow(
    rows,
    rowIndex,
    widgets.map((w, i) => (i === leftIndex ? { ...w, span } : i === leftIndex + 1 ? { ...w, span: pair - span } : w)),
  );
}
