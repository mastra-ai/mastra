import { PermissionDenied, SessionExpired, is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui';
import { useParams } from 'react-router';
import { SchedulesPage } from '@/domains/schedules/components/schedules-page';
import { useWorkflow } from '@/hooks/use-workflows';

export const WorkflowSchedules = () => {
  const { workflowId } = useParams();
  const { error } = useWorkflow(workflowId!);

  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <SessionExpired />
      </div>
    );
  }

  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="workflows" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden p-5">
      <SchedulesPage workflowId={workflowId} />
    </div>
  );
};
