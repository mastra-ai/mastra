import { useCallback, useRef } from 'react';

export interface ClientPoint {
  clientX: number;
  clientY: number;
}

export interface UseClampedElementCursorOptions {
  axis: 'x' | 'y';
  margin?: number;
  variableName: `--${string}`;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const readAxis = (point: ClientPoint, rect: DOMRect, axis: 'x' | 'y') => {
  if (axis === 'x') {
    return { client: point.clientX, start: rect.left, size: rect.width };
  }

  return { client: point.clientY, start: rect.top, size: rect.height };
};

export const getClampedElementCursorOffset = (point: ClientPoint, rect: DOMRect, axis: 'x' | 'y', margin = 0) => {
  const { client, start, size } = readAxis(point, rect, axis);
  return clamp(client - start, margin, Math.max(margin, size - margin));
};

export const useClampedElementCursor = <TElement extends HTMLElement>({
  axis,
  margin = 0,
  variableName,
}: UseClampedElementCursorOptions) => {
  const elementRef = useRef<TElement | null>(null);
  const rectRef = useRef<DOMRect | null>(null);

  const writePosition = useCallback(
    (point: ClientPoint, refreshRect = false) => {
      const element = elementRef.current;
      if (!element) return;

      const rect = refreshRect || !rectRef.current ? element.getBoundingClientRect() : rectRef.current;
      rectRef.current = rect;

      const offset = getClampedElementCursorOffset(point, rect, axis, margin);
      element.style.setProperty(variableName, `${offset}px`);
    },
    [axis, margin, variableName],
  );

  const beginTracking = useCallback(
    (point: ClientPoint) => {
      writePosition(point, true);
    },
    [writePosition],
  );

  const updateTracking = useCallback(
    (point: ClientPoint) => {
      writePosition(point);
    },
    [writePosition],
  );

  const endTracking = useCallback(() => {
    rectRef.current = null;
  }, []);

  return { beginTracking, elementRef, endTracking, updateTracking };
};
