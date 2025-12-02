import type { Rect } from 'css-box-model';
import { AutoScrollerOptions } from '../../auto-scroller-options-types';
import type { Axis } from '../../../../../types';
import { defaultAutoScrollerOptions } from '../../config';

// all in pixels
export interface DistanceThresholds {
  startScrollingFrom: number;
  maxScrollValueAt: number;
}

// converts the percentages in the config into actual pixel values
export default (
  container: Rect,
  axis: Axis,
  getAutoScrollerOptions: () => AutoScrollerOptions = () =>
    defaultAutoScrollerOptions,
): DistanceThresholds => {
  const autoScrollerOptions = getAutoScrollerOptions();

  const startScrollingFrom: number =
    container[axis.size] * autoScrollerOptions.startFromPercentage;
  const maxScrollValueAt: number =
    container[axis.size] * autoScrollerOptions.maxScrollAtPercentage;

  const thresholds: DistanceThresholds = {
    startScrollingFrom,
    maxScrollValueAt,
  };

  return thresholds;
};
