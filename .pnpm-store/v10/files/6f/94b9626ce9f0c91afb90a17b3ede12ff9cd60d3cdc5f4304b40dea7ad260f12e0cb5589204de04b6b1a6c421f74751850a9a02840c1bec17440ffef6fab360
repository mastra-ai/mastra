import React from 'react';
import type { DraggableId } from '../../types';
import type { DraggableProps, PrivateOwnProps } from './draggable-types';
import ConnectedDraggable from './connected-draggable';
import useRequiredContext from '../use-required-context';
import DroppableContext from '../context/droppable-context';

import type { DroppableContextValue } from '../context/droppable-context';

// We can use this to render a draggable with more control
// It is used by a Droppable to render a clone
export function PrivateDraggable(props: PrivateOwnProps) {
  const droppableContext: DroppableContextValue =
    useRequiredContext(DroppableContext);
  // The droppable can render a clone of the draggable item.
  // In that case we unmount the existing dragging item
  const isUsingCloneFor: DraggableId | null = droppableContext.isUsingCloneFor;
  if (isUsingCloneFor === props.draggableId && !props.isClone) {
    return null;
  }

  return <ConnectedDraggable {...props} />;
}

// What we give to consumers
export function PublicDraggable(props: DraggableProps) {
  // default values for props
  const isEnabled: boolean =
    typeof props.isDragDisabled === 'boolean' ? !props.isDragDisabled : true;
  const canDragInteractiveElements = Boolean(
    props.disableInteractiveElementBlocking,
  );
  const shouldRespectForcePress = Boolean(props.shouldRespectForcePress);

  return (
    <PrivateDraggable
      {...props}
      isClone={false}
      isEnabled={isEnabled}
      canDragInteractiveElements={canDragInteractiveElements}
      shouldRespectForcePress={shouldRespectForcePress}
    />
  );
}
