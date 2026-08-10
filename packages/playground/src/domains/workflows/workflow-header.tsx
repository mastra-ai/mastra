import { Button } from '@mastra/playground-ui/components/Button';
import { ApiIcon } from '@mastra/playground-ui/icons/ApiIcon';
import { Icon } from '@mastra/playground-ui/icons/Icon';
import { CalendarClockIcon, EyeIcon, PencilIcon } from 'lucide-react';
import { Link } from 'react-router';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';
import { useWorkflowBuilderAccess } from '@/domains/workflows/builder';
import { useWorkflow } from '@/hooks/use-workflows';
import { RouteHeaderActions } from '@/lib/route-header';

export function WorkflowHeader({ workflowName, workflowId }: { workflowName: string; workflowId: string }) {
  const { data: schedules } = useSchedules({ workflowId });
  const { data: workflow } = useWorkflow(workflowId);
  const { canWrite } = useWorkflowBuilderAccess();
  const scheduleCount = schedules?.length ?? 0;
  const singleSchedule = scheduleCount === 1 ? schedules?.[0] : undefined;
  const schedulesHref = singleSchedule
    ? `/workflows/schedules/${encodeURIComponent(singleSchedule.id)}`
    : `/workflows/schedules?workflowId=${encodeURIComponent(workflowId)}`;
  const canEditInBuilder = workflow?.origin === 'stored' && canWrite;

  return (
    <RouteHeaderActions owner="workflow-detail">
      <div className="flex items-center gap-2">
        {canEditInBuilder && (
          <Button as={Link} to={`/workflow-builder/${encodeURIComponent(workflowId)}`} size="sm">
            <Icon>
              <PencilIcon />
            </Icon>
            Edit in builder
          </Button>
        )}
        {scheduleCount > 0 && (
          <Button as={Link} to={schedulesHref} size="sm">
            <Icon>
              <CalendarClockIcon />
            </Icon>
            Schedules ({scheduleCount})
          </Button>
        )}
        <Button as={Link} to={`/traces?entity=${encodeURIComponent(workflowName)}`} size="sm">
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
