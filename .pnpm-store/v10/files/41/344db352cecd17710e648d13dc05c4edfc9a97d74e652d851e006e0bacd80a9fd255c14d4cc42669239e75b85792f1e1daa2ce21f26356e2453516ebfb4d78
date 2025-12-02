import type { Rect } from 'css-box-model';
import type { Scrollable, DroppableDimension } from '../../types';
import { offsetRectByPosition } from '../rect';

export default (droppable: DroppableDimension, area: Rect): Rect => {
  const frame: Scrollable | null = droppable.frame;
  if (!frame) {
    return area;
  }

  return offsetRectByPosition(area, frame.scroll.diff.value);
};
