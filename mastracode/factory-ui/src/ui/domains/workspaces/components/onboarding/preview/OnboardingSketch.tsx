import type { ReactNode } from 'react';

type Point = [x: number, y: number];

const SKETCH_WIDTH = 400;
const SKETCH_HEIGHT = 320;

/** HTML labels share the drawing's 400×320 coordinates, so text stays crisp at any size. */
export function SketchLabel({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  return (
    <div
      className="absolute min-w-0"
      style={{
        left: `${(x / SKETCH_WIDTH) * 100}%`,
        top: `${(y / SKETCH_HEIGHT) * 100}%`,
        width: `${(width / SKETCH_WIDTH) * 100}%`,
      }}
    >
      {children}
    </div>
  );
}

export function Sketch({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox={`0 0 ${SKETCH_WIDTH} ${SKETCH_HEIGHT}`}
      aria-hidden="true"
      className="onboarding-sketch absolute inset-0 size-full"
    >
      {children}
    </svg>
  );
}

export function SketchPanel({
  x,
  y,
  width,
  height,
  highlighted = false,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  highlighted?: boolean;
}) {
  return (
    <rect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={8}
      className="onboarding-sketch-surface"
      data-highlighted={highlighted}
    />
  );
}

const coordinates = ([x, y]: Point) => `${x},${y}`;

function curveHandles([x1, y1]: Point, [x2, y2]: Point): [Point, Point] {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const runsAcross = Math.abs(x2 - x1) > Math.abs(y2 - y1);
  if (runsAcross)
    return [
      [midX, y1],
      [midX, y2],
    ];
  return [
    [x1, midY],
    [x2, midY],
  ];
}

export function SketchLink({ from, to }: { from: Point; to: Point }) {
  const [start, end] = curveHandles(from, to);
  return (
    <path
      d={`M${coordinates(from)} C${coordinates(start)} ${coordinates(end)} ${coordinates(to)}`}
      className="onboarding-sketch-link"
    />
  );
}
