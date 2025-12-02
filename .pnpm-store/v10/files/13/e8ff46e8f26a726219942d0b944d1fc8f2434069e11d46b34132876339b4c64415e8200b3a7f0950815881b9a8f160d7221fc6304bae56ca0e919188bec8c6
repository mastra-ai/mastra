import type { BoxModel, Rect, Position } from 'css-box-model';

export type Id<TId extends string = string> = TId;
export type DraggableId<TId extends string = string> = Id<TId>;
export type DroppableId<TId extends string = string> = Id<TId>;
export type TypeId<TId extends string = string> = Id<TId>;
export type ContextId<TId extends string = string> = Id<TId>;
export type ElementId<TId extends string = string> = Id<TId>;

export type DroppableMode = 'standard' | 'virtual';

export interface DroppableDescriptor<TId extends string = string> {
  id: DroppableId<TId>;
  type: TypeId<TId>;
  mode: DroppableMode;
}

export interface DraggableDescriptor<TId extends string = string> {
  id: DraggableId<TId>;
  index: number;
  // Inherited from Droppable
  droppableId: DroppableId<TId>;
  // This is technically redundant but it avoids
  // needing to look up a parent droppable just to get its type
  type: TypeId<TId>;
}

export interface DraggableOptions {
  canDragInteractiveElements: boolean;
  shouldRespectForcePress: boolean;
  isEnabled: boolean;
}

export type Direction = 'horizontal' | 'vertical';

export interface VerticalAxis {
  direction: 'vertical';
  line: 'y';
  start: 'top';
  end: 'bottom';
  size: 'height';
  crossAxisLine: 'x';
  crossAxisStart: 'left';
  crossAxisEnd: 'right';
  crossAxisSize: 'width';
}

export interface HorizontalAxis {
  direction: 'horizontal';
  line: 'x';
  start: 'left';
  end: 'right';
  size: 'width';
  crossAxisLine: 'y';
  crossAxisStart: 'top';
  crossAxisEnd: 'bottom';
  crossAxisSize: 'height';
}

export type Axis = VerticalAxis | HorizontalAxis;

export interface ScrollSize {
  scrollHeight: number;
  scrollWidth: number;
}

export interface ScrollDifference {
  value: Position;
  // The actual displacement as a result of a scroll is in the opposite
  // direction to the scroll itself. When scrolling down items are displaced
  // upwards. This value is the negated version of the 'value'
  displacement: Position;
}

export interface ScrollDetails {
  initial: Position;
  current: Position;
  // the maximum allowable scroll for the frame
  max: Position;
  diff: ScrollDifference;
}

export interface Placeholder {
  client: BoxModel;
  tagName: string;
  display: string;
}

export interface DraggableDimension<TId extends string = string> {
  descriptor: DraggableDescriptor<TId>;
  // the placeholder for the draggable
  placeholder: Placeholder;
  // relative to the viewport when the drag started
  client: BoxModel;
  // relative to the whole page
  page: BoxModel;
  // how much displacement the draggable causes
  // this is the size of the marginBox
  displaceBy: Position;
}

export interface Scrollable {
  // This is the window through which the droppable is observed
  // It does not change during a drag
  pageMarginBox: Rect;
  // Used for comparision with dynamic recollecting
  frameClient: BoxModel;
  scrollSize: ScrollSize;
  // Whether or not we should clip the subject by the frame
  // Is controlled by the ignoreContainerClipping prop
  shouldClipSubject: boolean;
  scroll: ScrollDetails;
}

export interface PlaceholderInSubject {
  // might not actually be increased by
  // placeholder if there is no required space
  increasedBy: Position | null;
  placeholderSize: Position;
  // max scroll before placeholder added
  // will be null if there was no frame
  oldFrameMaxScroll: Position | null;
}

export interface DroppableSubject {
  // raw, unchanging
  page: BoxModel;
  withPlaceholder: PlaceholderInSubject | null;
  // The hitbox for a droppable
  // - page margin box
  // - with scroll changes
  // - with any additional droppable placeholder
  // - clipped by frame
  // The subject will be null if the hit area is completely empty
  active: Rect | null;
}

export interface DroppableDimension<TId extends string = string> {
  descriptor: DroppableDescriptor<TId>;
  axis: Axis;
  isEnabled: boolean;
  isCombineEnabled: boolean;
  // relative to the current viewport
  client: BoxModel;
  // relative to the whole page
  isFixedOnPage: boolean;
  // relative to the page
  page: BoxModel;
  // The container of the droppable
  frame: Scrollable | null;
  // what is visible through the frame
  subject: DroppableSubject;
}
export interface DraggableLocation<TId extends string = string> {
  droppableId: DroppableId<TId>;
  index: number;
}

export type DraggableIdMap<TId extends string = string> = {
  [id in DraggableId<TId>]: true;
};

export type DroppableIdMap<TId extends string = string> = {
  [id in DroppableId<TId>]: true;
};

export type DraggableDimensionMap<TId extends string = string> = {
  [key in DraggableId<TId>]: DraggableDimension<TId>;
};

