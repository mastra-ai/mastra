import { useEffect, useRef } from 'react';

/** Tracks the pointer without re-rendering the composer on every move. */
export function useComposerSpotlight() {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    let animationFrame: number | undefined;
    let clientX = 0;
    let clientY = 0;

    const paintPosition = () => {
      const bounds = element.getBoundingClientRect();
      element.style.setProperty('--composer-spotlight-x', `${clientX - bounds.left}px`);
      element.style.setProperty('--composer-spotlight-y', `${clientY - bounds.top}px`);
      animationFrame = undefined;
    };

    const trackPointer = (event: PointerEvent) => {
      clientX = event.clientX;
      clientY = event.clientY;
      animationFrame ??= requestAnimationFrame(paintPosition);
    };

    element.addEventListener('pointermove', trackPointer);
    return () => {
      element.removeEventListener('pointermove', trackPointer);
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    };
  }, []);

  return elementRef;
}
