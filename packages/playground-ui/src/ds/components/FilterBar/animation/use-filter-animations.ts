import { useLayoutEffect, useState } from 'react';

const FILTER_TRANSITION_MS = 220;
const FILTER_TRANSITION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)';

export function prefersReducedFilterMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function createFilterAnimations() {
  const running = new Map<Animation, () => void>();
  function run(element: HTMLElement, keyframes: Keyframe[], onFinish?: () => void) {
    if (prefersReducedFilterMotion() || !element.animate) {
      onFinish?.();
      return;
    }
    const animation = element.animate(keyframes, {
      duration: FILTER_TRANSITION_MS,
      easing: FILTER_TRANSITION_EASING,
      fill: 'both',
    });
    const finish = () => {
      animation.onfinish = null;
      animation.oncancel = null;
      running.delete(animation);
      animation.cancel();
      onFinish?.();
    };
    animation.onfinish = finish;
    animation.oncancel = finish;
    running.set(animation, finish);
  }
  return {
    run,
    holdWidth(element: HTMLElement, width: number) {
      run(element, [{ width: `${width}px` }, { width: `${width}px` }]);
    },
    reveal(element: HTMLElement, width: number) {
      run(element, [
        { width: '0px', minWidth: '0px', opacity: 0, paddingInline: '0px', flexShrink: 0 },
        {
          width: `${width}px`,
          minWidth: '0px',
          opacity: 1,
          paddingInline: getComputedStyle(element).paddingInline,
          flexShrink: 0,
        },
      ]);
    },
    revealInput(element: HTMLInputElement, width: number) {
      run(element, [
        { width: `${width}px`, minWidth: '0px', flexShrink: 0, opacity: 0 },
        { opacity: 0, offset: 0.96 },
        { width: `${width}px`, minWidth: '0px', flexShrink: 0, opacity: 1 },
      ]);
    },
    cancel() {
      for (const finish of running.values()) finish();
    },
  };
}

export function useFilterAnimations() {
  const [animations] = useState(createFilterAnimations);
  useLayoutEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const cancelReducedMotion = () => {
      if (media?.matches) animations.cancel();
    };
    media?.addEventListener('change', cancelReducedMotion);
    return () => {
      media?.removeEventListener('change', cancelReducedMotion);
      animations.cancel();
    };
  }, [animations]);
  return animations;
}
