import { useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

/** A curve leaving `from` heading right and arriving at `to` heading right. */
export function connectorPath(fromX: number, fromY: number, toX: number, toY: number): string {
  const midX = (fromX + toX) / 2;
  return `M${fromX} ${fromY} C${midX} ${fromY} ${midX} ${toY} ${toX} ${toY}`;
}

/** Where an anchored element sits inside the map, in the map's own coordinates. */
export type AnchorBox = { left: number; right: number; centerY: number };

/**
 * Elements a map draws connectors between, keyed by what they stand for. `ref(key)` registers one; the boxes
 * follow the elements as the map resizes, since text wrapping moves them.
 */
export function useConnectorAnchors(containerRef: RefObject<HTMLElement | null>, layoutKey: string) {
  const elements = useRef(new Map<string, HTMLElement>());
  const [boxes, setBoxes] = useState<ReadonlyMap<string, AnchorBox>>(new Map());

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const origin = container.getBoundingClientRect();
      const next = new Map<string, AnchorBox>();
      for (const [key, element] of elements.current) {
        const rect = element.getBoundingClientRect();
        next.set(key, {
          left: rect.left - origin.left,
          right: rect.right - origin.left,
          centerY: rect.top + rect.height / 2 - origin.top,
        });
      }
      setBoxes(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    for (const element of elements.current.values()) observer.observe(element);
    return () => observer.disconnect();
  }, [containerRef, layoutKey]);

  const ref = (key: string) => (element: HTMLElement | null) => {
    if (element) elements.current.set(key, element);
    else elements.current.delete(key);
  };
  return { ref, boxes };
}

/** The connector layer over a map: drawn behind nothing, hidden from assistive tech (the cards say it in words). */
export function ConnectorLayer({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 hidden size-full overflow-visible @min-[36rem]:block"
    >
      {children}
    </svg>
  );
}

export function Connector({
  from,
  to,
  className,
  dashed = false,
}: {
  from: AnchorBox;
  to: AnchorBox;
  /** The connector's colour (`text-*`) and emphasis. */
  className: string;
  dashed?: boolean;
}) {
  return (
    <g className={className} fill="currentColor">
      <path
        d={connectorPath(from.right, from.centerY, to.left, to.centerY)}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeDasharray={dashed ? '4 5' : undefined}
        strokeLinecap="round"
      />
      <circle cx={from.right} cy={from.centerY} r={2.5} />
      <circle cx={to.left} cy={to.centerY} r={2.5} />
    </g>
  );
}
