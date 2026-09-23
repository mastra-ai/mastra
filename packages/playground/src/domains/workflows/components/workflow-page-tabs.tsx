import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CalendarClockIcon, ExternalLink } from 'lucide-react';

import { UnavailableToolButton } from '@/components/ui/unavailable-tool-button';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';
import { useLinkComponent } from '@/lib/framework';

export type WorkflowPageTab = 'graph' | 'traces' | 'schedules';

interface WorkflowPageTabsProps {
  workflowId: string;
  /** `'none'` leaves the bar unhighlighted. */
  activeTab: WorkflowPageTab | 'none';
  showObservability?: boolean;
}

function WorkflowTab({ value, icon, label }: { value: WorkflowPageTab; icon: React.ReactNode; label: string }) {
  return (
    <Tab value={value}>
      <Icon size="xs">{icon}</Icon>
      <Txt variant="caption" className="text-inherit">
        {label}
      </Txt>
    </Tab>
  );
}

export function WorkflowPageTabs({ workflowId, activeTab, showObservability = false }: WorkflowPageTabsProps) {
  const { navigate } = useLinkComponent();
  const { data: schedules, isSuccess: schedulesLoaded } = useSchedules({ workflowId });
  const scheduleCount = schedules?.length ?? 0;

  const observabilityDisabledReason = (
    <p>
      Add <code>@mastra/observability</code> to enable this tab.{' '}
      <a
        href="https://mastra.ai/docs/observability/overview"
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1 text-inherit underline hover:text-foreground',
          controlStateColorTransition,
        )}
      >
        Learn more
        <ExternalLink className="size-3" />
      </a>
    </p>
  );

  const encodedWorkflowId = encodeURIComponent(workflowId);
  const hrefMap: Record<WorkflowPageTab, string> = {
    graph: `/workflows/${encodedWorkflowId}/graph`,
    traces: `/workflows/${encodedWorkflowId}/traces`,
    schedules: `/workflows/${encodedWorkflowId}/schedules`,
  };

  const handleTabChange = (value: WorkflowPageTab | 'none') => {
    if (value === 'none') return;
    navigate(hrefMap[value]);
  };

  const schedulesDisabled = schedulesLoaded && scheduleCount === 0;

  return (
    <div className="flex min-w-0 items-center justify-between gap-2 p-1.5">
      <Tabs value={activeTab} defaultTab={activeTab} onValueChange={handleTabChange} className="min-w-0">
        <TabList variant="pill-ghost">
          <WorkflowTab value="graph" icon={<WorkflowIcon />} label="Graph" />
          {showObservability && <WorkflowTab value="traces" icon={<TraceIcon />} label="Traces" />}
          {!schedulesDisabled && (
            <WorkflowTab
              value="schedules"
              icon={<CalendarClockIcon />}
              label={scheduleCount > 0 ? `Schedules (${scheduleCount})` : 'Schedules'}
            />
          )}
        </TabList>
      </Tabs>
      {(!showObservability || schedulesDisabled) && (
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {!showObservability && (
            <UnavailableToolButton icon={<TraceIcon />} label="Traces" reason={observabilityDisabledReason} />
          )}
          {schedulesDisabled && (
            <UnavailableToolButton
              icon={<CalendarClockIcon />}
              label="Schedules"
              reason="Configure a schedule on this workflow to enable Schedules."
            />
          )}
        </div>
      )}
    </div>
  );
}
