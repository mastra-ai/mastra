import { DASHBOARD_WIDGET_SPANS } from '@mastra/core/storage/dashboards';
import { describe, expect, it } from 'vitest';
import { canInsertAt, insertWidget, moveWidget, removeWidget, resizeOptions, resizeWidgets } from './layout';
import type { WidgetLayoutRow } from './layout';

/** `'a:6 b:6 | c:12'` → two rows. Keeps the cases readable as the grid a user sees. */
function grid(source: string): WidgetLayoutRow[] {
  return source.split('|').map(row => ({
    widgets: row
      .trim()
      .split(/\s+/)
      .map(cell => {
        const [id, raw] = cell.split(':');
        const span = DASHBOARD_WIDGET_SPANS.find(s => s === Number(raw));
        if (!span) throw new Error(`${raw} is not a dashboard span`);
        return { id, span };
      }),
  }));
}

function show(rows: WidgetLayoutRow[] | undefined) {
  return rows?.map(r => r.widgets.map(w => `${w.id}:${w.span}`).join(' ')).join(' | ');
}

/** Every row fills 12 columns and every widget has a span a dashboard can store. */
function expectStorable(rows: WidgetLayoutRow[] | undefined) {
  expect(rows).toBeDefined();
  for (const row of rows ?? []) {
    expect(row.widgets.reduce((sum, w) => sum + w.span, 0)).toBe(12);
    for (const w of row.widgets) expect(DASHBOARD_WIDGET_SPANS).toContain(w.span);
  }
}

const SHAPES = ['a:12', 'a:6 b:6', 'a:4 b:4 c:4', 'a:6 b:3 c:3', 'a:4 b:4 c:2 d:2', 'a:3 b:3 c:2 d:2 e:2'];
const idsOf = (shape: string) => shape.split(' ').map(cell => cell.split(':')[0] ?? '');

describe('insertWidget', () => {
  it('drops a new widget on its own full-width row above, between or below rows', () => {
    const rows = grid('a:6 b:6 | c:12');
    expect(show(insertWidget(rows, 'n', { type: 'row', rowIndex: 0 }))).toBe('n:12 | a:6 b:6 | c:12');
    expect(show(insertWidget(rows, 'n', { type: 'row', rowIndex: 1 }))).toBe('a:6 b:6 | n:12 | c:12');
    expect(show(insertWidget(rows, 'n', { type: 'row', rowIndex: 2 }))).toBe('a:6 b:6 | c:12 | n:12');
  });

  it('halves the only widget of a row, as two widgets can only share 12 as 6 + 6', () => {
    const rows = grid('c:12');
    expect(show(insertWidget(rows, 'n', { type: 'slot', rowIndex: 0, index: 0 }))).toBe('n:6 c:6');
    expect(show(insertWidget(rows, 'n', { type: 'slot', rowIndex: 0, index: 1 }))).toBe('c:6 n:6');
  });

  it('takes 2 columns from a neighbour, the left one when both could give them', () => {
    expect(show(insertWidget(grid('a:6 b:6'), 'n', { type: 'slot', rowIndex: 0, index: 1 }))).toBe('a:4 n:2 b:6');
    expect(show(insertWidget(grid('a:4 b:4 c:4'), 'n', { type: 'slot', rowIndex: 0, index: 3 }))).toBe(
      'a:4 b:4 c:2 n:2',
    );
  });

  it('prefers the nearest widget that can give columns, reaching past one already at the minimum', () => {
    expect(show(insertWidget(grid('a:6 b:3 c:3'), 'n', { type: 'slot', rowIndex: 0, index: 1 }))).toBe(
      'a:4 n:2 b:3 c:3',
    );
    expect(show(insertWidget(grid('a:2 b:4 c:6'), 'n', { type: 'slot', rowIndex: 0, index: 0 }))).toBe(
      'n:2 a:2 b:2 c:6',
    );
  });

  it('refuses a row that already holds six widgets', () => {
    const full = grid('a:2 b:2 c:2 d:2 e:2 f:2');
    expect(canInsertAt(full, { type: 'slot', rowIndex: 0, index: 3 })).toBe(false);
    expect(insertWidget(full, 'n', { type: 'slot', rowIndex: 0, index: 3 })).toBeUndefined();
    expect(canInsertAt(full, { type: 'row', rowIndex: 1 })).toBe(true);
  });

  it('only ever produces full rows of storable spans', () => {
    for (const shape of SHAPES) {
      for (let index = 0; index <= idsOf(shape).length; index++) {
        expectStorable(insertWidget(grid(shape), 'n', { type: 'slot', rowIndex: 0, index }));
      }
    }
  });
});

describe('removeWidget', () => {
  it('gives the removed columns to the closest sibling, the left one first', () => {
    expect(show(removeWidget(grid('a:4 b:2 c:6'), 'b'))).toBe('a:6 c:6');
    expect(show(removeWidget(grid('a:4 b:2 c:6'), 'a'))).toBe('b:6 c:6');
    expect(show(removeWidget(grid('a:4 b:4 c:2 d:2'), 'a'))).toBe('b:6 c:4 d:2');
  });

  it('drops a row once its last widget is gone', () => {
    expect(show(removeWidget(grid('a:6 b:6 | c:12'), 'c'))).toBe('a:6 b:6');
  });

  it('only ever leaves full rows of storable spans', () => {
    for (const shape of SHAPES) {
      for (const id of idsOf(shape)) expectStorable(removeWidget(grid(shape), id));
    }
  });
});

