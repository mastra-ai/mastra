import type { FitViewOptions } from '@xyflow/react';

/** Reserve room for the floating controls without changing the canvas size. */
export function getKnowledgeFitOptions(canvas: HTMLElement, focused: boolean): FitViewOptions {
  const narrow = window.matchMedia('(max-width: 767px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = parseFloat(getComputedStyle(canvas).getPropertyValue('--duration-slow')) || 300;
  return {
    padding: {
      top: narrow ? '170px' : '200px',
      left: '48px',
      right: focused && !narrow ? '420px' : '48px',
      bottom: focused && narrow ? `${Math.round(canvas.clientHeight * 0.45) + 80}px` : '60px',
    },
    maxZoom: focused ? 1.4 : 1,
    duration: reducedMotion ? 0 : duration,
  };
}
