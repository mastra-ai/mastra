/**
 * How long the panel animates between widths, in ms: the theme's `--resize-dur`, or 0 when the user prefers
 * reduced motion (the width transition is off then, so nothing should wait for it).
 */
export function sidebarMotionDuration(el: Element): number {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
  return parseFloat(getComputedStyle(el).getPropertyValue('--resize-dur')) || 0;
}
