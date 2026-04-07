import {
  WorkflowGraph,
  useWorkflow,
  PermissionDenied,
  SessionExpired,
  is403ForbiddenError,
  is401UnauthorizedError,
} from '@mastra/playground-ui';
import { useParams } from 'react-router';

export const Workflow = () => {
  const { workflowId } = useParams();
  const { data: workflow, isLoading, error } = useWorkflow(workflowId!);

  // 401 check - session expired, needs re-authentication
  if (error && is401UnauthorizedError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <SessionExpired />
      </div>
    );
  }

  // 403 check - permission denied for workflows
  if (error && is403ForbiddenError(error)) {
    return (
      <div className="flex h-full items-center justify-center">
        <PermissionDenied resource="workflows" />
      </div>
    );
  }

  return <WorkflowGraph workflowId={workflowId!} workflow={workflow ?? undefined} isLoading={isLoading} />;
};
