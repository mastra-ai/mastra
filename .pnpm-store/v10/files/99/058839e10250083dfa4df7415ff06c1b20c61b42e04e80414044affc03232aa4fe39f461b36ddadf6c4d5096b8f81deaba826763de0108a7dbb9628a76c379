import type { Position } from 'css-box-model';
import type {
  Id,
  DraggableId,
  DraggableDescriptor,
  DraggableOptions,
  DraggableDimension,
  DroppableId,
  ScrollOptions,
  DroppableDescriptor,
  DroppableDimension,
  TypeId,
} from '../../types';

export type GetDraggableDimensionFn = (
  windowScroll: Position,
) => DraggableDimension;

export interface DraggableEntry {
  uniqueId: Id;
  descriptor: DraggableDescriptor;
  options: DraggableOptions;
  getDimension: GetDraggableDimensionFn;
}

export interface DraggableAPI {
  register: (entry: DraggableEntry) => void;
  update: (entry: DraggableEntry, last: DraggableEntry) => void;
  unregister: (entry: DraggableEntry) => void;
  exists: (id: DraggableId) => boolean;
  getById: (id: DraggableId) => DraggableEntry;
  findById: (id: DraggableId) => DraggableEntry | null;
  getAllByType: (type: TypeId) => DraggableEntry[];
}

export type GetDroppableDimensionFn = (
  windowScroll: Position,
  options: ScrollOptions,
) => DroppableDimension;

export interface RecollectDroppableOptions {
  withoutPlaceholder: boolean;
}

export interface DroppableCallbacks {
  // a drag is starting
  getDimensionAndWatchScroll: GetDroppableDimensionFn;
  getScrollWhileDragging: () => Position;
  // scroll a droppable
  scroll: (change: Position) => void;
  // If the Droppable is listening for scroll events - it needs to stop!
  // Can be called on droppables that have not been asked to watch scroll
  dragStopped: () => void;
}

export interface DroppableEntry {
  uniqueId: Id;
  descriptor: DroppableDescriptor;
  callbacks: DroppableCallbacks;
}

export type DraggableEntryMap = {
  [id in DraggableId]: DraggableEntry;
};

export type DroppableEntryMap = {
  [id in DroppableId]: DroppableEntry;
};

export interface DroppableAPI {
  register: (entry: DroppableEntry) => void;
  unregister: (entry: DroppableEntry) => void;
  exists: (id: DraggableId) => boolean;
  getById: (id: DroppableId) => DroppableEntry;
  findById: (id: DroppableId) => DroppableEntry | null;
  getAllByType: (type: TypeId) => DroppableEntry[];
}

export type RegistryEvent =
  | {
      type: 'ADDITION';
      value: DraggableEntry;
    }
  | {
      type: 'REMOVAL';
      value: DraggableEntry;
    };

export type Subscriber = (event: RegistryEvent) => void;
export type Unsubscribe = () => void;

export interface Registry {
  draggable: DraggableAPI;
  droppable: DroppableAPI;
  subscribe: (cb: Subscriber) => Unsubscribe;
  clean: () => void;
}
