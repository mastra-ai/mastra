import { invariant } from '../../../../invariant';
import type {
  DraggableDimension,
  DroppableDimension,
  DragImpact,
  CombineImpact,
  DraggableLocation,
  DraggableId,
} from '../../../../types';
import { tryGetDestination } from '../../../get-impact-location';
import removeDraggableFromList from '../../../remove-draggable-from-list';

export interface Args {
  isMovingForward: boolean;
  draggable: DraggableDimension;
  destination: DroppableDimension;
  insideDestination: DraggableDimension[];
  previousImpact: DragImpact;
}

export default ({
  isMovingForward,
  draggable,
  destination,
  insideDestination,
  previousImpact,
}: Args): DragImpact | null => {
  if (!destination.isCombineEnabled) {
    return null;
  }

  const location: DraggableLocation | null = tryGetDestination(previousImpact);

  if (!location) {
    return null;
  }

  function getImpact(target: DraggableId) {
    const at: CombineImpact = {
      type: 'COMBINE',
      combine: {
        draggableId: target,
        droppableId: destination.descriptor.id,
      },
    };
    return {
      ...previousImpact,
      at,
    };
  }

  const all: DraggableId[] = previousImpact.displaced.all;
  const closestId: DraggableId | null = all.length ? all[0] : null;

  if (isMovingForward) {
    return closestId ? getImpact(closestId) : null;
  }

  const withoutDraggable = removeDraggableFromList(
    draggable,
    insideDestination,
  );

  // Moving backwards

  // if nothing is displaced - move backwards onto the last item
  if (!closestId) {
    if (!withoutDraggable.length) {
      return null;
    }
    const last: DraggableDimension =
      withoutDraggable[withoutDraggable.length - 1];
    return getImpact(last.descriptor.id);
  }

  // We are moving from being between two displaced items
  // backwards onto the first one

  // need to find the first item before the closest
  const indexOfClosest: number = withoutDraggable.findIndex(
    (d) => d.descriptor.id === closestId,
  );
  invariant(indexOfClosest !== -1, 'Could not find displaced item in set');

  const proposedIndex: number = indexOfClosest - 1;

  // There is no displaced item before
  if (proposedIndex < 0) {
    return null;
  }

  const before: DraggableDimension = withoutDraggable[proposedIndex];
  return getImpact(before.descriptor.id);
};
