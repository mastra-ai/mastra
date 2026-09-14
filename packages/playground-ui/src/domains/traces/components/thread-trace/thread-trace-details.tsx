import type { ComponentProps } from 'react';

import { THREAD_TRACE_SPANS_TAB } from './thread-trace-row';
import { useThreadTraceRow } from './thread-trace-row-context';
import { DataPanel } from '@/ds/components/DataPanel';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import type { TabContentProps, TabListProps, TabProps } from '@/ds/components/Tabs';
import { cn } from '@/lib/utils';

export type ThreadTraceDetailsProps = ComponentProps<'div'>;

/** The tabbed details column of a row; the spans tab is `ThreadTrace.SpansTab`, others are `ThreadTrace.TabContent`. */
export function ThreadTraceDetails({ className, children, ...props }: ThreadTraceDetailsProps) {
  const { isExpanded, isFirst, tab, setTab } = useThreadTraceRow();
  return (
    <Tabs<string>
      defaultTab={THREAD_TRACE_SPANS_TAB}
      value={tab}
      onValueChange={setTab}
      data-slot="thread-trace-details"
      className={cn(
        'min-w-0 overflow-hidden border-x border-b border-border1 group-last:rounded-b-xl',
        // While collapsed the messages column alone sets the row height: `h-0` keeps this
        // cell out of the grid's row sizing (so measurement rounding can't nudge the row by
        // a pixel between tabs) and `min-h-full` stretches it back to the row afterwards.
        !isExpanded && 'h-0 min-h-full',
        isFirst && 'rounded-t-xl border-t',
        className,
      )}
      {...props}
    >
      {children}
    </Tabs>
  );
}

export interface ThreadTraceDetailsHeaderProps extends ComponentProps<'div'> {
  headerClassName?: string;
}

/**
 * Same header/tab layout as the traces page so both surfaces read identically. Children are a
 * `ThreadTrace.TabList` plus an optional `ThreadTrace.DetailsActions`. Measured: its height is
 * taken out of the timeline budget so the details cell never overshoots the messages column.
 */
export function ThreadTraceDetailsHeader({
  className,
  headerClassName,
  children,
  ...props
}: ThreadTraceDetailsHeaderProps) {
  const { detailsHeaderRef } = useThreadTraceRow();
  return (
    <div ref={detailsHeaderRef} data-slot="thread-trace-details-header" className={className} {...props}>
      {/* Explicit border: the measuring wrapper makes the header the "last" child. */}
      <DataPanel.Header className={cn('min-h-0 border-b border-border1 py-1.5', headerClassName)}>
        {children}
      </DataPanel.Header>
    </div>
  );
}

export type ThreadTraceTabListProps = Omit<TabListProps, 'variant'> & { variant?: TabListProps['variant'] };

export function ThreadTraceTabList({ variant = 'pill-ghost', ...props }: ThreadTraceTabListProps) {
  return <TabList variant={variant} {...props} />;
}

export type ThreadTraceDetailsActionsProps = ComponentProps<'div'>;

/** Trailing controls of the header (e.g. a "Go to trace" link), rendered after the tabs. */
export function ThreadTraceDetailsActions({ className, ...props }: ThreadTraceDetailsActionsProps) {
  return (
    <div data-slot="thread-trace-details-actions" className={cn('flex shrink-0 items-center', className)} {...props} />
  );
}

export type ThreadTraceTabProps = TabProps;
export const ThreadTraceTab = Tab;

export type ThreadTraceTabContentProps = TabContentProps;
export const ThreadTraceTabContent = TabContent;
