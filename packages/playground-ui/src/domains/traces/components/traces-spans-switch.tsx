import { ChartNoAxesGantt, MessagesSquare } from 'lucide-react';
import type { ReactNode } from 'react';
import { Skeleton } from '@/ds/components/Skeleton';
import { Tab, TabList, Tabs } from '@/ds/components/Tabs';
import { Txt } from '@/ds/components/Txt';
import { Icon } from '@/ds/icons/Icon';
import { TraceIcon } from '@/ds/icons/TraceIcon';

export type ObservabilityView = 'traces' | 'spans' | 'threads';

const DEFAULT_VIEWS: ObservabilityView[] = ['traces', 'spans'];

const VIEW_TABS: Record<ObservabilityView, { icon: ReactNode; label: string }> = {
  traces: { icon: <TraceIcon />, label: 'Traces' },
  spans: { icon: <ChartNoAxesGantt />, label: 'Spans' },
  threads: { icon: <MessagesSquare />, label: 'Threads' },
};

export interface TracesSpansSwitchProps {
  current: ObservabilityView;
  /** The views to offer, in order. Defaults to traces and spans. */
  views?: ObservabilityView[];
  onViewChange: (view: ObservabilityView) => void;
}

/** Page tabs between the observability lists. The host decides what switching a view does. */
export function TracesSpansSwitch({ current, views = DEFAULT_VIEWS, onViewChange }: TracesSpansSwitchProps) {
  return (
    <nav aria-label="Observability views">
      <Tabs value={current} defaultTab={current} onValueChange={onViewChange}>
        <TabList variant="pill-ghost">
          {views.map(view => (
            <Tab key={view} value={view}>
              <Icon size="xs">{VIEW_TABS[view].icon}</Icon>
              <Txt variant="caption" className="text-inherit">
                {VIEW_TABS[view].label}
              </Txt>
            </Tab>
          ))}
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
