import { useLayoutEffect, useRef, useState } from 'react';

import type { ModelDefaults, ModelLane } from './model-routes';

type AnchorKey = ModelLane | ModelDefaults;
type ConnectorLayout = { width: number; y: Partial<Record<AnchorKey, number>> };

/** Connector ends follow the cards they join, so they are measured rather than laid out in CSS. */
export function useConnectorLayout() {
  const svgRef = useRef<SVGSVGElement>(null);
  const anchors = useRef(new Map<AnchorKey, HTMLElement>());
  const [layout, setLayout] = useState<ConnectorLayout>();

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => {
      const box = svg.getBoundingClientRect();
      const y: ConnectorLayout['y'] = {};
      for (const [key, element] of anchors.current) {
        const rect = element.getBoundingClientRect();
        y[key] = rect.top + rect.height / 2 - box.top;
      }
      setLayout({ width: box.width, y });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  const anchorRef = (key: AnchorKey) => (element: HTMLElement | null) => {
    if (element) anchors.current.set(key, element);
    else anchors.current.delete(key);
  };

  return { svgRef, anchorRef, layout };
}
