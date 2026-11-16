import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

/**
 * One section's place on the page. Whenever what it holds changes height (the summary row swapping for the
 * open card, a list arriving after its skeleton, an error appearing), the slot eases from the old height to
 * the new one instead of jumping, so the sections below glide rather than snap. Changes a fold inside is
 * already easing are followed as they happen, so the two never stack. Height only, never `transform`, so the pinned mobile action keeps resolving against the viewport.
 */
export function OnboardingSlot({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let last: number | undefined;
    let running: Animation | undefined;

    const stop = () => {
      running?.cancel();
      running = undefined;
      outer.style.removeProperty('overflow-y');
    };

    const observer = new ResizeObserver(() => {
      const to = inner.getBoundingClientRect().height;
      // Mid-animation the slot's own height is where the eye is; at rest it already matches the content.
      const from = running ? outer.getBoundingClientRect().height : last;
      last = to;
      if (from === undefined || Math.abs(from - to) < 1) return;
      // A fold inside is already easing this change: follow it, since easing on top would trail behind it.
      if (reducedMotion.matches || resizingInside(inner)) {
        stop();
        return;
      }

      running?.cancel();
      const style = getComputedStyle(outer);
      // Clipped vertically only while resizing, so the cards' side shadows stay and nothing is cut at rest.
      outer.style.overflowY = 'clip';
      const animation = outer.animate(
        { height: [`${from}px`, `${to}px`] },
        {
          duration: cssTimeInMs(style.getPropertyValue('--duration-normal')),
          easing: style.getPropertyValue('--ease-out-custom').trim() || 'ease-out',
        },
      );
      running = animation;
      animation.addEventListener('finish', () => {
        if (running === animation) stop();
      });
    });
    observer.observe(inner);
    return () => {
      observer.disconnect();
      stop();
    };
  }, []);

  return (
    <div ref={outerRef} className="min-w-0">
      <div ref={innerRef} className="flex min-w-0 flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

/** Properties the section's own folds transition: the Collapsible panels' height and the row folds' grid. */
const SIZE_PROPERTIES = new Set(['height', 'grid-template-rows']);

function resizingInside(element: Element) {
  return element
    .getAnimations({ subtree: true })
    .some(animation => animation instanceof CSSTransition && SIZE_PROPERTIES.has(animation.transitionProperty));
}

function cssTimeInMs(value: string) {
  const time = value.trim();
  if (!time) return 200;
  return Number.parseFloat(time) * (time.endsWith('ms') ? 1 : 1000);
}
