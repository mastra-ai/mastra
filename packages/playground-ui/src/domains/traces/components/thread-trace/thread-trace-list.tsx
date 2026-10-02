import type { ComponentProps } from 'react';

import { useThreadTrace } from './thread-trace-context';
import { MessageScroller, MessageScrollerContent, MessageScrollerViewport } from '@/ds/components/MessageScroller';
import { cn } from '@/lib/utils';

export interface ThreadTraceListProps extends ComponentProps<'div'> {
  /** Class name of the inner wrapper that establishes the positioning context for the rail. */
  innerClassName?: string;
}

/** The scroll container holding the rows; visible-row tracking observes `[data-trace-id]` inside it. */
export function ThreadTraceList({ className, innerClassName, children, ...props }: ThreadTraceListProps) {
  const { listRef } = useThreadTrace();
  return (
    <MessageScroller data-slot="thread-trace-list" className={cn('min-h-0', className)} {...props}>
      <MessageScrollerViewport ref={listRef} className="overflow-x-hidden">
        <MessageScrollerContent
          data-slot="thread-trace-list-inner"
          className={cn('relative min-h-full gap-0', innerClassName)}
        >
          {children}
        </MessageScrollerContent>
      </MessageScrollerViewport>
    </MessageScroller>
  );
}
