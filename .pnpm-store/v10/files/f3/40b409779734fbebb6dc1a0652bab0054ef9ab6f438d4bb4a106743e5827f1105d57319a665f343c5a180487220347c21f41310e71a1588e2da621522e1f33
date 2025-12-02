import type { Position } from 'css-box-model';
import { memoizeOne } from '../../../memoize-one';
import type {
  DroppableDimension,
  DroppableDimensionMap,
  DroppableId,
} from '../../../types';
import { invariant } from '../../../invariant';
import isPositionInFrame from '../../visibility/is-position-in-frame';
import { toDroppableList } from '../../dimension-structures';

const getScrollableDroppables = memoizeOne(
  (droppables: DroppableDimensionMap): DroppableDimension[] =>
    toDroppableList(droppables).filter(
      (droppable: DroppableDimension): boolean => {
        // exclude disabled droppables
        if (!droppable.isEnabled) {
          return false;
        }

        // only want droppables that are scrollable
        if (!droppable.frame) {
          return false;
        }

        return true;
      },
    ),
);

const getScrollableDroppableOver = (
  target: Position,
  droppables: DroppableDimensionMap,
): DroppableDimension | null => {
  const maybe =
    getScrollableDroppables(droppables).find(
      (droppable: DroppableDimension): boolean => {
        invariant(droppable.frame, 'Invalid result');

        return isPositionInFrame(droppable.frame.pageMarginBox)(target);
      },
    ) || null;

  return maybe;
};

interface Api {
  center: Position;
  destination: DroppableId | null;
  droppables: DroppableDimensionMap;
}

export default ({
  center,
  destination,
  droppables,
}: Api): DroppableDimension | null => {
  // We need to scroll the best droppable frame we can so that the
  // placeholder buffer logic works correctly

  if (destination) {
    const dimension: DroppableDimension = droppables[destination];
    if (!dimension.frame) {
      return null;
    }
    return dimension;
  }

  // 2. If we are not over a droppable - are we over a droppable frame?
  const dimension: DroppableDimension | null = getScrollableDroppableOver(
    center,
    droppables,
  );

  return dimension;
};