describe('moveWidget', () => {
  it('reorders a row without changing anyone’s width', () => {
    const rows = grid('a:3 b:3 c:6');
    expect(show(moveWidget(rows, 'c', { type: 'slot', rowIndex: 0, index: 0 }))).toBe('c:6 a:3 b:3');
    expect(show(moveWidget(rows, 'a', { type: 'slot', rowIndex: 0, index: 3 }))).toBe('b:3 c:6 a:3');
  });

  it('ignores drops right next to where the widget already is', () => {
    const rows = grid('a:6 b:6 | c:12');
    expect(moveWidget(rows, 'a', { type: 'slot', rowIndex: 0, index: 0 })).toBeUndefined();
    expect(moveWidget(rows, 'a', { type: 'slot', rowIndex: 0, index: 1 })).toBeUndefined();
    expect(moveWidget(rows, 'c', { type: 'row', rowIndex: 1 })).toBeUndefined();
    expect(moveWidget(rows, 'c', { type: 'row', rowIndex: 2 })).toBeUndefined();
    expect(moveWidget(rows, 'c', { type: 'slot', rowIndex: 1, index: 1 })).toBeUndefined();
  });

  it('pulls a widget out to its own row and gives its columns back to the sibling it leaves', () => {
    const rows = grid('a:6 b:6 | c:12');
    expect(show(moveWidget(rows, 'b', { type: 'row', rowIndex: 2 }))).toBe('a:12 | c:12 | b:12');
    expect(show(moveWidget(rows, 'a', { type: 'row', rowIndex: 0 }))).toBe('a:12 | b:12 | c:12');
  });

  it('moves a lone widget into another row, which removes its old row', () => {
    const rows = grid('a:6 b:6 | c:12');
    expect(show(moveWidget(rows, 'c', { type: 'slot', rowIndex: 0, index: 1 }))).toBe('a:4 c:2 b:6');
    expect(show(moveWidget(grid('c:12 | a:6 b:6'), 'c', { type: 'slot', rowIndex: 1, index: 2 }))).toBe('a:6 b:4 c:2');
  });

  it('refuses another row that is already full', () => {
    const rows = grid('a:2 b:2 c:2 d:2 e:2 f:2 | g:12');
    expect(moveWidget(rows, 'g', { type: 'slot', rowIndex: 0, index: 0 })).toBeUndefined();
    expect(show(moveWidget(rows, 'a', { type: 'slot', rowIndex: 1, index: 0 }))).toBe('b:4 c:2 d:2 e:2 f:2 | a:6 g:6');
  });
});

describe('resizeWidgets', () => {
  it('moving the handle left shrinks the left widget and grows the right one, and the other way round', () => {
    const rows = grid('a:4 b:4 c:4');
    expect(show(resizeWidgets(rows, 0, 0, 2))).toBe('a:2 b:6 c:4');
    expect(show(resizeWidgets(rows, 0, 0, 6))).toBe('a:6 b:2 c:4');
    expect(show(resizeWidgets(rows, 0, 1, 6))).toBe('a:4 b:6 c:2');
  });

  it('lets every widget after the boundary give or take columns, so more boundaries can move', () => {
    const rows = grid('a:6 b:3 c:3');
    expect(resizeOptions(rows[0]?.widgets ?? [], 0)).toEqual([2, 3, 4, 6]);
    expect(show(resizeWidgets(rows, 0, 0, 4))).toBe('a:4 b:4 c:4');
    expect(show(resizeWidgets(rows, 0, 0, 2))).toBe('a:2 b:6 c:4');
  });

  it('keeps the widgets before the boundary as they are', () => {
    expect(show(resizeWidgets(grid('a:6 b:3 c:3'), 0, 1, 2))).toBe('a:6 b:2 c:4');
    expect(show(resizeWidgets(grid('a:2 b:4 c:6'), 0, 1, 6))).toBe('a:2 b:6 c:4');
  });

  it('snaps to the nearest storable span, staying put on a tie', () => {
    const rows = grid('a:6 b:3 c:3');
    expect(resizeWidgets(rows, 0, 0, 5)).toBeUndefined();
    expect(show(resizeWidgets(rows, 0, 0, 3.4))).toBe('a:3 b:6 c:3');
  });

  it('stops at the minimum width on both sides', () => {
    const rows = grid('a:4 b:4 c:4');
    expect(show(resizeWidgets(rows, 0, 0, 0))).toBe('a:2 b:6 c:4');
    expect(show(resizeWidgets(rows, 0, 0, 12))).toBe('a:6 b:2 c:4');
    expect(resizeWidgets(grid('a:2 b:6 c:4'), 0, 0, 1)).toBeUndefined();
  });

  it('cannot resize two widgets alone in a row, since 6 + 6 is their only split', () => {
    expect(resizeOptions(grid('a:6 b:6')[0]?.widgets ?? [], 0)).toEqual([6]);
    expect(resizeOptions(grid('a:6 b:6')[0]?.widgets ?? [], 1)).toEqual([]);
    expect(resizeWidgets(grid('a:6 b:6'), 0, 0, 4)).toBeUndefined();
  });

  it('only ever produces full rows of storable spans', () => {
    for (const shape of SHAPES) {
      for (let leftIndex = 0; leftIndex < idsOf(shape).length - 1; leftIndex++) {
        for (let span = 0; span <= 12; span++) {
          const next = resizeWidgets(grid(shape), 0, leftIndex, span);
          if (next) expectStorable(next);
        }
      }
    }
  });
});
