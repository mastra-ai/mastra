import { RecursivePartial } from '../../../lib-types';

/**
 * Customize autoScroller behavior
 */
export interface AutoScrollerOptions {
  /**
   * Percentage distance from edge of container at which to start auto scrolling.
   * ex. 0.1 or 0.9
   */
  startFromPercentage: number;

  /**
   * Percentage distance from edge of container at which max scroll speed is achieved.
   * Should be less than startFromPercentage
   */
  maxScrollAtPercentage: number;

  /**
   * Maximum pixels to scroll per frame
   */
  maxPixelScroll: number;

  /**
   * A function used to ease a percentage value
   * A simple linear function would be: (percentage) => percentage;
   * percentage is between 0 and 1
   * result must be between 0 and 1
   */
  ease: (percentage: number) => number;

  durationDampening: {
    /**
     * How long to dampen the speed of an auto scroll from the start of a drag in milliseconds
     */
    stopDampeningAt: number;

    /**
     * When to start accelerating the reduction of duration dampening in milliseconds
     */
    accelerateAt: number;
  };

  /**
   * Whether or not autoscroll should be turned off entirely
   */
  disabled: boolean;
}

export type PartialAutoScrollerOptions = RecursivePartial<AutoScrollerOptions>;
