import { PageLayout } from '@mastra/playground-ui/components/PageLayout';
import { PermissionDenied } from '@mastra/playground-ui/components/PermissionDenied';
import { SessionExpired } from '@mastra/playground-ui/components/SessionExpired';
import { is401UnauthorizedError, is403ForbiddenError } from '@mastra/playground-ui/utils/errors';
import { useParams } from 'react-router';
import { SchedulesPage as SchedulesPageContent } from '@/domains/schedules/components/schedules-page';
import { useSchedules } from '@/domains/schedules/hooks/use-schedules';

/**
 * Scoped schedules tab. The workflow layout owns breadcrumbs and the tab bar (and renders edge to edge
 * for the graph canvas), so this page brings its own padded `PageLayout` body like `TracesPage` does.
 */
function WorkflowSchedules() {
  const { workflowId } = useParams();
  const { error } = useSchedules(workflowId ? { workflowId } : {});

  if (!workflowId) return null;

  let content: React.ReactNode;
  if (error && is401UnauthorizedError(error)) {
    content = <SessionExpired variant="fill" />;
  } else if (error && is403ForbiddenError(error)) {
    content = <PermissionDenied variant="fill" resource="schedules" />;
  } else {
    content = (
      <div className="h-full">
        <SchedulesPageContent workflowId={workflowId} />
      </div>
    );
  }

  return (
    <PageLayout>
      <h1 className="sr-only">Schedules</h1>
      {content}
    </PageLayout>
  );
}

export default WorkflowSchedules;
