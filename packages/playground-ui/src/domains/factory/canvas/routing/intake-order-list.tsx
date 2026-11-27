import type { ReactNode } from 'react';
import { StackLink } from '../flow-links';
import { useRowDrag } from '../use-row-drag';
import { cn } from '@/utils/cn';

/**
 * The boards in intake order, each linked to the one before it. When `movable`, a board is dragged by its grip or moved
 * with Alt+arrow keys.
 */
export function IntakeOrderList({
  boards,
  movable,
  onMove,
  renderBoard,
}: {
  boards: readonly string[];
  movable: boolean;
  onMove: (from: number, to: number) => void;
  renderBoard: (boardKey: string, row: { index: number; dragging: boolean }) => ReactNode;
}) {
  const drag = useRowDrag({ min: 0, max: boards.length - 1, onDrop: onMove });
  return (
    <ol aria-label="Boards in intake order" className="flex flex-col">
      {boards.map((boardKey, index) => {
        const motion = drag.rowMotion(index);
        return (
          <li
            key={boardKey}
            style={motion.style}
            onPointerDown={movable ? event => drag.onPointerDown(event, index) : undefined}
            onKeyDown={movable ? event => drag.onKeyDown(event, index) : undefined}
            className={cn('relative flex flex-col', motion.className)}
          >
            {index > 0 && <StackLink />}
            {renderBoard(boardKey, { index, dragging: drag.drag?.from === index })}
          </li>
        );
      })}
    </ol>
  );
}
