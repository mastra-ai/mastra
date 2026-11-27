import { memo, useDeferredValue } from 'react';
import type { ReactNode } from 'react';
import { hideUntilFound } from './tree-find-text';

const NO_ROWS: readonly { id: string }[] = [];

interface TreeFindChunkProps {
  rows: readonly { id: string }[];
  from: number;
  to: number;
  getRowLabel(row: { id: string }): string;
  renderRowAt?: (index: number) => ReactNode[] | undefined;
}

export const TreeFindChunk = memo(function TreeFindChunk({
  rows,
  from,
  to,
  getRowLabel,
  renderRowAt,
}: TreeFindChunkProps) {
  const locked = !renderRowAt;
  const findRows = useDeferredValue(rows, NO_ROWS);
  return (
    <div
      ref={element => {
        if (locked) element?.setAttribute('hidden', 'until-found');
        else element?.removeAttribute('hidden');
      }}
      data-tree-find-chunk
      data-locked={locked || undefined}
    >
      {rows.slice(from, to).flatMap((_, offset) => {
        const index = from + offset;
        const drawn = renderRowAt?.(index);
        if (drawn) return drawn;
        const findRow = findRows[index];
        if (!findRow) return [];
        return (
          <div key={`find:${findRow.id}`} ref={hideUntilFound} aria-hidden data-tree-find-index={index}>
            {getRowLabel(findRow)}
          </div>
        );
      })}
    </div>
  );
});
