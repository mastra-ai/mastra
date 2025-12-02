import type { Rect, Spacing } from 'css-box-model';
import getDistanceThresholds from './get-distance-thresholds';
import { AutoScrollerOptions } from '../../auto-scroller-options-types';
import type { DistanceThresholds } from './get-distance-thresholds';
import type { Axis } from '../../../../../types';
import getValue from './get-value';

interface GetOnAxisArgs {
  container: Rect;
  distanceToEdges: Spacing;
  dragStartTime: number;
  axis: Axis;
  shouldUseTimeDampening: boolean;
  getAutoScrollerOptions: () => AutoScrollerOptions;
}

export default ({
  container,
  distanceToEdges,
  dragStartTime,
  axis,
  shouldUseTimeDampening,
  getAutoScrollerOptions,
}: GetOnAxisArgs): number => {
  const thresholds: DistanceThresholds = getDistanceThresholds(
    container,
    axis,
    getAutoScrollerOptions,
  );
  const isCloserToEnd: boolean =
    distanceToEdges[axis.end] < distanceToEdges[axis.start];

  if (isCloserToEnd) {
    return getValue({
      distanceToEdge: distanceToEdges[axis.end],
      thresholds,
      dragStartTime,
      shouldUseTimeDampening,
      getAutoScrollerOptions,
    });
  }

  return (
    -1 *
    getValue({
      distanceToEdge: distanceToEdges[axis.start],
      thresholds,
      dragStartTime,
      shouldUseTimeDampening,
      getAutoScrollerOptions,
    })
  );
};
