import getPercentage from '../../get-percentage';
import { AutoScrollerOptions } from '../../auto-scroller-options-types';
import minScroll from './min-scroll';

export default (
  proposedScroll: number,
  dragStartTime: number,
  getAutoScrollerOptions: () => AutoScrollerOptions,
): number => {
  const autoScrollerOptions = getAutoScrollerOptions();

  const accelerateAt: number =
    autoScrollerOptions.durationDampening.accelerateAt;
  const stopAt: number = autoScrollerOptions.durationDampening.stopDampeningAt;

  const startOfRange: number = dragStartTime;
  const endOfRange: number = stopAt;
  const now: number = Date.now();
  const runTime: number = now - startOfRange;

  // we have finished the time dampening period
  if (runTime >= stopAt) {
    return proposedScroll;
  }

  // Up to this point we know there is a proposed scroll
  // but we have not reached our accelerate point
  // Return the minimum amount of scroll
  if (runTime < accelerateAt) {
    return minScroll;
  }

  const betweenAccelerateAtAndStopAtPercentage: number = getPercentage({
    startOfRange: accelerateAt,
    endOfRange,
    current: runTime,
  });

  const scroll: number =
    proposedScroll *
    autoScrollerOptions.ease(betweenAccelerateAtAndStopAtPercentage);

  return Math.ceil(scroll);
};
