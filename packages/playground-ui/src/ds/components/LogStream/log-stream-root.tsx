import type { ReactNode, RefObject } from 'react';
import { LogStreamFrame } from './log-stream-frame';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea/scroll-area';
import { cn } from '@/lib/utils';

const COLUMNS = { gridTemplateColumns: 'auto auto minmax(0,1fr)' };

export interface LogStreamRootProps {
  children: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
  wrap?: boolean;
  className?: string;
}

export function LogStreamRoot({ children, scrollRef, wrap = true, className }: LogStreamRootProps) {
  return (
    <LogStreamFrame className={cn('flex flex-col', className)}>
      <ScrollArea orientation="both" mask={false} className="flex min-h-0 flex-1 flex-col">
        <ScrollAreaViewport ref={scrollRef} className="min-h-0 flex-1 overscroll-x-none">
          <div className={cn('grid content-start', wrap ? 'w-full' : 'w-max min-w-full')} style={COLUMNS}>
            {children}
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </LogStreamFrame>
  );
}
