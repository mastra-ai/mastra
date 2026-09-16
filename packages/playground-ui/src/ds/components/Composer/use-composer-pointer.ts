import { useState, type PointerEvent } from 'react';

export function useComposerPointer(enabled: boolean) {
  const [pointer, setPointer] = useState<{ x: number; y: number; angle: number }>();

  function trackPointer(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || event.defaultPrevented) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;
    const y = event.clientY - bounds.top;
    const radians = Math.atan2(y - bounds.height / 2, x - bounds.width / 2);
    // conic-gradient starts at 12 o'clock, atan2 at 3 o'clock
    setPointer({ x, y, angle: (radians * 180) / Math.PI + 90 });
  }

  return {
    trackPointer,
    pointerStyle: {
      '--composer-spotlight-x': pointer && `${pointer.x}px`,
      '--composer-spotlight-y': pointer && `${pointer.y}px`,
      '--composer-ring-angle': pointer && `${pointer.angle}deg`,
    },
  };
}
