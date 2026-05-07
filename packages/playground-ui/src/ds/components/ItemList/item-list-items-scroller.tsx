import React, { useRef } from 'react';
import { cn } from '@/lib/utils';

export type ItemListItemsScroller = {
  children?: React.ReactNode;
};

export function ItemListItemsScroller({ children }: ItemListItemsScroller) {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className={cn('overflow-y-auto')}>
      {children}
    </div>
  );
}
