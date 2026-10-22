import { createRef, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

import { MODEL_DEFAULTS_TONES, MODEL_LANES, connectorPath } from './model-routes';
import type { ModelDefaults, ModelLane } from './model-routes';

export type ConnectorAnchors = Record<ModelLane, RefObject<HTMLDivElement | null>> &
  Record<ModelDefaults, RefObject<HTMLElement | null>>;

type ConnectorLayout = { width: number; y: Record<ModelLane | ModelDefaults, number | undefined> };

export function createConnectorAnchors(): ConnectorAnchors {
  return {
    chats: createRef<HTMLDivElement>(),
    runs: createRef<HTMLDivElement>(),
    personal: createRef<HTMLElement>(),
    factory: createRef<HTMLElement>(),
  };
}

function centerY(element: HTMLElement | null, top: number): number | undefined {
  if (!element) return undefined;
  const rect = element.getBoundingClientRect();
  return rect.top + rect.height / 2 - top;
}

function measureConnectorLayout(svg: SVGSVGElement, anchors: ConnectorAnchors): ConnectorLayout {
  const box = svg.getBoundingClientRect();
  return {
    width: box.width,
    y: {
      chats: centerY(anchors.chats.current, box.top),
      runs: centerY(anchors.runs.current, box.top),
      personal: centerY(anchors.personal.current, box.top),
      factory: centerY(anchors.factory.current, box.top),
    },
  };
}

/** Connector ends follow the cards they join, so they are measured rather than laid out in CSS. */
export function RoutingMapLayout({
  anchors,
  routes,
  lanes,
  defaults,
}: {
  anchors: ConnectorAnchors;
  routes: Record<ModelLane, ModelDefaults>;
  lanes: ReactNode;
  defaults: ReactNode;
}) {
  const lanesRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const defaultsRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<ConnectorLayout>();

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const measure = () => setLayout(measureConnectorLayout(svg, anchors));
    measure();
    const observer = new ResizeObserver(measure);
    for (const element of [svg, lanesRef.current, defaultsRef.current]) {
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [anchors]);

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-3 @min-[44rem]:grid-cols-[13rem_minmax(4rem,1fr)_minmax(0,26rem)] @min-[44rem]:gap-0">
        <div ref={lanesRef} className="flex flex-col gap-3 self-center">
          {lanes}
        </div>
        <svg ref={svgRef} aria-hidden="true" className="hidden h-full w-full overflow-visible @min-[44rem]:block">
          {layout &&
            MODEL_LANES.map(lane => {
              const fromY = layout.y[lane];
              const toY = layout.y[routes[lane]];
              if (fromY === undefined || toY === undefined) return null;
              return (
                <g key={lane} className={MODEL_DEFAULTS_TONES[routes[lane]]} fill="currentColor">
                  <path
                    d={connectorPath(0, fromY, layout.width, toY)}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  />
                  <circle cx={0} cy={fromY} r={2.5} />
                  <circle cx={layout.width} cy={toY} r={2.5} />
                </g>
              );
            })}
        </svg>
        <div ref={defaultsRef} className="flex min-w-0 flex-col gap-3 self-start">
          {defaults}
        </div>
      </div>
    </div>
  );
}
