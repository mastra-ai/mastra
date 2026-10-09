import type { ComponentProps } from 'react';

import { THREAD_TRACE_MESSAGES_TAB } from './thread-trace-row';
import { useThreadTraceRow } from './thread-trace-row-context';
import { Tab, TabContent, TabList } from '@/ds/components/Tabs';
import type { TabContentProps, TabListProps, TabProps } from '@/ds/components/Tabs';
import { cn } from '@/lib/utils';

export interface ThreadTraceMessagesProps extends ComponentProps<'div'> {
  /** Class name of the sticky, measured wrapper around the children. */
  innerClassName?: string;
}

/**
 * The left column of a row: one `ThreadTrace.TabContent` per view (Messages / Feedback / Scores),
 * switched by the `ThreadTrace.TabList` in the row's divider. Its measured height is the clamp
 * budget of the span tree.
 */
export function ThreadTraceMessages({ className, innerClassName, children, ...props }: ThreadTraceMessagesProps) {
  const { messagesRef, messagesHeight, tab } = useThreadTraceRow();
  // A short Feedback / Scores view keeps the row as tall as the Messages view, so the span tree
  // next to it is not clipped.
  const minHeight = tab === THREAD_TRACE_MESSAGES_TAB ? undefined : (messagesHeight ?? undefined);
  return (
    <div
      data-slot="thread-trace-messages"
      className={cn('relative min-w-0 overflow-x-clip px-4', className)}
      {...props}
      style={{ minHeight, ...props.style }}
    >
      {/* Sticky within the row, so a long trace on the right never scrolls its messages away. */}
      <div
        ref={messagesRef}
        data-slot="thread-trace-messages-inner"
        className={cn('sticky top-0', innerClassName)}
        data-testid="trace-row-messages"
      >
        {children}
      </div>
    </div>
  );
}

export type ThreadTraceTabListProps = Omit<TabListProps, 'variant' | 'size'> & {
  variant?: TabListProps['variant'];
  size?: TabListProps['size'];
};

export function ThreadTraceTabList({ variant = 'pill-ghost', size = 'sm', ...props }: ThreadTraceTabListProps) {
  return <TabList variant={variant} size={size} {...props} />;
}

export type ThreadTraceTabProps = TabProps;
export const ThreadTraceTab = Tab;

export type ThreadTraceTabContentProps = TabContentProps;

/** One view of the messages column. */
export function ThreadTraceTabContent({ className, ...props }: ThreadTraceTabContentProps) {
  return <TabContent className={cn('overflow-x-hidden', className)} {...props} />;
}
