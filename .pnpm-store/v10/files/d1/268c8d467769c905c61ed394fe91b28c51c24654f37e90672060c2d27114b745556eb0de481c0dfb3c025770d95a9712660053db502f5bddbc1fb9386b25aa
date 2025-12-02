import { Position } from 'css-box-model';
import React, { ReactNode, TransitionEventHandler, DragEventHandler, FunctionComponent } from 'react';

type Id<TId extends string = string> = TId;
type DraggableId<TId extends string = string> = Id<TId>;
type DroppableId<TId extends string = string> = Id<TId>;
type TypeId<TId extends string = string> = Id<TId>;
type ContextId<TId extends string = string> = Id<TId>;
type ElementId<TId extends string = string> = Id<TId>;
type DroppableMode = 'standard' | 'virtual';
interface DraggableOptions {
    canDragInteractiveElements: boolean;
    shouldRespectForcePress: boolean;
    isEnabled: boolean;
}
type Direction = 'horizontal' | 'vertical';
interface DraggableLocation<TId extends string = string> {
    droppableId: DroppableId<TId>;
    index: number;
}
interface Combine<TId extends string = string> {
    draggableId: DraggableId<TId>;
    droppableId: DroppableId<TId>;
}
type MovementMode = 'FLUID' | 'SNAP';
interface DraggableRubric<TId extends string = string> {
    draggableId: DraggableId<TId>;
    type: TypeId<TId>;
    source: DraggableLocation<TId>;
}
interface BeforeCapture<TId extends string = string> {
    draggableId: DraggableId<TId>;
    mode: MovementMode;
}
interface DragStart<TId extends string = string> extends DraggableRubric<TId> {
    mode: MovementMode;
}
interface DragUpdate<TId extends string = string> extends DragStart<TId> {
    destination: DraggableLocation<TId> | null;
    combine: Combine<TId> | null;
}
type DropReason = 'DROP' | 'CANCEL';
interface DropResult<TId extends string = string> extends DragUpdate<TId> {
    reason: DropReason;
}
type Announce = (message: string) => void;
interface ResponderProvided {
    announce: Announce;
}
type OnBeforeCaptureResponder<TId extends string = string> = (before: BeforeCapture<TId>) => void;
type OnBeforeDragStartResponder<TId extends string = string> = (start: DragStart<TId>) => void;
type OnDragStartResponder<TId extends string = string> = (start: DragStart<TId>, provided: ResponderProvided) => void;
type OnDragUpdateResponder<TId extends string = string> = (update: DragUpdate<TId>, provided: ResponderProvided) => void;
type OnDragEndResponder<TId extends string = string> = (result: DropResult<TId>, provided: ResponderProvided) => void;
interface Responders<TId extends string = string> {
    onBeforeCapture?: OnBeforeCaptureResponder<TId>;
    onBeforeDragStart?: OnBeforeDragStartResponder<TId>;
    onDragStart?: OnDragStartResponder<TId>;
    onDragUpdate?: OnDragUpdateResponder<TId>;
    onDragEnd: OnDragEndResponder<TId>;
}
interface StopDragOptions {
    shouldBlockNextClick: boolean;
}
interface DragActions {
    drop: (args?: StopDragOptions) => void;
    cancel: (args?: StopDragOptions) => void;
    isActive: () => boolean;
    shouldRespectForcePress: () => boolean;
}
interface FluidDragActions extends DragActions {
    move: (clientSelection: Position) => void;
}
interface SnapDragActions extends DragActions {
    moveUp: () => void;
    moveDown: () => void;
    moveRight: () => void;
    moveLeft: () => void;
}
interface PreDragActions {
    isActive: () => boolean;
    shouldRespectForcePress: () => boolean;
    fluidLift: (clientSelection: Position) => FluidDragActions;
    snapLift: () => SnapDragActions;
    abort: () => void;
}
interface TryGetLockOptions {
    sourceEvent?: Event;
}
type TryGetLock<TId extends string = string> = (draggableId: DraggableId<TId>, forceStop?: () => void, options?: TryGetLockOptions) => PreDragActions | null;
interface SensorAPI<TId extends string = string> {
    tryGetLock: TryGetLock<TId>;
    canGetLock: (id: DraggableId<TId>) => boolean;
    isLockClaimed: () => boolean;
    tryReleaseLock: () => void;
    findClosestDraggableId: (event: Event) => DraggableId<TId> | null;
    findOptionsForDraggable: (id: DraggableId<TId>) => DraggableOptions | null;
}
type Sensor<TId extends string = string> = (api: SensorAPI<TId>) => void;

type RecursivePartial<T> = {
    [P in keyof T]?: T[P] extends (infer U)[] ? RecursivePartial<U>[] : T[P] extends (...args: any) => any ? T[P] | undefined : T[P] extends object ? RecursivePartial<T[P]> : T[P];
};

/**
 * Customize autoScroller behavior
 */
interface AutoScrollerOptions {
    /**
     * Percentage distance from edge of container at which to start auto scrolling.
     * ex. 0.1 or 0.9
     */
    startFromPercentage: number;
    /**
     * Percentage distance from edge of container at which max scroll speed is achieved.
     * Should be less than startFromPercentage
     */
    maxScrollAtPercentage: number;
    /**
     * Maximum pixels to scroll per frame
     */
    maxPixelScroll: number;
    /**
     * A function used to ease a percentage value
     * A simple linear function would be: (percentage) => percentage;
     * percentage is between 0 and 1
     * result must be between 0 and 1
     */
    ease: (percentage: number) => number;
    durationDampening: {
        /**
         * How long to dampen the speed of an auto scroll from the start of a drag in milliseconds
         */
        stopDampeningAt: number;
        /**
         * When to start accelerating the reduction of duration dampening in milliseconds
         */
        accelerateAt: number;
    };
    /**
     * Whether or not autoscroll should be turned off entirely
     */
    disabled: boolean;
}
type PartialAutoScrollerOptions = RecursivePartial<AutoScrollerOptions>;

