import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';

export interface ContentBlocksProps<T> {
  children: React.ReactNode;
  items: Array<T>;
  onChange: (items: Array<T>) => void;
  className?: string;
}

const reorder = <T,>(list: Array<T>, startIndex: number, endIndex: number): Array<T> => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
};

export function ContentBlocks<T>({ children, items, onChange, className }: ContentBlocksProps<T>) {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const nextItems = reorder(items, result.source.index, result.destination.index);

    onChange(nextItems);
  };

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <Droppable droppableId="droppable">
        {provided => (
          <div {...provided.droppableProps} ref={provided.innerRef} className={className}>
            {children}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
}
