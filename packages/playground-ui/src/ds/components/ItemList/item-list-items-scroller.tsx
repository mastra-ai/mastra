import React, { useRef, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

export type ItemListItemsScroller = {
  children?: React.ReactNode;
};

export function ItemListItemsScroller({ children }: ItemListItemsScroller) {
  const containerRef = useRef<HTMLDivElement>(null);
  //  const [isOverflowing, setIsOverflowing] = useState(false);

  // useEffect(() => {
  //   const el = containerRef.current;
  //   if (!el) return;

  //   const check = () => {
  //     setIsOverflowing(el.scrollHeight > el.clientHeight);
  //   };

  //   const observer = new ResizeObserver(check);
  //   observer.observe(el);

  //   check();

  //   return () => observer.disconnect();
  // }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        'overflow-y-auto',
        //isOverflowing && 'pr-2'
      )}
    >
      {children}
    </div>
  );
}