export type DroppableDimensionMap<TId extends string = string> = {
  [key in DroppableId<TId>]: DroppableDimension<TId>;
};

export interface Displacement<TId extends string = string> {
  draggableId: DraggableId<TId>;
  shouldAnimate: boolean;
}

export type DisplacementMap<TId extends string = string> = {
  [key in DraggableId<TId>]: Displacement<TId>;
};

export interface DisplacedBy {
  value: number;
  point: Position;
}

export interface Combine<TId extends string = string> {
  draggableId: DraggableId<TId>;
  droppableId: DroppableId<TId>;
}

export interface DisplacementGroups<TId extends string = string> {
  all: DraggableId<TId>[];
  visible: DisplacementMap<TId>;
  invisible: DraggableIdMap<TId>;
}

export interface ReorderImpact<TId extends string = string> {
  type: 'REORDER';
  destination: DraggableLocation<TId>;
}

export interface CombineImpact<TId extends string = string> {
  type: 'COMBINE';
  combine: Combine<TId>;
}

export type ImpactLocation<TId extends string = string> =
  | ReorderImpact<TId>
  | CombineImpact<TId>;

export interface Displaced<TId extends string = string> {
  forwards: DisplacementGroups<TId>;
  backwards: DisplacementGroups<TId>;
}

export interface DragImpact<TId extends string = string> {
  displaced: DisplacementGroups<TId>;
  displacedBy: DisplacedBy;
  at: ImpactLocation | null;
}

export interface ClientPositions {
  // where the user initially selected
  // This point is not used to calculate the impact of a dragging item
  // It is used to calculate the offset from the initial selection point
  selection: Position;
  // the current center of the item
  borderBoxCenter: Position;
  // how far the item has moved from its original position
  offset: Position;
}

export interface PagePositions {
  selection: Position;
  borderBoxCenter: Position;
  // how much the page position has changed from the initial
  offset: Position;
}

// There are two seperate modes that a drag can be in
// FLUID: everything is done in response to highly granular input (eg mouse)
// SNAP: items move in response to commands (eg keyboard);
export type MovementMode = 'FLUID' | 'SNAP';

export interface DragPositions {
  client: ClientPositions;
  page: PagePositions;
}

export interface DraggableRubric<TId extends string = string> {
  draggableId: DraggableId<TId>;
  type: TypeId<TId>;
  source: DraggableLocation<TId>;
}

// Published in onBeforeCapture
// We cannot give more information as things might change in the
// onBeforeCapture responder!
export interface BeforeCapture<TId extends string = string> {
  draggableId: DraggableId<TId>;
  mode: MovementMode;
}

// published when a drag starts
export interface DragStart<TId extends string = string>
  extends DraggableRubric<TId> {
  mode: MovementMode;
}

export interface DragUpdate<TId extends string = string>
  extends DragStart<TId> {
  // may not have any destination (drag to nowhere)
  destination: DraggableLocation<TId> | null;
  // populated when a draggable is dragging over another in combine mode
  combine: Combine<TId> | null;
}

export type DropReason = 'DROP' | 'CANCEL';

// published when a drag finishes
export interface DropResult<TId extends string = string>
  extends DragUpdate<TId> {
  reason: DropReason;
}

export interface ScrollOptions {
  shouldPublishImmediately: boolean;
}

// using the draggable id rather than the descriptor as the descriptor
// may change as a result of the initial flush. This means that the lift
// descriptor may not be the same as the actual descriptor. To avoid
// confusion the request is just an id which is looked up
// in the dimension-marshal post-flush
// Not including droppableId as it might change in a drop flush
export interface LiftRequest<TId extends string = string> {
  draggableId: DraggableId<TId>;
  scrollOptions: ScrollOptions;
}

export interface Critical<TId extends string = string> {
  draggable: DraggableDescriptor<TId>;
  droppable: DroppableDescriptor<TId>;
}

export interface Viewport {
  // live updates with the latest values
  frame: Rect;
  scroll: ScrollDetails;
}

export interface LiftEffect<TId extends string = string> {
  inVirtualList: boolean;
  effected: DraggableIdMap<TId>;
  displacedBy: DisplacedBy;
}

export interface DimensionMap<TId extends string = string> {
  draggables: DraggableDimensionMap<TId>;
  droppables: DroppableDimensionMap<TId>;
}

export interface DroppablePublish<TId extends string = string> {
  droppableId: DroppableId<TId>;
  scroll: Position;
}

export interface Published<TId extends string = string> {
  additions: DraggableDimension<TId>[];
  removals: DraggableId<TId>[];
  modified: DroppablePublish<TId>[];
}

export interface CompletedDrag<TId extends string = string> {
  critical: Critical<TId>;
  result: DropResult<TId>;
  impact: DragImpact<TId>;
  afterCritical: LiftEffect<TId>;
}

export interface IdleState<TId extends string = string> {
  phase: 'IDLE';
  completed: CompletedDrag<TId> | null;
  shouldFlush: boolean;
}

