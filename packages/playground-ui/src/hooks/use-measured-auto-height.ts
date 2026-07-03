import * as React from 'react';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect;

const getElementHeight = (element: HTMLElement): number => {
  const rectHeight = element.getBoundingClientRect().height;
  const measuredHeight = rectHeight > 0 ? rectHeight : element.scrollHeight;
  return Math.ceil(measuredHeight);
};

export interface UseMeasuredAutoHeightResult<TElement extends HTMLElement> {
  ref: React.RefCallback<TElement>;
  height: number | null;
  heightStyle: React.CSSProperties;
  measure: () => number | null;
}

export function useMeasuredAutoHeight<
  TElement extends HTMLElement = HTMLDivElement,
>(): UseMeasuredAutoHeightResult<TElement> {
  const [element, setElement] = React.useState<TElement | null>(null);
  const [height, setHeight] = React.useState<number | null>(null);
  const frameRef = React.useRef<number | null>(null);

  const measure = React.useCallback(() => {
    if (!element) return null;

    const nextHeight = getElementHeight(element);
    setHeight(currentHeight => (currentHeight === nextHeight ? currentHeight : nextHeight));
    return nextHeight;
  }, [element]);

  useIsomorphicLayoutEffect(() => {
    if (!element) return undefined;

    measure();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const scheduleMeasure = () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        measure();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [element, measure]);

  const heightStyle = React.useMemo<React.CSSProperties>(() => (height === null ? {} : { height }), [height]);

  return {
    ref: setElement,
    height,
    heightStyle,
    measure,
  };
}
