import { getRect } from 'css-box-model';
import type { Rect, Spacing, BoxModel } from 'css-box-model';
import type {
  Axis,
  Scrollable,
  DroppableSubject,
  PlaceholderInSubject,
} from '../../../types';
import executeClip from './clip';
import { offsetByPosition } from '../../spacing';

const scroll = (target: Spacing, frame?: Scrollable | null): Spacing => {
  if (!frame) {
    return target;
  }

  return offsetByPosition(target, frame.scroll.diff.displacement);
};

const increase = (
  target: Spacing,
  axis: Axis,
  withPlaceholder?: PlaceholderInSubject | null,
): Spacing => {
  if (withPlaceholder && withPlaceholder.increasedBy) {
    return {
      ...target,
      [axis.end]: target[axis.end] + withPlaceholder.increasedBy[axis.line],
    };
  }
  return target;
};

const clip = (target: Spacing, frame?: Scrollable | null): Rect | null => {
  if (frame && frame.shouldClipSubject) {
    return executeClip(frame.pageMarginBox, target);
  }
  return getRect(target);
};

interface Args {
  page: BoxModel;
  withPlaceholder: PlaceholderInSubject | null;
  axis: Axis;
  frame: Scrollable | null;
}

export default ({
  page,
  withPlaceholder,
  axis,
  frame,
}: Args): DroppableSubject => {
  const scrolled: Spacing = scroll(page.marginBox, frame);
  const increased: Spacing = increase(scrolled, axis, withPlaceholder);
  const clipped: Rect | null = clip(increased, frame);

  return {
    page,
    withPlaceholder,
    active: clipped,
  };
};
