import { describe, expect, it } from 'vitest';
import { canInsertAt, insertWidget, moveWidget, removeWidget, resizeWidgets } from './layout';
import type { WidgetLayoutRow } from './layout';

/** `'a:6 b:6 | c:12'` → two rows. Keeps the cases readable as the grid a user sees. */
function grid(source: string): WidgetLayoutRow[] {
  return source.split('|').map(row => ({
    widgets: row
      .trim()
      .split(/\s+/)
      .map(cell => {
        const [id, span] = cell.split(':');
        return { id, span: Number(span) };
      }),
  }));
}

function show(rows: WidgetLayoutRow[] | undefined) {
  return rows?.map(r => r.widgets.map(w => `${w.id}:${w.span}`).join(' ')).join(' | ');
}

function rowTotals(rows: WidgetLayoutRow[] | undefined) {
  return rows?.map(r => r.widgets.reduce((sum, w) => sum + w.span, 0));
}

describe('insertWidget', () => {
  it('drops a new widget on its own full-width row above, between or below rows', () => {
    const rows = grid('a:6 b:6 | c:12');
    expect(show(insertWidget(rows, 'n', { type: 'row', rowIndex: 0 }))).toBe('n:12 | a:6 b:6 | c:12');
    expect(show(insertWidget(rows, 'n', { type: 'row', rowIndex: 1 }))).toBe('a:6 b:6 | n:12 | c:12');
    expect(show(insertWidget(rows, 'n', { type: 'row', rowIndex: 2 }))).toBe('a:6 b:6 | c:12 | n:12');
  });

  it('squeezes the only widget of a row to make room on either side', () => {
    const rows = grid('c:12');
    expect(show(insertWidget(rows, 'n', { type: 'slot', rowIndex: 0, index: 0 }))).toBe('n:2 c:10');
    expect(show(insertWidget(rows, 'n', { type: 'slot', rowIndex: 0, index: 1 }))).toBe('c:10 n:2');
  });

  it('takes the columns from the wider neighbour when dropped between two widgets', () => {
    expect(show(insertWidget(grid('a:4 b:8'), 'n', { type: 'slot', rowIndex: 0, index: 1 }))).toBe('a:4 n:2 b:6');
    expect(show(insertWidget(grid('a:8 b:4'), 'n', { type: 'slot', rowIndex: 0, index: 1 }))).toBe('a:6 n:2 b:4');
  });

  it('reaches past neighbours already at the minimum width', () => {
    const rows = grid('a:2 b:2 c:8');
    expect(show(insertWidget(rows, 'n', { type: 'slot', rowIndex: 0, index: 1 }))).toBe('a:2 n:2 b:2 c:6');
  });

  it('splits the columns between both neighbours when neither can give them all', () => {
    const rows = grid('a:3 b:3 c:2 d:2 e:2');
    expect(show(insertWidget(rows, 'n', { type: 'slot', rowIndex: 0, index: 1 }))).toBe('a:2 n:2 b:2 c:2 d:2 e:2');
  });

  it('refuses a row whose widgets are all at the minimum width', () => {
    const full = grid('a:2 b:2 c:2 d:2 e:2 f:2');
    expect(canInsertAt(full, { type: 'slot', rowIndex: 0, index: 3 })).toBe(false);
    expect(insertWidget(full, 'n', { type: 'slot', rowIndex: 0, index: 3 })).toBeUndefined();
    expect(canInsertAt(full, { type: 'row', rowIndex: 1 })).toBe(true);
  });

  it('keeps every row at 12 columns', () => {
    const rows = grid('a:5 b:7 | c:3 d:3 e:6');
    for (let index = 0; index <= 3; index++) {
      expect(rowTotals(insertWidget(rows, 'n', { type: 'slot', rowIndex: 1, index }))).toEqual([12, 12]);
    }
  });
});

describe('removeWidget', () => {
  it('gives the removed columns to the left sibling, or the right one for the first widget', () => {
    expect(show(removeWidget(grid('a:4 b:2 c:6'), 'b'))).toBe('a:6 c:6');
    expect(show(removeWidget(grid('a:4 b:2 c:6'), 'a'))).toBe('b:6 c:6');
  });

  it('drops a row once its last widget is gone', () => {
    expect(show(removeWidget(grid('a:6 b:6 | c:12'), 'c'))).toBe('a:6 b:6');
  });
});

describe('moveWidget', () => {
  it('reorders a row without changing anyone’s width', () => {
    const rows = grid('a:3 b:4 c:5');
    expect(show(moveWidget(rows, 'c', { type: 'slot', rowIndex: 0, index: 0 }))).toBe('c:5 a:3 b:4');
    expect(show(moveWidget(rows, 'a', { type: 'slot', rowIndex: 0, index: 3 }))).toBe('b:4 c:5 a:3');
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
    expect(show(moveWidget(rows, 'a', { type: 'slot', rowIndex: 1, index: 0 }))).toBe('b:4 c:2 d:2 e:2 f:2 | a:2 g:10');
  });
});

describe('resizeWidgets', () => {
  it('moving the handle left shrinks the left widget and grows the right one, and the other way round', () => {
    const rows = grid('a:6 b:6');
    expect(show(resizeWidgets(rows, 0, 0, 4))).toBe('a:4 b:8');
    expect(show(resizeWidgets(rows, 0, 0, 9))).toBe('a:9 b:3');
  });

  it('only trades columns between the two widgets either side of the handle', () => {
    expect(show(resizeWidgets(grid('a:4 b:4 c:4'), 0, 1, 6))).toBe('a:4 b:6 c:2');
  });

  it('stops at the minimum width on both sides', () => {
    const rows = grid('a:6 b:6');
    expect(show(resizeWidgets(rows, 0, 0, 0))).toBe('a:2 b:10');
    expect(show(resizeWidgets(rows, 0, 0, 12))).toBe('a:10 b:2');
    expect(resizeWidgets(grid('a:2 b:10'), 0, 0, 1)).toBeUndefined();
  });
});
