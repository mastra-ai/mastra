type Corner = 'tl' | 'tr' | 'bl' | 'br';

interface GridLayout {
  rows: (count: number) => number[];
  span: Partial<Record<number, string>>;
  corners: Record<Corner, readonly [inner: string, outer: string]>;
}

const CORNERS: readonly Corner[] = ['tl', 'tr', 'bl', 'br'];

const LAYOUTS: readonly GridLayout[] = [
  {
    rows: count => Array.from({ length: Math.ceil(count / 2) }, (_, row) => Math.min(2, count - row * 2)),
    span: { 1: 'col-span-2', 2: 'col-span-1' },
    corners: {
      tl: ['rounded-tl-md', 'rounded-tl-card'],
      tr: ['rounded-tr-md', 'rounded-tr-card'],
      bl: ['rounded-bl-md', 'rounded-bl-card'],
      br: ['rounded-br-md', 'rounded-br-card'],
    },
  },
  {
    rows: count => (count <= 3 ? [count] : [Math.ceil(count / 2), Math.floor(count / 2)]),
    span: { 1: 'md:col-span-6', 2: 'md:col-span-3', 3: 'md:col-span-2' },
    corners: {
      tl: ['md:rounded-tl-md', 'md:rounded-tl-card'],
      tr: ['md:rounded-tr-md', 'md:rounded-tr-card'],
      bl: ['md:rounded-bl-md', 'md:rounded-bl-card'],
      br: ['md:rounded-br-md', 'md:rounded-br-card'],
    },
  },
];

function cellOf(rows: readonly number[], index: number) {
  let start = 0;
  for (const [row, size] of rows.entries()) {
    if (index < start + size) return { row, size, column: index - start };
    start += size;
  }
  throw new Error(`Starter ${index} falls outside a grid of ${start}`);
}

export function starterCellClasses(index: number, count: number): string[] {
  return LAYOUTS.flatMap(({ rows: rowsFor, span, corners }) => {
    const rows = rowsFor(count);
    const { row, size, column } = cellOf(rows, index);
    const outer: Record<Corner, boolean> = {
      tl: row === 0 && column === 0,
      tr: row === 0 && column === size - 1,
      bl: row === rows.length - 1 && column === 0,
      br: row === rows.length - 1 && column === size - 1,
    };
    return [span[size] ?? '', ...CORNERS.map(corner => corners[corner][outer[corner] ? 1 : 0])];
  });
}
