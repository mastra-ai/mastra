import type { ReactNode } from 'react';
import type {
  DraggableId,
  DroppableId,
  TypeId,
  Direction,
  Placeholder,
  State,
  ContextId,
  DraggableRubric,
  DroppableMode,
} from '../../types';
import type { DraggableChildrenFn } from '../draggable/draggable-types';
import { updateViewportMaxScroll } from '../../state/action-creators';

export type { DraggableChildrenFn } from '../draggable/draggable-types';

export interface DroppableProvidedProps {
  // used for shared global styles
  'data-rfd-droppable-context-id': ContextId;
  // Used to lookup. Currently not used for drag and drop lifecycle
  'data-rfd-droppable-id': DroppableId;
}

export interface DroppableProvided {
  innerRef: (a?: HTMLElement | null) => void;
  placeholder: ReactNode | null;
  droppableProps: DroppableProvidedProps;
}

export interface UseClone {
  dragging: DraggableRubric;
  render: DraggableChildrenFn;
}

export interface DroppableStateSnapshot {
  // Is the Droppable being dragged over?
  isDraggingOver: boolean;
  // What is the id of the draggable that is dragging over the Droppable?
  draggingOverWith: DraggableId | null;
  // What is the id of the draggable that is dragging from this list?
  // Useful for styling the home list when not being dragged over
  draggingFromThisWith: DraggableId | null;
  // Whether or not the placeholder is actively being used.
  // This is useful information when working with virtual lists
  isUsingPlaceholder: boolean;
}

export interface MapProps {
  // placeholder:
  // - used to keep space in the home list during the whole drag and drop
  // - used to make space in foreign lists during a drag
  placeholder: Placeholder | null;
  shouldAnimatePlaceholder: boolean;
  // snapshot based on redux state to be provided to consumers
  snapshot: DroppableStateSnapshot;
  useClone: UseClone | null;
}

export interface DefaultProps {
  direction: Direction;
  getContainerForClone: () => HTMLElement;
  ignoreContainerClipping: boolean;
  isCombineEnabled: boolean;
  isDropDisabled: boolean;
  mode: DroppableMode;
  type: TypeId;
  renderClone: DraggableChildrenFn | null;
}

export interface DispatchProps {
  updateViewportMaxScroll: typeof updateViewportMaxScroll;
}

export interface DroppableProps extends Partial<DefaultProps> {
  children: (
    provided: DroppableProvided,
    snapshot: DroppableStateSnapshot,
  ) => ReactNode;
  droppableId: DroppableId;
  renderClone?: DraggableChildrenFn | null;
}

export type InternalOwnProps = DroppableProps &
  DefaultProps & {
    renderClone: DraggableChildrenFn | null;
  };

export type Props = MapProps & DispatchProps & InternalOwnProps;

// Having issues getting the correct type
// export type Selector = OutputSelector<State, OwnProps, MapProps>;
export type Selector = (state: State, ownProps: InternalOwnProps) => MapProps;
