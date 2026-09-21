import { Button } from '@mastra/playground-ui/components/Button';
import { ApiIcon } from '@mastra/playground-ui/icons/ApiIcon';
import { CalendarClockIcon, EyeIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';

export function WorkflowHeader({ workflowName, workflowId }: { workflowName: string; workflowId: string }) {
  const { data: schedules } = useSchedules({ workflowId });
  const scheduleCount = schedules?.length ?? 0;
  const singleSchedule = scheduleCount === 1 ? schedules?.[0] : undefined;
  const schedulesHref = singleSchedule
    ? `/workflows/schedules/${encodeURIComponent(singleSchedule.id)}`
    : `/workflows/schedules?workflowId=${encodeURIComponent(workflowId)}`;

  return (
    <div className="flex items-center gap-2">
      {scheduleCount > 0 && (
        <Button render={<Link to={schedulesHref} />} size="sm" icon={<CalendarClockIcon />}>
          Schedules ({scheduleCount})
        </Button>
      )}
      <Button render={<Link to={`/traces?entity=${encodeURIComponent(workflowName)}`} />} size="sm" icon={<EyeIcon />}>
        Traces
      </Button>
      <Button
        render={<a target="_blank" rel="noopener noreferrer" href="/swagger-ui" />}

        variant="ghost"
        size="sm"
        icon={<ApiIcon />}
      >
        API endpoints
      </Button>
    </div>
  );
}
