import { useLayoutEffect, useRef } from 'react';

import { glideTiming } from './glide-timing';

/**
 * Opens and closes the side panel's lane beside the flow, gliding the flow from where it stood into the place the lane
 * leaves it. The lane only pushes the flow once the space beside the flow runs short, so a transition on the lane's
 * width would play partly out of sight and then jump; the glide follows the flow instead. The lane takes its width
 * under `data-open`, set here rather than rendered, so the flow can be measured on both sides of the change.
 */
export function useLaneGlide(open: boolean) {
  const flow = useRef<HTMLDivElement>(null);
  const lane = useRef<HTMLSpanElement>(null);

  // Every commit, since the lane mounts afresh whenever the flow replaces a loading or error state.
  useLayoutEffect(() => {
    const moving = flow.current;
    if (!moving || !lane.current || lane.current.hasAttribute('data-open') === open) return;
    const timing = glideTiming();
    // Read mid-glide, so a panel closing while it opens turns the flow around from where it is.
    const from = moving.getBoundingClientRect().left;
    if (timing) for (const animation of moving.getAnimations()) animation.cancel();
    lane.current.toggleAttribute('data-open', open);
    const offset = from - moving.getBoundingClientRect().left;
    if (timing && Math.abs(offset) >= 0.5) moving.animate({ translate: [`${offset}px 0`, '0 0'] }, timing);
  });

  return { flow, lane };
}
