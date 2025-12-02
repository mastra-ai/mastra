import type {
  DraggableDimension,
  DroppableDimension,
  DragImpact,
  DisplacementGroups,
  Viewport,
  DisplacedBy,
} from '../../types';
import removeDraggableFromList from '../remove-draggable-from-list';
import isHomeOf from '../droppable/is-home-of';
import { emptyGroups } from '../no-impact';
import getDisplacementGroups from '../get-displacement-groups';

interface Args {
  draggable: DraggableDimension;
  insideDestination: DraggableDimension[];
  destination: DroppableDimension;
  viewport: Viewport;
  displacedBy: DisplacedBy;
  last: DisplacementGroups;
  index: number | null;
  forceShouldAnimate?: boolean;
}

function getIndexOfLastItem(
  draggables: DraggableDimension[],
  options: {
    inHomeList: boolean;
  },
): number {
  if (!draggables.length) {
    return 0;
  }

  const indexOfLastItem: number =
    draggables[draggables.length - 1].descriptor.index;

  // When in a foreign list there will be an additional one item in the list
  return options.inHomeList ? indexOfLastItem : indexOfLastItem + 1;
}

interface GoAtEndArgs {
  insideDestination: DraggableDimension[];
  inHomeList: boolean;
  displacedBy: DisplacedBy;
  destination: DroppableDimension;
}

function goAtEnd({
  insideDestination,
  inHomeList,
  displacedBy,
  destination,
}: GoAtEndArgs): DragImpact {
  const newIndex: number = getIndexOfLastItem(insideDestination, {
    inHomeList,
  });

  return {
    displaced: emptyGroups,
    displacedBy,
    at: {
      type: 'REORDER',
      destination: {
        droppableId: destination.descriptor.id,
        index: newIndex,
      },
    },
  };
}

export default function calculateReorderImpact({
  draggable,
  insideDestination,
  destination,
  viewport,
  displacedBy,
  last,
  index,
  forceShouldAnimate,
}: Args): DragImpact {
  const inHomeList: boolean = isHomeOf(draggable, destination);

  // Go into last spot of list
  if (index == null) {
    return goAtEnd({
      insideDestination,
      inHomeList,
      displacedBy,
      destination,
    });
  }

  // this might be the dragging item
  const match = insideDestination.find(
    (item: DraggableDimension) => item.descriptor.index === index,
  );

  if (!match) {
    return goAtEnd({
      insideDestination,
      inHomeList,
      displacedBy,
      destination,
    });
  }
  const withoutDragging: DraggableDimension[] = removeDraggableFromList(
    draggable,
    insideDestination,
  );

  const sliceFrom: number = insideDestination.indexOf(match);
  const impacted: DraggableDimension[] = withoutDragging.slice(sliceFrom);

  const displaced: DisplacementGroups = getDisplacementGroups({
    afterDragging: impacted,
    destination,
    displacedBy,
    last,
    viewport: viewport.frame,
    forceShouldAnimate,
  });

  return {
    displaced,
    displacedBy,
    at: {
      type: 'REORDER',
      destination: {
        droppableId: destination.descriptor.id,
        index,
      },
    },
  };
}
