import { useLayoutEffect, useState } from 'react';

export function useElementWidth(element: HTMLElement | null): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    if (element === null) return;
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      const borderBox = entry?.borderBoxSize[0];
      if (borderBox !== undefined) setWidth(borderBox.inlineSize);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);

  return width;
}
