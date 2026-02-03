import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { ContentBlocksContext } from './content-blocks.context';

export interface ContentBlocksProps {
  children: React.ReactNode;
  items: Array<string>;
  onChange: (items: Array<string>) => void;
  className?: string;
}

const reorder = (list: Array<string>, startIndex: number, endIndex: number) => {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);

  return result;
};

export const ContentBlocks = ({ children, items, onChange, className }: ContentBlocksProps) => {
  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const nextItems = reorder(items, result.source.index, result.destination.index);

    onChange(nextItems);
  };

  const getListStyle = (isDraggingOver: boolean) => ({
    background: isDraggingOver ? 'lightblue' : 'lightgrey',
    width: 250,
  });

  return (
    <ContentBlocksContext.Provider value={{ items, onChange }}>
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="droppable">
          {(provided, snapshot) => (
            <div
              {...provided.droppableProps}
              ref={provided.innerRef}
              style={getListStyle(snapshot.isDraggingOver)}
              className={className}
            >
              {children}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>
    </ContentBlocksContext.Provider>
  );
};
