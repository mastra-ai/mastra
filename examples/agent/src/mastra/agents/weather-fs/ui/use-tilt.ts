import { useRef } from 'react';
import type { PointerEvent } from 'react';

const MAX_TILT_DEG = 9;

/**
 * Tilts the card toward the pointer and moves the glare and parallax layers.
 * Writes CSS variables straight to the element so pointer moves don't re-render React.
 */
export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const frameRef = useRef(0);

  const write = (values: Record<string, string>) => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const element = ref.current;
      if (!element) return;
      for (const [name, value] of Object.entries(values)) element.style.setProperty(name, value);
    });
  };

  const onPointerMove = (event: PointerEvent<T>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const px = x * 2 - 1;
    const py = y * 2 - 1;
    write({
      '--wx-rx': `${-py * MAX_TILT_DEG}deg`,
      '--wx-ry': `${px * MAX_TILT_DEG}deg`,
      '--wx-px': String(px),
      '--wx-py': String(py),
      '--wx-gx': `${x * 100}%`,
      '--wx-gy': `${y * 100}%`,
      '--wx-glare': '1',
    });
  };

  const onPointerLeave = () => {
    write({ '--wx-rx': '0deg', '--wx-ry': '0deg', '--wx-px': '0', '--wx-py': '0', '--wx-glare': '0' });
  };

  return { ref, onPointerMove, onPointerLeave };
}
