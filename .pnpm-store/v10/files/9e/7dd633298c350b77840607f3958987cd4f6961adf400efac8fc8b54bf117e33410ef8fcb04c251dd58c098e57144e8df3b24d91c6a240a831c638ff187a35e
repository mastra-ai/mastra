import { getRect } from 'css-box-model';

import type { Rect, Spacing } from 'css-box-model';

export default (frame: Spacing, subject: Spacing): Rect | null => {
  const result: Rect = getRect({
    top: Math.max(subject.top, frame.top),
    right: Math.min(subject.right, frame.right),
    bottom: Math.min(subject.bottom, frame.bottom),
    left: Math.max(subject.left, frame.left),
  });

  if (result.width <= 0 || result.height <= 0) {
    return null;
  }

  return result;
};
