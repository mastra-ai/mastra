import type { Position } from 'css-box-model';
import type {
  DisplacementGroups,
  LiftEffect,
  DraggableId,
  DisplacedBy,
} from '../types';
import { origin, negate } from './position';
import didStartAfterCritical from './did-start-after-critical';

interface Args {
  displaced: DisplacementGroups;
  afterCritical: LiftEffect;
  combineWith: DraggableId;
  displacedBy: DisplacedBy;
}

export default ({
  displaced,
  afterCritical,
  combineWith,
  displacedBy,
}: Args): Position => {
  const isDisplaced = Boolean(
    displaced.visible[combineWith] || displaced.invisible[combineWith],
  );

  if (didStartAfterCritical(combineWith, afterCritical)) {
    return isDisplaced ? origin : negate(displacedBy.point);
  }

  return isDisplaced ? displacedBy.point : origin;
};