interface BaseState<TId extends string = string> {
  phase: unknown;
  isDragging: true;
  critical: Critical<TId>;
  movementMode: MovementMode;
  dimensions: DimensionMap<TId>;
  initial: DragPositions;
  current: DragPositions;
  impact: DragImpact<TId>;
  viewport: Viewport;
  afterCritical: LiftEffect<TId>;
  onLiftImpact: DragImpact<TId>;
  // when there is a fixed list we want to opt out of this behaviour
  isWindowScrollAllowed: boolean;
  // if we need to jump the scroll (keyboard dragging)
  scrollJumpRequest: Position | null;
  // whether or not draggable movements should be animated
  forceShouldAnimate: boolean | null;
}
export interface DraggingState<TId extends string = string>
  extends BaseState<TId> {
  phase: 'DRAGGING';
}

// While dragging we can enter into a bulk collection phase
// During this phase no drag updates are permitted.
// If a drop occurs during this phase, it must wait until it is
// completed before continuing with the drop
// TODO: rename to BulkCollectingState
export interface CollectingState<TId extends string = string>
  extends BaseState<TId> {
  phase: 'COLLECTING';
}

// If a drop action occurs during a bulk collection we need to
// wait for the collection to finish before performing the drop.
// This is to ensure that everything has the correct index after
// a drop
export interface DropPendingState<TId extends string = string>
  extends BaseState<TId> {
  phase: 'DROP_PENDING';
  isWaiting: boolean;
  reason: DropReason;
}

// An optional phase for animating the drop / cancel if it is needed
export interface DropAnimatingState<TId extends string = string> {
  phase: 'DROP_ANIMATING';
  completed: CompletedDrag<TId>;
  newHomeClientOffset: Position;
  dropDuration: number;
  // We still need to render placeholders and fix the dimensions of the dragging item
  dimensions: DimensionMap<TId>;
}

export type State<TId extends string = string> =
  | IdleState<TId>
  | DraggingState<TId>
  | CollectingState<TId>
  | DropPendingState<TId>
  | DropAnimatingState<TId>;

export type StateWhenUpdatesAllowed<TId extends string = string> =
  | DraggingState<TId>
  | CollectingState<TId>;

export type Announce = (message: string) => void;

export type InOutAnimationMode = 'none' | 'open' | 'close';

export interface ResponderProvided {
  announce: Announce;
}

export type OnBeforeCaptureResponder<TId extends string = string> = (
  before: BeforeCapture<TId>,
) => void;

export type OnBeforeDragStartResponder<TId extends string = string> = (
  start: DragStart<TId>,
) => void;

export type OnDragStartResponder<TId extends string = string> = (
  start: DragStart<TId>,
  provided: ResponderProvided,
) => void;

export type OnDragUpdateResponder<TId extends string = string> = (
  update: DragUpdate<TId>,
  provided: ResponderProvided,
) => void;

export type OnDragEndResponder<TId extends string = string> = (
  result: DropResult<TId>,
  provided: ResponderProvided,
) => void;

export interface Responders<TId extends string = string> {
  onBeforeCapture?: OnBeforeCaptureResponder<TId>;
  onBeforeDragStart?: OnBeforeDragStartResponder<TId>;
  onDragStart?: OnDragStartResponder<TId>;
  onDragUpdate?: OnDragUpdateResponder<TId>;
  // always required
  onDragEnd: OnDragEndResponder<TId>;
}

// Sensors
export interface StopDragOptions {
  shouldBlockNextClick: boolean;
}

export interface DragActions {
  drop: (args?: StopDragOptions) => void;
  cancel: (args?: StopDragOptions) => void;
  isActive: () => boolean;
  shouldRespectForcePress: () => boolean;
}

export interface FluidDragActions extends DragActions {
  move: (clientSelection: Position) => void;
}

export interface SnapDragActions extends DragActions {
  moveUp: () => void;
  moveDown: () => void;
  moveRight: () => void;
  moveLeft: () => void;
}

export interface PreDragActions {
  // discover if the lock is still active
  isActive: () => boolean;
  // whether it has been indicated if force press should be respected
  shouldRespectForcePress: () => boolean;
  // lift the current item
  fluidLift: (clientSelection: Position) => FluidDragActions;
  snapLift: () => SnapDragActions;
  // cancel the pre drag without starting a drag. Releases the lock
  abort: () => void;
}

export interface TryGetLockOptions {
  sourceEvent?: Event;
}

export type TryGetLock<TId extends string = string> = (
  draggableId: DraggableId<TId>,
  forceStop?: () => void,
  options?: TryGetLockOptions,
) => PreDragActions | null;

export interface SensorAPI<TId extends string = string> {
  tryGetLock: TryGetLock<TId>;
  canGetLock: (id: DraggableId<TId>) => boolean;
  isLockClaimed: () => boolean;
  tryReleaseLock: () => void;
  findClosestDraggableId: (event: Event) => DraggableId<TId> | null;
  findOptionsForDraggable: (id: DraggableId<TId>) => DraggableOptions | null;
}

export type Sensor<TId extends string = string> = (api: SensorAPI<TId>) => void;
