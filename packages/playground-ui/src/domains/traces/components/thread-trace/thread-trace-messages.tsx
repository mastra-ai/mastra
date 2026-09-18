import type { ComponentProps } from 'react';

import { THREAD_TRACE_MESSAGES_TAB } from './thread-trace-row';
import { useThreadTraceRow } from './thread-trace-row-context';
import { DataPanel } from '@/ds/components/DataPanel';
import type { DataPanelHeaderProps } from '@/ds/components/DataPanel';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import type { TabContentProps, TabListProps, TabProps } from '@/ds/components/Tabs';
import { cn } from '@/lib/utils';

export interface ThreadTraceMessagesProps extends ComponentProps<'div'> {
  /** Class name of the sticky, measured wrapper around the children. */
  innerClassName?: string;
}

/**
 * The left column of a row: the same Messages / Feedback / Scores tabs as the trace panel's side
 * column, one set per turn. Children are a `ThreadTrace.MessagesHeader` (holding the
 * `ThreadTrace.TabList`) followed by one `ThreadTrace.TabContent` per view. Like the trace
 * panel's side column it is closed by a right border, which every row continues so it reads as
 * one line down the thread. Its measured height is the clamp budget of the span tree.
 */
export function ThreadTraceMessages({ className, innerClassName, children, ...props }: ThreadTraceMessagesProps) {
  const { messagesRef, messagesHeight, tab, setTab } = useThreadTraceRow();
  // A short Feedback / Scores view keeps the row as tall as the Messages view, so the span tree
  // next to it is not clipped.
  const minHeight = tab === THREAD_TRACE_MESSAGES_TAB ? undefined : (messagesHeight ?? undefined);
  return (
    <div
      data-slot="thread-trace-messages"
      className={cn('relative min-w-0 border-r border-border1 pr-4', className)}
      {...props}
      style={{ minHeight, ...props.style }}
    >
      {/* Sticky within the row, so a long trace on the right never scrolls its messages away. */}
      <Tabs<string>
        ref={messagesRef}
        defaultTab={THREAD_TRACE_MESSAGES_TAB}
        value={tab}
        onValueChange={setTab}
        data-slot="thread-trace-messages-inner"
        className={cn('sticky top-0', innerClassName)}
        data-testid="trace-row-messages"
      >
        {children}
      </Tabs>
    </div>
  );
}

export type ThreadTraceMessagesHeaderProps = DataPanelHeaderProps;

/**
 * The bordered tab row at the top of the messages column, same chrome as the trace panel's side
 * column. It bleeds over the column's right gutter so its border reaches the column's right border
 * and continues into the details header's border as one line.
 */
export function ThreadTraceMessagesHeader({ className, ...props }: ThreadTraceMessagesHeaderProps) {
  return <DataPanel.Header className={cn('-mr-4 w-auto border-b border-border1', className)} {...props} />;
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
export const ThreadTraceTabContent = TabContent;
