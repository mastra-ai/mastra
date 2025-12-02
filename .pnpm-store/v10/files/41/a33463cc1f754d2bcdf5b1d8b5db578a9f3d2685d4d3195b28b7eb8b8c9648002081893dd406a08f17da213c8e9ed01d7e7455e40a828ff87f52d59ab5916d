import type { Position, Rect } from 'css-box-model';
import type { Scrollable, DroppableDimension } from '../../../types';
import getScroll from './get-scroll';
import { canScrollDroppable } from '../can-scroll';
import { AutoScrollerOptions } from './auto-scroller-options-types';

interface Args {
  droppable: DroppableDimension;
  subject: Rect;
  center: Position;
  dragStartTime: number;
  shouldUseTimeDampening: boolean;
  getAutoScrollerOptions: () => AutoScrollerOptions;
}

export default ({
  droppable,
  subject,
  center,
  dragStartTime,
  shouldUseTimeDampening,
  getAutoScrollerOptions,
}: Args): Position | null => {
  // We know this has a closestScrollable
  const frame: Scrollable | null = droppable.frame;

  // this should never happen - just being safe
  if (!frame) {
    return null;
  }

  const scroll: Position | null = getScroll({
    dragStartTime,
    container: frame.pageMarginBox,
    subject,
    center,
    shouldUseTimeDampening,
    getAutoScrollerOptions,
  });

  return scroll && canScrollDroppable(droppable, scroll) ? scroll : null;
};
