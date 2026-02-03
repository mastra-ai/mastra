import { Draggable, DraggableStyle } from '@hello-pangea/dnd';
import { ContentBlockContext, ContentBlocksContext } from './content-blocks.context';
import { useContext } from 'react';

export interface ContentBlockProps {
  children: React.ReactNode;
  index: number;
  className?: string;
}

export const ContentBlock = ({ children, index, className }: ContentBlockProps) => {
  const { items, onChange } = useContext(ContentBlocksContext);

  const item = items[index];
  const modifyAtIndex = (newItem: string) => {
    const newItems = items.map((item, idx) => (idx === index ? newItem : item));

    onChange(newItems);
  };

  return (
    <ContentBlockContext.Provider value={{ item, modifyAtIndex }}>
      <Draggable draggableId={`draggable-content-block-${index}`} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            className={className}
            style={{ backgroundColor: snapshot.isDragging ? 'lightgray' : 'white', ...provided.draggableProps.style }}
          >
            {children}
          </div>
        )}
      </Draggable>
    </ContentBlockContext.Provider>
  );
};
