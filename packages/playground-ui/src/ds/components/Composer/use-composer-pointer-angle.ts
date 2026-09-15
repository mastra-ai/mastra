import { useEffect, useRef } from 'react';

/** Aims the composer ring at the cursor without re-rendering on every move. */
export function useComposerPointerAngle(enabled: boolean) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    let animationFrame: number | undefined;
    let clientX = 0;
    let clientY = 0;

    const paintAngle = () => {
      animationFrame = undefined;
      const bounds = element.getBoundingClientRect();
      const radians = Math.atan2(
        clientY - (bounds.top + bounds.height / 2),
        clientX - (bounds.left + bounds.width / 2),
      );
      // conic-gradient starts at 12 o'clock, atan2 at 3 o'clock
      element.style.setProperty('--composer-ring-angle', `${(radians * 180) / Math.PI + 90}deg`);
    };

    const trackPointer = (event: PointerEvent) => {
      clientX = event.clientX;
      clientY = event.clientY;
      animationFrame ??= requestAnimationFrame(paintAngle);
    };

    window.addEventListener('pointermove', trackPointer, { passive: true });
    return () => {
      window.removeEventListener('pointermove', trackPointer);
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    };
  }, [enabled]);

  return elementRef;
}
