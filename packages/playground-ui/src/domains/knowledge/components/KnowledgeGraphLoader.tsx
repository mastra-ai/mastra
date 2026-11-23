import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

import './knowledge-graph-loader.css';

const hub = { x: 0, y: 0 };
const upperLeft = { x: -52, y: -27 };
const upperRight = { x: 56, y: -18 };
const lowerLeft = { x: -43, y: 31 };
const lowerRight = { x: 45, y: 34 };

// Branches off another node start after that node has settled and retract before it moves again.
// Paint these first so a sprout emerges from behind its parent.
const branches = [
  { from: upperLeft, to: { x: -88, y: -43 }, delay: 990, size: 15, leaf: true },
  { from: upperRight, to: { x: 88, y: -47 }, delay: 1230, size: 17, leaf: true },
  { from: lowerLeft, to: { x: -78, y: 53 }, delay: 1470, size: 14, leaf: true },
  { from: hub, to: upperLeft, delay: 80, size: 28 },
  { from: hub, to: upperRight, delay: 320, size: 31 },
  { from: hub, to: lowerLeft, delay: 560, size: 25 },
  { from: hub, to: lowerRight, delay: 800, size: 27 },
];

export function KnowledgeGraphLoader({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading knowledge"
      className={cn('flex flex-1 items-center justify-center', className)}
    >
      <div aria-hidden="true" className="knowledge-loader-scene pointer-events-none relative h-42 w-64 max-w-full">
        {branches.map(({ from, to, delay, size, leaf }) => {
          const x = to.x - from.x;
          const y = to.y - from.y;
          const style: CSSProperties & Record<`--${string}`, string> = {
            '--angle': `${Math.atan2(y, x)}rad`,
            '--reach': `${Math.hypot(x, y)}px`,
            '--delay': `${delay}ms`,
            '--from-x': `${from.x}px`,
            '--from-y': `${from.y}px`,
            '--node-size': `${size}px`,
          };

          return (
            <div key={delay} className="knowledge-loader-branch" data-leaf={leaf || undefined} style={style}>
              <div className="knowledge-loader-edge" />
              <div className="knowledge-loader-node">
                <div className="knowledge-loader-puck" />
              </div>
            </div>
          );
        })}
        <div className="knowledge-loader-puck knowledge-loader-hub" />
      </div>
    </div>
  );
}
