import type { DraggableChildrenFn, DropResult, DroppableProvided } from '@hello-pangea/dnd';
import { DragDropContext, Droppable } from '@hello-pangea/dnd';

export interface ContentBlocksProps<T> {
  children: React.ReactNode;
  items: ReadonlyArray<T>;
  onChange: (items: Array<T>) => void;
  className?: string;
  // Inside a transformed ancestor (a menu or popover positioner) a dragged row is offset; this renders it on document.body.
  renderDragPreview?: (item: T) => React.ReactNode;
}

const reorder = <T,>(list: ReadonlyArray<T>, startIndex: number, endIndex: number): Array<T> => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  if (removed === undefined) return result;
  result.splice(endIndex, 0, removed);
  return result;
};

const dragPreviewOnBody =
  <T,>(items: ReadonlyArray<T>, renderDragPreview: (item: T) => React.ReactNode): DraggableChildrenFn =>
  (provided, _snapshot, { source }) => {
    const draggedItem = items[source.index];
    return (
      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
        {draggedItem !== undefined && renderDragPreview(draggedItem)}
      </div>
    );
  };

export function ContentBlocks<T>({ children, items, onChange, className, renderDragPreview }: ContentBlocksProps<T>) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const nextItems = reorder(items, result.source.index, result.destination.index);

    onChange(nextItems);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="droppable" renderClone={renderDragPreview && dragPreviewOnBody(items, renderDragPreview)}>
        {(provided: DroppableProvided) => (
          <div {...provided.droppableProps} ref={provided.innerRef} className={className}>
            {children}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
