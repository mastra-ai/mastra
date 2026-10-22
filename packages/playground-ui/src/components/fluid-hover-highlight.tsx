'use client';

import type { CSSProperties } from 'react';
import type { UseFluidHoverReturn } from '../hooks/use-fluid-hover';
import { cn } from '../lib/utils';

export type FluidHoverHighlightProps = {
  hover: Pick<UseFluidHoverReturn, 'activeIndex' | 'itemRects' | 'isMeasured'>;
  className?: string;
};

type HighlightStyle = CSSProperties & { '--fluid-hover-item-radius': string };

export function FluidHoverHighlight({ hover, className }: FluidHoverHighlightProps) {
  const { activeIndex, itemRects, isMeasured } = hover;
  const rect = isMeasured && activeIndex !== null ? itemRects[activeIndex] : undefined;
  if (!rect) return null;

  const style: HighlightStyle = {
    translate: `${rect.left}px ${rect.top}px`,
    width: rect.width,
    height: rect.height,
    '--fluid-hover-item-radius': rect.radius,
  };

  return (
    <div
      data-slot="fluid-hover-highlight"
      className={cn(
        'pointer-events-none absolute top-0 left-0 bg-fill-hover transition-[translate,width,height,opacity] duration-100 ease-out-custom motion-reduce:transition-opacity starting:opacity-0',
        className,
      )}
      style={style}
    />
  );
}
