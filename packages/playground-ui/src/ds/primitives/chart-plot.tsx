import type { ReactNode } from 'react';
import { ResponsiveContainer } from 'recharts';
import type { ChartHeight } from './chart-frame';
import { cn } from '@/lib/utils';

/**
 * Sizes the plot. `fill` takes the parent's free height, out of flow: a ResponsiveContainer at
 * 100% height can round a pixel past its box, which would make the card scroll by a hair.
 */
export function ChartPlot({
  height,
  plotRef,
  onResize,
  clickable,
  children,
}: {
  height: ChartHeight;
  plotRef: React.Ref<HTMLDivElement>;
  onResize: (width: number, height: number) => void;
  clickable?: boolean;
  children: ReactNode;
}) {
  const surface = cn(
    'w-full [&_.recharts-surface]:overflow-visible [&_.recharts-surface]:outline-none',
    clickable && '[&_.recharts-surface]:cursor-pointer',
  );
  if (height === 'fill') {
    return (
      <div className="relative min-h-45 flex-1">
        <div ref={plotRef} className={cn('absolute inset-0', surface)}>
          <ResponsiveContainer width="100%" height="100%" onResize={onResize}>
            {children}
          </ResponsiveContainer>
        </div>
      </div>
    );
  }
  return (
    <div ref={plotRef} className={surface} style={{ height }}>
      <ResponsiveContainer width="100%" height="100%" onResize={onResize}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}
