import type { ReactNode } from 'react';

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
