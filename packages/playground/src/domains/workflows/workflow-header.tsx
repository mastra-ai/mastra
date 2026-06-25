import { Icon, ApiIcon } from '@mastra/playground-ui';
import { Button } from '@mastra/playground-ui/components/Button';
import { CalendarClockIcon, EyeIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';
import { RouteHeaderActions } from '@/lib/route-header';

export function WorkflowHeader({ workflowName, workflowId }: { workflowName: string; workflowId: string }) {
  const { data: schedules } = useSchedules({ workflowId });
  const scheduleCount = schedules?.length ?? 0;
  const singleSchedule = scheduleCount === 1 ? schedules?.[0] : undefined;
  const schedulesHref = singleSchedule
    ? `/workflows/schedules/${encodeURIComponent(singleSchedule.id)}`
    : `/workflows/schedules?workflowId=${encodeURIComponent(workflowId)}`;

  return (
    <RouteHeaderActions owner="workflow-detail">
      <div className="flex items-center gap-2">
        {scheduleCount > 0 && (
          <Button as={Link} to={schedulesHref} size="sm">
            <Icon>
              <CalendarClockIcon />
            </Icon>
            Schedules ({scheduleCount})
          </Button>
        )}
        <Button as={Link} to={`/observability?entity=${encodeURIComponent(workflowName)}`} size="sm">
          <Icon>
            <EyeIcon />
          </Icon>
          Traces
        </Button>
        <Button as="a" target="_blank" rel="noopener noreferrer" href="/swagger-ui" variant="ghost" size="sm">
          <ApiIcon />
          API endpoints
        </Button>
      </div>
    </RouteHeaderActions>
  );
}
