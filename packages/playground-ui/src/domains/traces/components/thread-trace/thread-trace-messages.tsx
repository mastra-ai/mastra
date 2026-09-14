import type { ComponentProps } from 'react';

import { useThreadTraceRow } from './thread-trace-row-context';
import { cn } from '@/lib/utils';

export interface ThreadTraceMessagesProps extends ComponentProps<'div'> {
  /** Class name of the sticky, measured wrapper around the children. */
  innerClassName?: string;
}

/**
 * The messages column. It has no borders so consecutive turns read as one continuous conversation;
 * the details column carries the borders. Its measured height is the clamp budget of the timeline.
 */
export function ThreadTraceMessages({ className, innerClassName, children, ...props }: ThreadTraceMessagesProps) {
  const { messagesRef } = useThreadTraceRow();
  return (
    <div data-slot="thread-trace-messages" className={cn('relative min-w-0 pr-4', className)} {...props}>
      {/* Sticky within the row, so a long trace on the right never scrolls its messages away. */}
      <div
        ref={messagesRef}
        data-slot="thread-trace-messages-inner"
        className={cn('sticky top-0 py-4', innerClassName)}
        data-testid="trace-row-messages"
      >
        {children}
      </div>
    </div>
  );
}
