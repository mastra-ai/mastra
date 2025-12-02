import type { DistanceThresholds } from './get-distance-thresholds';
import getPercentage from '../../get-percentage';
import { AutoScrollerOptions } from '../../auto-scroller-options-types';
import minScroll from './min-scroll';
import { defaultAutoScrollerOptions } from '../../config';

export default (
  distanceToEdge: number,
  thresholds: DistanceThresholds,
  getAutoScrollerOptions: () => AutoScrollerOptions = () =>
    defaultAutoScrollerOptions,
): number => {
  const autoScrollerOptions = getAutoScrollerOptions();

  /*
  // This function only looks at the distance to one edge
  // Example: looking at bottom edge
  |----------------------------------|
  |                                  |
  |                                  |
  |                                  |
  |                                  |
  |                                  | => no scroll in this range
  |                                  |
  |                                  |
  |  startScrollingFrom (eg 100px)   |
  |                                  |
  |                                  | => increased scroll value the closer to maxScrollValueAt
  |  maxScrollValueAt (eg 10px)      |
  |                                  | => max scroll value in this range
  |----------------------------------|
  */

  // too far away to auto scroll
  if (distanceToEdge > thresholds.startScrollingFrom) {
    return 0;
  }

  // use max speed when on or over boundary
  if (distanceToEdge <= thresholds.maxScrollValueAt) {
    return autoScrollerOptions.maxPixelScroll;
  }

  // when just going on the boundary return the minimum integer
  if (distanceToEdge === thresholds.startScrollingFrom) {
    return minScroll;
  }

  // to get the % past startScrollingFrom we will calculate
  // the % the value is from maxScrollValueAt and then invert it
  const percentageFromMaxScrollValueAt: number = getPercentage({
    startOfRange: thresholds.maxScrollValueAt,
    endOfRange: thresholds.startScrollingFrom,
    current: distanceToEdge,
  });

  const percentageFromStartScrollingFrom: number =
    1 - percentageFromMaxScrollValueAt;

  const scroll: number =
    autoScrollerOptions.maxPixelScroll *
    autoScrollerOptions.ease(percentageFromStartScrollingFrom);

  // scroll will always be a positive integer
  return Math.ceil(scroll);
};
