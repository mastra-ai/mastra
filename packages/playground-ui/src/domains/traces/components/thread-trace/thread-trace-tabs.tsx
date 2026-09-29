import { DataPanel } from '@/ds/components/DataPanel';
import type { DataPanelHeaderProps } from '@/ds/components/DataPanel';
import { Tab, TabContent, TabList, Tabs } from '@/ds/components/Tabs';
import type { TabContentProps, TabListProps, TabProps, TabsRootProps } from '@/ds/components/Tabs';
import { cn } from '@/lib/utils';

export const THREAD_TRACE_SPANS_TAB = 'spans';

export type ThreadTraceTabsProps = Omit<TabsRootProps<string>, 'defaultTab'> & { defaultTab?: string };

/** The Spans / Feedback / Scores views of the trace column. */
export function ThreadTraceTabs({ defaultTab = THREAD_TRACE_SPANS_TAB, className, ...props }: ThreadTraceTabsProps) {
  return <Tabs<string> defaultTab={defaultTab} className={cn('flex min-h-0 flex-1 flex-col', className)} {...props} />;
}

export type ThreadTraceTabsHeaderProps = DataPanelHeaderProps;

export function ThreadTraceTabsHeader({ className, ...props }: ThreadTraceTabsHeaderProps) {
  return <DataPanel.Header className={cn('overflow-x-auto border-b border-border', className)} {...props} />;
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

export function ThreadTraceTabContent({ className, ...props }: ThreadTraceTabContentProps) {
  return <TabContent className={cn('min-h-0 flex-1 overflow-auto', className)} {...props} />;
}
