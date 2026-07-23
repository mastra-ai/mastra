import { useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps, CSSProperties } from 'react';
import type { Sankey as RechartsSankey } from 'recharts';

import { buildFixedSankeyGeometry } from './sankey-chart-utils';
import type { SankeyChartGraph } from './sankey-chart-utils';

type SankeyChartMeasurementsOptions = {
  graph: SankeyChartGraph;
  height: CSSProperties['height'];
  margin: ComponentProps<typeof RechartsSankey>['margin'];
  usesFixedGeometry: boolean;
};

export function useSankeyChartMeasurements({
  graph,
  height,
  margin,
  usesFixedGeometry,
}: SankeyChartMeasurementsOptions) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState(typeof height === 'number' ? height : 320);
  const [measuredWidth, setMeasuredWidth] = useState(800);

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return;

    const updateDimensions = () => {
      if (element.offsetHeight > 0) setMeasuredHeight(element.offsetHeight);
      if (element.offsetWidth > 0) setMeasuredWidth(element.offsetWidth);
    };

    updateDimensions();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(updateDimensions);
    observer.observe(element);
    return () => observer.disconnect();
  }, [height]);

  const fixedGeometry = useMemo(
    () =>
      usesFixedGeometry
        ? buildFixedSankeyGeometry(graph, {
            top: Number(margin?.top ?? 64),
            bottom: measuredHeight - Number(margin?.bottom ?? 12),
            left: Number(margin?.left ?? 160),
            right: measuredWidth - Number(margin?.right ?? 160) - 7,
            nodePadding: 8,
          })
        : undefined,
    [graph, margin?.bottom, margin?.left, margin?.right, margin?.top, measuredHeight, measuredWidth, usesFixedGeometry],
  );

  return { chartContainerRef, fixedGeometry };
}
