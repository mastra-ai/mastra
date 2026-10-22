import { ChartNoAxesGantt } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/ds/components/Skeleton';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { TraceIcon } from '@/ds/icons/TraceIcon';

export type ObservabilityView = 'traces' | 'spans';

export interface TracesSpansSwitchProps {
  current: ObservabilityView;
  onViewChange: (view: ObservabilityView) => void;
}

function ViewTab({ value, icon, label }: { value: ObservabilityView; icon: ReactNode; label: string }) {
  return (
    <Tab value={value}>
      <Icon size="xs">{icon}</Icon>
      <Txt variant="caption" className="text-inherit">
        {label}
      </Txt>
    </Tab>
  );
}

/** Page tabs between the traces and spans lists. The host decides what switching a view does. */
export function TracesSpansSwitch({ current, onViewChange }: TracesSpansSwitchProps) {
  return (
    <nav aria-label="Observability views">
      <Tabs value={current} defaultTab={current} onValueChange={onViewChange}>
        <TabList variant="pill-ghost">
          <ViewTab value="traces" icon={<TraceIcon />} label="Traces" />
          <ViewTab value="spans" icon={<ChartNoAxesGantt />} label="Spans" />
        </TabList>
      </Tabs>
    </nav>
  );
}

/** Holds the tabs' place while the store capabilities that decide whether they show are loading. */
export function TracesSpansSwitchSkeleton() {
  return (
    <div role="status" aria-label="Loading views" className="flex min-h-control-md items-center gap-0.5">
      <Skeleton className="h-control-md w-20 rounded-full" />
      <Skeleton className="h-control-md w-20 rounded-full" />
    </div>
  );
}
