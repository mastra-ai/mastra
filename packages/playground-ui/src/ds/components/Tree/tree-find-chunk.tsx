import { memo, useDeferredValue } from 'react';
import { hideUntilFound } from './tree-find-text';

const NO_ROWS: readonly { id: string }[] = [];

interface TreeFindChunkProps {
  rows: readonly { id: string }[];
  from: number;
  to: number;
  getRowLabel(row: { id: string }): string;
}

export const TreeFindChunk = memo(function TreeFindChunk({ rows, from, to, getRowLabel }: TreeFindChunkProps) {
  const findRows = useDeferredValue(rows, NO_ROWS);
  return (
    <div ref={hideUntilFound} data-tree-find-chunk>
      {findRows.slice(from, to).map((row, offset) => (
        <div
          key={`find:${row.id}`}
          ref={hideUntilFound}
          aria-hidden
          data-tree-find-index={from + offset}
          data-tree-find-id={row.id}
        >
          {getRowLabel(row)}
        </div>
      ))}
    </div>
  );
});
