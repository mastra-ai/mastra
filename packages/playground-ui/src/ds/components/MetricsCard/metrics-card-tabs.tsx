import type { ReactNode } from 'react';
import { cn } from '../../../lib/utils';
import { Tab, TabList, Tabs } from '../Tabs';
import type { TabProps } from '../Tabs';

export type MetricsCardTabsProps<T extends string> = {
  value: T;
  onValueChange: (value: T) => void;
  /** `MetricsCard.Tab`s. */
  children: ReactNode;
};

/**
 * The view switch in a metrics card's toolbar (e.g. Agents / Workflows / Tools): ghost tabs a
 * size under the control rung, so the switch stays quieter than the data. Metrics cards only;
 * anywhere else use `TabList`, which lines up with buttons and inputs.
 */
export function MetricsCardTabs<T extends string>({ value, onValueChange, children }: MetricsCardTabsProps<T>) {
  return (
    <Tabs<T> value={value} onValueChange={onValueChange} defaultTab={value}>
      <TabList variant="pill-ghost" size="sm">
        {children}
      </TabList>
    </Tabs>
  );
}

/** One `MetricsCard.Tabs` option: 24px tall with 12px labels. */
export function MetricsCardTab({ className, ...props }: TabProps) {
  return <Tab {...props} className={cn('h-6 px-2.5 text-column', className)} />;
}
