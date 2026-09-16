import { useEffect, useRef } from 'react';

export function useComposerPointer(enabled: boolean) {
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || !enabled) return;

    let animationFrame: number | undefined;
    let clientX = 0;
    let clientY = 0;

    const paintPointer = () => {
      animationFrame = undefined;
      const bounds = element.getBoundingClientRect();
      element.style.setProperty('--composer-spotlight-x', `${clientX - bounds.left}px`);
      element.style.setProperty('--composer-spotlight-y', `${clientY - bounds.top}px`);
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
      animationFrame ??= requestAnimationFrame(paintPointer);
    };

    window.addEventListener('pointermove', trackPointer, { passive: true });
    return () => {
      window.removeEventListener('pointermove', trackPointer);
      if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
    };
  }, [enabled]);

  return elementRef;
}
