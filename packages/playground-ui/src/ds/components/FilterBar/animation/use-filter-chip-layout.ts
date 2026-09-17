import { useLayoutEffect, useRef } from 'react';
import type { FilterBarItem } from '../types';

type ChipLayout = {
  element: HTMLDivElement;
  left: number;
  top: number;
  width: number;
  height: number;
};

function measureChips(elements: Map<string, HTMLDivElement>) {
  return new Map(
    [...elements].map(([id, element]) => [
      id,
      {
        element,
        left: element.offsetLeft,
        top: element.offsetTop,
        width: element.offsetWidth,
        height: element.offsetHeight,
      },
    ]),
  );
}

export function useFilterChipLayout(items: readonly FilterBarItem[]) {
  const chipElements = useRef(new Map<string, HTMLDivElement>());
  const exitLayerRef = useRef<HTMLDivElement>(null);
  const previousLayout = useRef<Map<string, ChipLayout> | undefined>(undefined);
  const animations = useRef(new Map<HTMLElement, () => void>());

  useLayoutEffect(() => {
    const exitLayer = exitLayerRef.current;
    if (!exitLayer) return;
    const nextLayout = measureChips(chipElements.current);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const runningAnimations = animations.current;

    if (!reduceMotion && previousLayout.current) {
      for (const [id, current] of nextLayout) {
        if (!previousLayout.current.has(id)) current.element.setAttribute('data-activated', '');
      }
    }

    function animateChip(element: HTMLElement, keyframes: Keyframe[], onFinish?: () => void) {
      runningAnimations.get(element)?.();
      const animation = element.animate(keyframes, {
        duration: 180,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'both',
      });
      const finish = () => {
        animation.onfinish = null;
        animation.oncancel = null;
        animation.cancel();
        runningAnimations.delete(element);
        onFinish?.();
      };
      animation.onfinish = finish;
      animation.oncancel = finish;
      runningAnimations.set(element, finish);
    }

    for (const [id, previous] of previousLayout.current ?? []) {
      const current = nextLayout.get(id);
      const element = previous.element;
      if (!current) {
        element.setAttribute('inert', '');
        element.setAttribute('aria-hidden', 'true');
        if (reduceMotion || !element.animate) continue;
        Object.assign(element.style, {
          position: 'absolute',
          left: `${previous.left}px`,
          top: `${previous.top}px`,
          width: `${previous.width}px`,
          height: `${previous.height}px`,
        });
        exitLayer.append(element);
        animateChip(element, [{ opacity: 1 }, { opacity: 0, transform: 'scale(0.96) translateY(-2px)' }], () =>
          element.remove(),
        );
        continue;
      }
      if (reduceMotion || !element.animate) continue;
      const transform = getComputedStyle(element).transform;
      const translation = new DOMMatrixReadOnly(transform === 'none' ? undefined : transform);
      const deltaX = previous.left - current.left + translation.m41;
      const deltaY = previous.top - current.top + translation.m42;
      if (deltaX === 0 && deltaY === 0) continue;
      animateChip(element, [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: 'translate(0, 0)' }]);
    }
    previousLayout.current = nextLayout;
  }, [items]);

  useLayoutEffect(() => {
    const exitLayer = exitLayerRef.current;
    const runningAnimations = animations.current;
    const cancelAnimations = () => {
      for (const finish of runningAnimations.values()) finish();
      for (const element of chipElements.current.values()) element.removeAttribute('data-activated');
    };
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const handleMotionPreference = () => {
      if (media?.matches) cancelAnimations();
    };
    media?.addEventListener('change', handleMotionPreference);
    const observer =
      typeof ResizeObserver === 'undefined'
        ? undefined
        : new ResizeObserver(() => {
            previousLayout.current = measureChips(chipElements.current);
          });
    if (exitLayer) observer?.observe(exitLayer);
    return () => {
      observer?.disconnect();
      media?.removeEventListener('change', handleMotionPreference);
      cancelAnimations();
      previousLayout.current = undefined;
    };
  }, []);

  return { chipElements, exitLayerRef };
}
