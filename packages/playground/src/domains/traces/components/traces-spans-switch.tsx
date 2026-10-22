import { Skeleton } from '@mastra/playground-ui/components/Skeleton';
import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { ChartNoAxesGantt } from 'lucide-react';
import { useNavigate } from 'react-router';

type ObservabilityView = 'traces' | 'spans';

const VIEW_PATHS: Record<ObservabilityView, string> = { traces: '/traces', spans: '/spans' };

function ViewTab({ value, icon, label }: { value: ObservabilityView; icon: React.ReactNode; label: string }) {
  return (
    <Tab value={value}>
      <Icon size="xs">{icon}</Icon>
      <Txt variant="caption" className="text-inherit">
        {label}
      </Txt>
    </Tab>
  );
}

/** Page tabs between the traces and spans lists, built like the agent and workflow page tabs. */
export function TracesSpansSwitch({ current }: { current: ObservabilityView }) {
  const navigate = useNavigate();

  return (
    <nav aria-label="Observability views">
      <Tabs value={current} defaultTab={current} onValueChange={view => navigate(VIEW_PATHS[view])}>
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
