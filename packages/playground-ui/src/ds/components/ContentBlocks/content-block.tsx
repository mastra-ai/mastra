import { Draggable, DraggableProvidedDragHandleProps } from '@hello-pangea/dnd';

export type ContentBlockChildren =
  | React.ReactNode
  | ((dragHandleProps: DraggableProvidedDragHandleProps | null) => React.ReactNode);

export interface ContentBlockProps {
  children: ContentBlockChildren;
  index: number;
  draggableId: string;
  className?: string;
}

export const ContentBlock = ({ children, index, draggableId, className }: ContentBlockProps) => {
  const isRenderProp = typeof children === 'function';

  return (
    <Draggable draggableId={draggableId} index={index}>
      {provided => (
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
  );
};
