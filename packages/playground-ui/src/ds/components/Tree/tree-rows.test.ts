import { describe, expect, it } from 'vitest';
import { flattenTreeRows } from './tree-rows';

interface Node {
  name: string;
  children?: Node[];
}

const nodes: Node[] = [
  { name: 'src', children: [{ name: 'index.ts' }, { name: 'lib', children: [{ name: 'util.ts' }] }] },
  { name: 'empty', children: [] },
  { name: 'README.md' },
];

const rows = (open: string[]) =>
  flattenTreeRows(nodes, {
    getId: node => node.name,
    getChildren: node => node.children,
    isOpen: id => open.includes(id),
  }).map(({ id, level, posInSet, setSize, expanded }) => ({ id, level, posInSet, setSize, expanded }));

describe('flattenTreeRows', () => {
  it('lists open folders’ children under them, with their level and place among siblings', () => {
    expect(rows(['src'])).toEqual([
      { id: 'src', level: 0, posInSet: 1, setSize: 3, expanded: true },
      { id: 'index.ts', level: 1, posInSet: 1, setSize: 2, expanded: undefined },
      { id: 'lib', level: 1, posInSet: 2, setSize: 2, expanded: false },
      { id: 'empty', level: 0, posInSet: 2, setSize: 3, expanded: false },
      { id: 'README.md', level: 0, posInSet: 3, setSize: 3, expanded: undefined },
    ]);
  });

  it('treats a node with an empty child list as a folder, not a file', () => {
    expect(rows(['empty']).find(row => row.id === 'empty')?.expanded).toBe(true);
  });
});
