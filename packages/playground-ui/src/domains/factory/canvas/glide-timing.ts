function cssTimeInMs(value: string) {
  const time = value.trim();
  return Number.parseFloat(time) * (time.endsWith('ms') ? 1 : 1000);
}

/**
 * The timing of a glide played from script, read off the theme's motion tokens. Nothing without Web Animations, as in
 * jsdom, or with reduced motion, where whatever would glide just stands in its new place.
 */
export function glideTiming(): KeyframeAnimationOptions | undefined {
  if (typeof Element.prototype.animate !== 'function') return undefined;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
  const style = getComputedStyle(document.documentElement);
  return {
    duration: cssTimeInMs(style.getPropertyValue('--duration-normal')),
    easing: style.getPropertyValue('--ease-out-custom').trim() || 'ease-out',
  };
}
