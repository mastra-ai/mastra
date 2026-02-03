import { Draggable, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';
import { ContentBlockContext, ContentBlocksContext } from './content-blocks.context';
import { useContext } from 'react';

export type ContentBlockChildren =
  | React.ReactNode
  | ((dragHandleProps: DraggableProvidedDragHandleProps | null) => React.ReactNode);

export interface ContentBlockProps {
  children: ContentBlockChildren;
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

  const isRenderProp = typeof children === 'function';

  return (
    <ContentBlockContext.Provider value={{ item, modifyAtIndex }}>
      <Draggable draggableId={`draggable-content-block-${index}`} index={index}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...(isRenderProp ? {} : provided.dragHandleProps)}
            className={className}
            style={provided.draggableProps.style}
          >
            {isRenderProp ? children(provided.dragHandleProps) : children}
          </div>
        )}
      </Draggable>
    </ContentBlockContext.Provider>
  );
};
