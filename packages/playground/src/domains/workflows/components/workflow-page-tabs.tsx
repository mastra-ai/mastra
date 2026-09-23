import { Tab, TabList, Tabs } from '@mastra/playground-ui/components/Tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@mastra/playground-ui/components/Tooltip';
import { Txt } from '@mastra/playground-ui/components/Txt';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { TraceIcon } from '@mastra/playground-ui/icons/TraceIcon';
import { WorkflowIcon } from '@mastra/playground-ui/icons/WorkflowIcon';
import { controlStateColorTransition } from '@mastra/playground-ui/primitives/transitions';
import { cn } from '@mastra/playground-ui/utils/cn';
import { CalendarClockIcon, ExternalLink } from 'lucide-react';

import { useSchedules } from '@/domains/schedules/hooks/use-schedules';
import { useLinkComponent } from '@/lib/framework';

export type WorkflowPageTab = 'graph' | 'traces' | 'schedules';

interface WorkflowPageTabsProps {
  workflowId: string;
  /** `'none'` leaves the bar unhighlighted. */
  activeTab: WorkflowPageTab | 'none';
  showObservability?: boolean;
}

function WorkflowTab({
  value,
  icon,
  label,
  disabled,
  disabledReason,
}: {
  value: WorkflowPageTab;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  disabledReason?: React.ReactNode;
}) {
  const tabContent = (
    <>
      <Icon size="xs">{icon}</Icon>
      <Txt variant="caption" className="text-inherit">
        {label}
      </Txt>
    </>
  );

  if (disabled) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span tabIndex={0} className="inline-flex">
              <Tab value={value} disabled>
                {tabContent}
              </Tab>
            </span>
          }
        />
        {disabledReason && <TooltipContent side="bottom">{disabledReason}</TooltipContent>}
      </Tooltip>
    );
  }

  return <Tab value={value}>{tabContent}</Tab>;
}

export function WorkflowPageTabs({ workflowId, activeTab, showObservability = false }: WorkflowPageTabsProps) {
  const { navigate } = useLinkComponent();
  const { data: schedules } = useSchedules({ workflowId });
  const scheduleCount = schedules?.length ?? 0;

  const observabilityDisabledReason = !showObservability ? (
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
  ) : undefined;

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

  return (
    <div className="flex min-w-0 items-center gap-2 p-1.5">
      <Tabs value={activeTab} defaultTab={activeTab} onValueChange={handleTabChange} className="min-w-0 flex-1">
        <TabList variant="pill-ghost">
          <WorkflowTab value="graph" icon={<WorkflowIcon />} label="Graph" />
          <WorkflowTab
            value="traces"
            icon={<TraceIcon />}
            label="Traces"
            disabled={!showObservability}
            disabledReason={observabilityDisabledReason}
          />
          <WorkflowTab
            value="schedules"
            icon={<CalendarClockIcon />}
            label={scheduleCount > 0 ? `Schedules (${scheduleCount})` : 'Schedules'}
            disabled={scheduleCount === 0}
            disabledReason="Configure a schedule on this workflow to enable Schedules."
          />
        </TabList>
      </Tabs>
    </div>
  );
}
