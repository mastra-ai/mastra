import type { Position } from 'css-box-model';
import type {
  ReactNode,
  DragEventHandler,
  TransitionEventHandler,
} from 'react';
import type {
  DraggableId,
  DroppableId,
  DraggableDimension,
  State,
  MovementMode,
  ContextId,
  ElementId,
  DraggableRubric,
} from '../../types';
import { dropAnimationFinished } from '../../state/action-creators';

export interface DraggingStyle {
  position: 'fixed';
  top: number;
  left: number;
  boxSizing: 'border-box';
  width: number;
  height: number;
  transition: string;
  transform?: string;
  zIndex: number;
  // for combining
  opacity?: number;
  // Avoiding any processing of mouse events.
  // This is already applied by the shared styles during a drag.
  // During a drop it prevents a draggable from being dragged.
  // canStartDrag() will prevent drags in some cases for non primary draggable.
  // It is also a minor performance optimisation
  pointerEvents: 'none';
}

export interface NotDraggingStyle {
  transform?: string;
  // null: use the global animation style
  // none: skip animation (used in certain displacement situations)
  transition?: 'none';
}

export type DraggableStyle = DraggingStyle | NotDraggingStyle;

export interface ZIndexOptions {
  dragging: number;
  dropAnimating: number;
}

// Props that can be spread onto the element directly
export interface DraggableProvidedDraggableProps {
  // inline style
  style?: DraggableStyle;
  // used for shared global styles
  'data-rfd-draggable-context-id': ContextId;
  // used for lookups
  'data-rfd-draggable-id': DraggableId;
  // used to know when a transition ends
  onTransitionEnd?: TransitionEventHandler;
}

export interface DraggableProvidedDragHandleProps {
  // what draggable the handle belongs to
  'data-rfd-drag-handle-draggable-id': DraggableId;
  // What DragDropContext the drag handle is in
  'data-rfd-drag-handle-context-id': ContextId;
  // We need a drag handle to be a widget in order to correctly set accessibility properties
  // Note: JAWS and VoiceOver don't need the element to be a 'widget' to read the accessibility properties, but NVDA does
  // Using `role="button"` but leaving the public API as a string to allow for changing without a major
  role: string;
  // Overriding default role to have a more descriptive text ("Draggable item")
  // Sadly we cannot use this right now due an issue with lighthouse
  // https://github.com/atlassian/react-beautiful-dnd/issues/1742
  // 'aria-roledescription': string,

  // Using the description property of the drag handle to provide usage instructions
  'aria-describedby': ElementId;
  // Allow tabbing to this element
  // Adding a tab index marks the element as interactive content: https://www.w3.org/TR/html51/dom.html#kinds-of-content-interactive-content
  tabIndex: number;
  // Opting out of html5 drag and drop
  draggable: boolean;
  onDragStart: DragEventHandler;
}

export interface DraggableProvided {
  draggableProps: DraggableProvidedDraggableProps;
  // will be null if the draggable is disabled
  dragHandleProps: DraggableProvidedDragHandleProps | null;
  // The following props will be removed once we move to react 16
  innerRef: (element?: HTMLElement | null) => void;
}

// to easily enable patching of styles
export interface DropAnimation {
  duration: number;
  curve: string;
  moveTo: Position;
  opacity: number | null;
  scale: number | null;
}

export interface DraggableStateSnapshot {
  isDragging: boolean;
  isDropAnimating: boolean;
  isClone: boolean;
  dropAnimation: DropAnimation | null;
  draggingOver: DroppableId | null;
  // the id of a draggable that you are combining with
  combineWith: DraggableId | null;
  // a combine target is being dragged over by
  combineTargetFor: DraggableId | null;
  // What type of movement is being done: 'FLUID' or 'SNAP'
  mode: MovementMode | null;
}

export interface DispatchProps {
  dropAnimationFinished: typeof dropAnimationFinished;
}

export interface DraggingMapProps {
  type: 'DRAGGING';
  offset: Position;
  mode: MovementMode;
  dropping: DropAnimation | null;
  draggingOver: DraggableId | null;
  combineWith: DraggableId | null;
  dimension: DraggableDimension;
  forceShouldAnimate: boolean | null;
  snapshot: DraggableStateSnapshot;
}

export interface SecondaryMapProps {
  type: 'SECONDARY';
  offset: Position;
  combineTargetFor: DraggableId | null;
  shouldAnimateDisplacement: boolean;
  snapshot: DraggableStateSnapshot;
}

export type MappedProps = DraggingMapProps | SecondaryMapProps;

export interface MapProps {
  // when an item is being displaced by a dragging item,
  // we need to know if that movement should be animated
  mapped: MappedProps;
  // dragging: ?DraggingMapProps,
  // secondary: ?SecondaryMapProps,
}

export type DraggableChildrenFn = (
  provided: DraggableProvided,
  snapshot: DraggableStateSnapshot,
  rubic: DraggableRubric,
) => ReactNode | null;

export interface DraggableProps {
  draggableId: DraggableId;
  index: number;
  children: DraggableChildrenFn;
  // optional own props
  isDragDisabled?: boolean;
  disableInteractiveElementBlocking?: boolean;
  shouldRespectForcePress?: boolean;
}

export interface PrivateOwnProps extends DraggableProps {
  isClone: boolean;
  // no longer optional
  isEnabled: boolean;
  canDragInteractiveElements: boolean;
  shouldRespectForcePress: boolean;
}

export type OwnProps = PrivateOwnProps;

export type Props = MapProps & DispatchProps & OwnProps;

export type Selector = (state: State, ownProps: OwnProps) => MapProps;
