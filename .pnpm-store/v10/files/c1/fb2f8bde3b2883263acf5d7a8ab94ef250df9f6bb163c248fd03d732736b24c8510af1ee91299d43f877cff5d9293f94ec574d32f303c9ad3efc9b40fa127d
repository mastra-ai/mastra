import { memoizeOne } from '../memoize-one';
import type {
  DroppableDimension,
  DroppableDimensionMap,
  DraggableDimension,
  DraggableDimensionMap,
} from '../types';

export const toDroppableMap = memoizeOne((droppables: DroppableDimension[]) =>
  droppables.reduce<DroppableDimensionMap>((previous, current) => {
    previous[current.descriptor.id] = current;
    return previous;
  }, {}),
);

export const toDraggableMap = memoizeOne((draggables: DraggableDimension[]) =>
  draggables.reduce<DraggableDimensionMap>((previous, current) => {
    previous[current.descriptor.id] = current;
    return previous;
  }, {}),
);

export const toDroppableList = memoizeOne(
  (droppables: DroppableDimensionMap): DroppableDimension[] =>
    Object.values(droppables),
);

export const toDraggableList = memoizeOne(
  (draggables: DraggableDimensionMap): DraggableDimension[] =>
    Object.values(draggables),
);
