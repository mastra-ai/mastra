import type { Position, Rect } from 'css-box-model';
import type { Viewport } from '../../../types';
import getScroll from './get-scroll';
import { canScrollWindow } from '../can-scroll';
import { AutoScrollerOptions } from './auto-scroller-options-types';

interface Args {
  viewport: Viewport;
  subject: Rect;
  center: Position;
  dragStartTime: number;
  shouldUseTimeDampening: boolean;
  getAutoScrollerOptions: () => AutoScrollerOptions;
}

export default ({
  viewport,
  subject,
  center,
  dragStartTime,
  shouldUseTimeDampening,
  getAutoScrollerOptions,
}: Args): Position | null => {
  const scroll: Position | null = getScroll({
    dragStartTime,
    container: viewport.frame,
    subject,
    center,
    shouldUseTimeDampening,
    getAutoScrollerOptions,
  });

  return scroll && canScrollWindow(viewport, scroll) ? scroll : null;
};