interface DragDropContextProps extends Responders {
    children: ReactNode | null;
    dragHandleUsageInstructions?: string;
    enableDefaultSensors?: boolean | null;
    nonce?: string;
    sensors?: Sensor[];
    /**
     * Customize auto scroller
     */
    autoScrollerOptions?: PartialAutoScrollerOptions;
}
declare function DragDropContext(props: DragDropContextProps): React.JSX.Element;

interface DraggingStyle {
    position: 'fixed';
    top: number;
    left: number;
    boxSizing: 'border-box';
    width: number;
    height: number;
    transition: string;
    transform?: string;
    zIndex: number;
    opacity?: number;
    pointerEvents: 'none';
}
interface NotDraggingStyle {
    transform?: string;
    transition?: 'none';
}
type DraggableStyle = DraggingStyle | NotDraggingStyle;
interface DraggableProvidedDraggableProps {
    style?: DraggableStyle;
    'data-rfd-draggable-context-id': ContextId;
    'data-rfd-draggable-id': DraggableId;
    onTransitionEnd?: TransitionEventHandler;
}
interface DraggableProvidedDragHandleProps {
    'data-rfd-drag-handle-draggable-id': DraggableId;
    'data-rfd-drag-handle-context-id': ContextId;
    role: string;
    'aria-describedby': ElementId;
    tabIndex: number;
    draggable: boolean;
    onDragStart: DragEventHandler;
}
interface DraggableProvided {
    draggableProps: DraggableProvidedDraggableProps;
    dragHandleProps: DraggableProvidedDragHandleProps | null;
    innerRef: (element?: HTMLElement | null) => void;
}
interface DropAnimation {
    duration: number;
    curve: string;
    moveTo: Position;
    opacity: number | null;
    scale: number | null;
}
interface DraggableStateSnapshot {
    isDragging: boolean;
    isDropAnimating: boolean;
    isClone: boolean;
    dropAnimation: DropAnimation | null;
    draggingOver: DroppableId | null;
    combineWith: DraggableId | null;
    combineTargetFor: DraggableId | null;
    mode: MovementMode | null;
}
type DraggableChildrenFn = (provided: DraggableProvided, snapshot: DraggableStateSnapshot, rubic: DraggableRubric) => ReactNode | null;
interface DraggableProps {
    draggableId: DraggableId;
    index: number;
    children: DraggableChildrenFn;
    isDragDisabled?: boolean;
    disableInteractiveElementBlocking?: boolean;
    shouldRespectForcePress?: boolean;
}

declare function PublicDraggable(props: DraggableProps): React.JSX.Element;

interface DroppableProvidedProps {
    'data-rfd-droppable-context-id': ContextId;
    'data-rfd-droppable-id': DroppableId;
}
interface DroppableProvided {
    innerRef: (a?: HTMLElement | null) => void;
    placeholder: ReactNode | null;
    droppableProps: DroppableProvidedProps;
}
interface DroppableStateSnapshot {
    isDraggingOver: boolean;
    draggingOverWith: DraggableId | null;
    draggingFromThisWith: DraggableId | null;
    isUsingPlaceholder: boolean;
}
interface DefaultProps {
    direction: Direction;
    getContainerForClone: () => HTMLElement;
    ignoreContainerClipping: boolean;
    isCombineEnabled: boolean;
    isDropDisabled: boolean;
    mode: DroppableMode;
    type: TypeId;
    renderClone: DraggableChildrenFn | null;
}
interface DroppableProps extends Partial<DefaultProps> {
    children: (provided: DroppableProvided, snapshot: DroppableStateSnapshot) => ReactNode;
    droppableId: DroppableId;
    renderClone?: DraggableChildrenFn | null;
}

declare const ConnectedDroppable: FunctionComponent<DroppableProps>;

declare function useMouseSensor(api: SensorAPI): void;

declare function useTouchSensor(api: SensorAPI): void;

declare function useKeyboardSensor(api: SensorAPI): void;

export { type Announce, type BeforeCapture, type Direction, DragDropContext, type DragDropContextProps, type DragStart, type DragUpdate, PublicDraggable as Draggable, type DraggableChildrenFn, type DraggableId, type DraggableLocation, type DraggableProps, type DraggableProvided, type DraggableProvidedDragHandleProps, type DraggableProvidedDraggableProps, type DraggableRubric, type DraggableStateSnapshot, type DraggableStyle, type DraggingStyle, type DropAnimation, type DropResult, ConnectedDroppable as Droppable, type DroppableId, type DroppableProps, type DroppableProvided, type DroppableProvidedProps, type DroppableStateSnapshot, type FluidDragActions, type Id, type MovementMode, type NotDraggingStyle, type OnBeforeCaptureResponder, type OnBeforeDragStartResponder, type OnDragEndResponder, type OnDragStartResponder, type OnDragUpdateResponder, type PreDragActions, type ResponderProvided, type Sensor, type SensorAPI, type SnapDragActions, type TryGetLock, type TryGetLockOptions, type TypeId, useKeyboardSensor, useMouseSensor, useTouchSensor };
