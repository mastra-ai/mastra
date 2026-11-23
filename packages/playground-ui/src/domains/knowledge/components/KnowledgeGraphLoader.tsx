import type { CSSProperties } from 'react';
import { Txt } from '@/ds/components/Txt';
import { cn } from '@/lib/utils';

import './knowledge-graph-loader.css';

const branches = [
  { angle: -148, length: 68, delay: 0, size: 14 },
  { angle: -98, length: 59, delay: 300, size: 20 },
  { angle: -39, length: 80, delay: 600, size: 12 },
  { angle: 12, length: 86, delay: 900, size: 22 },
  { angle: 68, length: 58, delay: 1200, size: 14 },
  { angle: 151, length: 75, delay: 1500, size: 18 },
];

export function KnowledgeGraphLoader({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading knowledge"
      className={cn('flex flex-1 flex-col items-center justify-center overflow-hidden', className)}
    >
      <div aria-hidden="true" className="knowledge-loader-scene relative h-38 w-58 max-w-full">
        {branches.map(({ angle, length, delay, size }) => {
          const style: CSSProperties & Record<`--${string}`, string> = {
            '--angle': `${angle}deg`,
            '--reach': `${length}px`,
            '--delay': `${delay}ms`,
            '--node-size': `${size}px`,
          };

          return (
            <div key={angle} className="knowledge-loader-branch" style={style}>
              <div className="knowledge-loader-edge" />
              <div className="knowledge-loader-node" />
            </div>
          );
        })}
        <div className="knowledge-loader-core" />
      </div>
      <Txt variant="body" tone="muted">
        Loading knowledge…
      </Txt>
    </div>
  );
}
