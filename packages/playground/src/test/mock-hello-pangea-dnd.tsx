/**
 * Stand-in for `@hello-pangea/dnd`. jsdom has no layout, so the library's sensors can't drive a drag;
 * this renders droppables/draggables inline and lets tests trigger the drop result directly.
 *
 * Usage:
 *   vi.mock('@hello-pangea/dnd', () => import('@/test/mock-hello-pangea-dnd'));
 *   import { simulateDrop } from '@/test/mock-hello-pangea-dnd';
 *   simulateDrop('question', 'input');
 */
import type {
  DraggableProvided,
  DraggableStateSnapshot,
  DropResult,
  DroppableProvided,
  DroppableStateSnapshot,
} from '@hello-pangea/dnd';
import { act } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';

let currentOnDragEnd: ((result: DropResult) => void) | undefined;

export function DragDropContext({
  onDragEnd,
  children,
}: {
  onDragEnd: (result: DropResult) => void;
  children: ReactNode;
}) {
  currentOnDragEnd = onDragEnd;
  return <>{children}</>;
}

export function Droppable({
  droppableId,
  children,
}: {
  droppableId: string;
  children: (provided: DroppableProvided, snapshot: DroppableStateSnapshot) => ReactElement;
}) {
  return children(
    {
      innerRef: () => {},
      droppableProps: { 'data-rfd-droppable-context-id': 'test', 'data-rfd-droppable-id': droppableId },
      placeholder: null,
    },
    { isDraggingOver: false, draggingOverWith: null, draggingFromThisWith: null, isUsingPlaceholder: false },
  );
}

export function Draggable({
  draggableId,
  children,
}: {
  draggableId: string;
  index: number;
  children: (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => ReactNode;
}) {
  return (
    <>
      {children(
        {
          innerRef: () => {},
          draggableProps: { 'data-rfd-draggable-context-id': 'test', 'data-rfd-draggable-id': draggableId },
          dragHandleProps: null,
        },
        {
          isDragging: false,
          isDropAnimating: false,
          isClone: false,
          dropAnimation: null,
          draggingOver: null,
          combineWith: null,
          combineTargetFor: null,
          mode: null,
        },
      )}
    </>
  );
}

/** Drops the draggable `draggableId` into the droppable `droppableId` of the last rendered DragDropContext. */
// eslint-disable-next-line react-refresh/only-export-components -- test helper co-located with the module mock.
export function simulateDrop(draggableId: string, droppableId: string) {
  if (!currentOnDragEnd) throw new Error('No DragDropContext rendered');
  const onDragEnd = currentOnDragEnd;
  act(() => {
    onDragEnd({
      draggableId,
      type: 'DEFAULT',
      reason: 'DROP',
      mode: 'FLUID',
      source: { droppableId: 'unknown', index: 0 },
      destination: { droppableId, index: 0 },
      combine: null,
    });
  });
}
