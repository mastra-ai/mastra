import type { ReactNode, RefObject } from 'react';
import { LogStreamColumnSizer } from './log-stream-column-sizer';
import { LogStreamFrame } from './log-stream-frame';
import { ScrollArea, ScrollAreaViewport } from '@/ds/components/ScrollArea/scroll-area';
import { cn } from '@/lib/utils';
import type { FractionDigits } from '@/utils/date-format';

const COLUMNS = { gridTemplateColumns: 'auto auto minmax(0,1fr)' };

export interface LogStreamRootProps {
  children: ReactNode;
  scrollRef?: RefObject<HTMLDivElement | null>;
  wrap?: boolean;
  fractionDigits?: FractionDigits;
  className?: string;
}

export function LogStreamRoot({ children, scrollRef, wrap = true, fractionDigits, className }: LogStreamRootProps) {
  return (
    <LogStreamFrame className={cn('flex flex-col', className)}>
      <ScrollArea orientation="both" mask={false} className="flex min-h-0 flex-1 flex-col">
        <ScrollAreaViewport ref={scrollRef} className="min-h-0 flex-1 overscroll-x-none">
          <div className={cn('grid content-start', wrap ? 'w-full' : 'w-max min-w-full')} style={COLUMNS}>
            <LogStreamColumnSizer fractionDigits={fractionDigits} />
            {children}
          </div>
        </ScrollAreaViewport>
      </ScrollArea>
    </LogStreamFrame>
  );
}
